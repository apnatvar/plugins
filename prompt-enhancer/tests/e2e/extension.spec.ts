import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const FIXTURE_URL = 'http://127.0.0.1:4173/';
const PROMPT_A =
  'Build a local-first React prompt toolbar. Use TypeScript. Keep Chrome MV3 support. Return production-ready code.';

interface ExtensionGlobal {
  chrome: {
    storage: {
      local: {
        get(keys: null): Promise<Record<string, unknown>>;
        set(items: Record<string, unknown>): Promise<void>;
      };
    };
  };
}

async function openFixture(page: Page): Promise<void> {
  await page.goto(FIXTURE_URL);
  await expect(
    page.getByRole('heading', { name: 'Prompt Composer local editor fixture' }),
  ).toBeVisible();
}

function toolbar(page: Page) {
  return page.getByRole('toolbar', { name: 'Prompt Composer tools' });
}

test('shows exactly one toolbar for an eligible textarea and ignores search input', async ({
  page,
}) => {
  await openFixture(page);
  await page.locator('#standard').click();
  await expect(toolbar(page)).toHaveCount(1);
  await page.locator('input[type="search"]').click();
  await expect(toolbar(page)).toHaveCount(0);
});

test.skip('previews structure changes before replacement and preserves technical constraints', async ({
  page,
}) => {
  await openFixture(page);
  const editor = page.locator('#standard');
  await editor.fill(PROMPT_A);
  await toolbar(page).getByRole('button', { name: 'Structure' }).click();

  const dialog = page.getByRole('dialog', { name: 'Review transformation' });
  await expect(dialog).toBeVisible();
  await expect(editor).toHaveValue(PROMPT_A);
  const transformed = dialog.getByLabel('Transformed prompt');
  await expect(transformed).toHaveValue(/TypeScript/);
  await expect(transformed).toHaveValue(/Chrome MV3/);

  await dialog.getByRole('button', { name: 'Replace draft' }).click();
  await expect(editor).not.toHaveValue(PROMPT_A);
});

