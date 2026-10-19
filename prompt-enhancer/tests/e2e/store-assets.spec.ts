import path from 'node:path';
import { expect, test } from './fixtures';

test('captures the real toolbar for the Chrome Web Store listing', async ({ page }) => {
  test.skip(process.env.CAPTURE_STORE_ASSETS !== '1', 'Asset capture is opt-in.');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:4173/store-listing.html');
  const editor = page.getByLabel('Your prompt');
  await editor.fill(
    'Review this product brief and return the main risks, unanswered questions, and recommended next actions.',
  );
  await editor.focus();
  const toolbar = page.getByRole('toolbar', { name: 'Prompt Composer tools' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Snippets' }).click();
  await expect(page.getByRole('option', { name: /Configure snippets/ })).toBeVisible();
  await page.screenshot({
    path: path.resolve('store-assets/listing/screenshot-toolbar-1280x800.png'),
    fullPage: false,
  });
});
