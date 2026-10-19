import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';

interface ExtensionWorkerFixtures {
  extensionContext: BrowserContext;
  extensionId: string;
}

interface RuntimeGlobal {
  chrome: {
    runtime: {
      sendMessage(message: Record<string, unknown>): Promise<unknown>;
    };
  };
}

export const test = base.extend<Record<string, never>, ExtensionWorkerFixtures>({
  extensionContext: [
    async ({ browserName }, use) => {
      if (browserName !== 'chromium') {
        throw new Error('Extension acceptance tests require bundled Chromium.');
      }
      const extensionPath = path.resolve('apps/extension/.output/chrome-mv3');
      const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        headless: true,
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
      });
      let [serviceWorker] = context.serviceWorkers();
      serviceWorker ??= await context.waitForEvent('serviceworker');
      const extensionId = serviceWorker.url().split('/')[2]!;
      const configurationPage = await context.newPage();
      await configurationPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await configurationPage.evaluate(async () => {
        const extensionGlobal = globalThis as unknown as RuntimeGlobal;
        const settings = (await extensionGlobal.chrome.runtime.sendMessage({
          type: 'GET_SETTINGS',
        })) as { siteEnabled: Record<string, boolean> };
        await extensionGlobal.chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          payload: {
            ...settings,
            siteEnabled: { ...settings.siteEnabled, '127.0.0.1': true },
          },
        });
      });
      await configurationPage.close();
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],
  extensionId: [
    async ({ extensionContext }, use) => {
      let [serviceWorker] = extensionContext.serviceWorkers();
      serviceWorker ??= await extensionContext.waitForEvent('serviceworker');
      await use(serviceWorker.url().split('/')[2]!);
    },
    { scope: 'worker' },
  ],
  page: async ({ extensionContext }, providePage) => {
    const page = await extensionContext.newPage();
    await providePage(page);
    await page.close();
  },
});

export const expect = test.expect;