test.skip('undo restores the exact original textarea value', async ({ page }) => {
  await openFixture(page);
  const original = 'Build a card. Use TypeScript. Use TypeScript.';
  const editor = page.locator('#standard');
  await editor.fill(original);
  await toolbar(page).getByRole('button', { name: 'Shorten' }).click();
  await page.getByRole('menuitem', { name: /Light/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace draft' }).click();
  await expect(editor).not.toHaveValue(original);
  await toolbar(page).getByRole('button', { name: 'Undo' }).click();
  await expect(editor).toHaveValue(original);
});

test('expands a snippet in preview and inserts it only after confirmation', async ({ page }) => {
  await openFixture(page);
  const editor = page.locator('#standard');
  await editor.fill('const answer: number = 42;');
  await editor.selectText();
  await toolbar(page).getByRole('button', { name: 'Snippets' }).click();
  await page.getByRole('option', { name: /Code review/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Review transformation' });
  await expect(dialog.getByLabel('Transformed prompt')).toHaveValue(/Review the following code/);
  await expect(dialog.getByLabel('Transformed prompt')).toHaveValue(/const answer: number = 42;/);
  await expect(editor).toHaveValue('const answer: number = 42;');
  await dialog.getByRole('button', { name: 'Insert below' }).click();
  await expect(editor).toHaveValue(/const answer: number = 42;[\s\S]+Review the following code/);
});

test('opens snippet settings without content or service-worker errors', async ({
  page,
  extensionContext,
}) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  let [serviceWorker] = extensionContext.serviceWorkers();
  serviceWorker ??= await extensionContext.waitForEvent('serviceworker');
  serviceWorker.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await openFixture(page);
  await page.locator('#standard').click();
  await toolbar(page).getByRole('button', { name: 'Snippets' }).click();
  await page.getByRole('option', { name: /Configure snippets/ }).click();
  await expect(page.getByText('Snippet settings opened.', { exact: true })).toBeAttached();
  await page.waitForTimeout(250);
  expect(runtimeErrors).toEqual([]);
});

test('opens the review panel above the floating toolbar', async ({ page }) => {
  await openFixture(page);
  await page.locator('#standard').fill('Make it better.');
  await toolbar(page)
    .getByRole('button', { name: /Review/ })
    .click();

  const toolbarBox = await toolbar(page).boundingBox();
  const panel = page.locator('[data-panel-placement="above"]');
  const panelBox = await panel.boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual(
    (toolbarBox?.y ?? 0) - 3,
  );
});

test('starts without Chrome-recorded runtime errors', async ({ page, extensionId }) => {
  await openFixture(page);
  await page.locator('#standard').click();
  await expect(toolbar(page)).toHaveCount(1);

  await page.goto('chrome://extensions/');
  const extensionItem = page.locator(`extensions-item#${extensionId}`);
  await expect(extensionItem).toBeAttached();
  await expect(extensionItem.locator('#errors-button')).toBeHidden();
});

test('shows clean publisher branding and configurable website access', async ({
  page,
  extensionId,
}) => {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const publisher = page.getByRole('link', { name: 'Tools by Brownsmith Dynamics' });
  await expect(publisher).toHaveAttribute('href', 'https://brownsmithdynamics.com');
  await expect(page.getByText('Local only')).toHaveCount(0);
  await expect(page.getByText('No cloud')).toHaveCount(0);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('checkbox', { name: /All websites/ })).not.toBeChecked();
  await expect(page.getByLabel('Website rules').getByText('chatgpt.com')).toBeVisible();
  await expect(page.getByLabel('Website rules').getByText('www.meshy.ai')).toBeVisible();
  await expect(page.getByLabel('Website rules').getByText('try.sarvam.ai')).toBeVisible();
  await page.getByLabel('Website hostname').fill('example.com');
  await page.getByRole('button', { name: 'Allow' }).click();
  const exampleRule = page.getByLabel('Website rules').locator('.setting-row').filter({
    hasText: 'example.com',
  });
  await expect(exampleRule).toBeVisible();
  await exampleRule.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('example.com')).toHaveCount(0);
});

test('detects an editor inserted two seconds after page load', async ({ page }) => {
  await openFixture(page);
  const dynamicEditor = page.locator('#dynamic');
  await expect(dynamicEditor).toBeVisible({ timeout: 4_000 });
  await dynamicEditor.click();
  await expect(toolbar(page)).toHaveCount(1);
});

test('cleans up a removed editor and mounts once for its replacement', async ({ page }) => {
  await openFixture(page);
  await page.locator('#replaceable').click();
  await expect(toolbar(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove and recreate' }).click();
  await page.locator('#replaceable').click();
  await expect(toolbar(page)).toHaveCount(1);
});

test.skip('compresses contenteditable text and leaves a usable cursor', async ({ page }) => {
  await openFixture(page);
  const original = 'Build a card. Build a card. Use TypeScript.';
  const editor = page.locator('#contenteditable');
  await editor.fill(original);
  await toolbar(page).getByRole('button', { name: 'Shorten' }).click();
  await page.getByRole('menuitem', { name: /Light/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Transformed prompt')).toHaveValue(
    'Build a card.\nUse TypeScript.',
  );
  await dialog.getByRole('button', { name: 'Replace draft' }).click();
  await expect(editor).not.toHaveText(original);
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const selection = window.getSelection();
        return document.activeElement === element && Boolean(selection?.rangeCount);
      }),
    )
    .toBe(true);
  await editor.pressSequentially(' More');
  await expect(editor).toContainText('More');
});

test.skip('updates a controlled editor and its external state', async ({ page }) => {
  await openFixture(page);
  const editor = page.locator('#controlled');
  await editor.fill('Build a card. Build a card. Use TypeScript.');
  await toolbar(page).getByRole('button', { name: 'Shorten' }).click();
  await page.getByRole('menuitem', { name: /Light/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace draft' }).click();
  const transformed = await editor.inputValue();
  expect(transformed).not.toContain('Build a card. Build a card.');
  await expect(page.locator('#controlled-state')).toHaveText(transformed);
});

test.skip('warns that aggressive compression may lose context before replacement', async ({
  page,
}) => {
  await openFixture(page);
  const editor = page.locator('#standard');
  await editor.fill('Build a card. Background that may be incidental. Use TypeScript.');
  await toolbar(page).getByRole('button', { name: 'Shorten' }).click();
  await page.getByRole('menuitem', { name: /Aggressive/i }).click();
  await expect(page.getByRole('alert')).toContainText('may remove context');
  await expect(editor).toHaveValue(
    'Build a card. Background that may be incidental. Use TypeScript.',
  );
});

test('warns about possible secrets without storing or transmitting the prompt', async ({
  page,
  extensionContext,
  extensionId,
}) => {
  await openFixture(page);
  const secret = 'sk-localAcceptanceSecret123456789';
  const outboundPayloads: string[] = [];
  page.on('request', (request) => {
    outboundPayloads.push(`${request.url()} ${request.postData() ?? ''}`);
  });

  await page.locator('#standard').fill(`Review this key: ${secret}`);
  await toolbar(page)
    .getByRole('button', { name: /Review/ })
    .click();
  await expect(page.getByLabel('Prompt review')).toContainText('Possible Secret');

  let [serviceWorker] = extensionContext.serviceWorkers();
  serviceWorker ??= await extensionContext.waitForEvent('serviceworker');
  expect(serviceWorker.url()).toContain(extensionId);
  const stored = await serviceWorker.evaluate(() => {
    const extensionGlobal = globalThis as unknown as ExtensionGlobal;
    return extensionGlobal.chrome.storage.local.get(null);
  });
  expect(JSON.stringify(stored)).not.toContain(secret);
  expect(outboundPayloads.join('\n')).not.toContain(secret);
});

test('applies stored enablement and custom snippets without a page reload', async ({
  page,
  extensionContext,
}) => {
  await openFixture(page);
  const editor = page.locator('#standard');
  await editor.fill('A local draft');
  await expect(toolbar(page)).toHaveCount(1);

  let [serviceWorker] = extensionContext.serviceWorkers();
  serviceWorker ??= await extensionContext.waitForEvent('serviceworker');
  const originalState = await serviceWorker.evaluate(() => {
    const extensionGlobal = globalThis as unknown as ExtensionGlobal;
    return extensionGlobal.chrome.storage.local.get(null);
  });

  try {
    await serviceWorker.evaluate(async () => {
      const extensionGlobal = globalThis as unknown as ExtensionGlobal;
      const all = await extensionGlobal.chrome.storage.local.get(null);
      const state = all.promptComposerState as {
        settings: { enabled: boolean };
        snippets: Array<Record<string, unknown>>;
      };
      await extensionGlobal.chrome.storage.local.set({
        promptComposerState: {
          ...state,
          settings: { ...state.settings, enabled: false },
        },
      });
    });
    await expect(toolbar(page)).toHaveCount(0);

    await serviceWorker.evaluate(async () => {
      const extensionGlobal = globalThis as unknown as ExtensionGlobal;
      const all = await extensionGlobal.chrome.storage.local.get(null);
      const state = all.promptComposerState as {
        settings: { enabled: boolean };
        snippets: Array<Record<string, unknown>>;
      };
      const now = new Date().toISOString();
      await extensionGlobal.chrome.storage.local.set({
        promptComposerState: {
          ...state,
          settings: { ...state.settings, enabled: true },
          snippets: [
            ...state.snippets,
            {
              id: 'e2e-custom-snippet',
              name: 'Acceptance custom',
              description: 'Local acceptance snippet',
              category: 'Test',
              template: 'Custom result for {{current_prompt}}',
              enabled: true,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      });
    });
    await expect(toolbar(page)).toHaveCount(1);
    await toolbar(page).getByRole('button', { name: 'Snippets' }).click();
    await expect(page.getByRole('option', { name: /Acceptance custom/ })).toBeVisible();
  } finally {
    await serviceWorker.evaluate(async (state) => {
      const extensionGlobal = globalThis as unknown as ExtensionGlobal;
      await extensionGlobal.chrome.storage.local.set(state);
    }, originalState);
  }
});
