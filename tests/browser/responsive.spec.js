import { expect, test } from '@playwright/test';

const widths = [320, 360, 390, 768, 1280];

test('StrictMode abort does not leave a stale count error', async ({ page }) => {
  await page.route('**/rest/v1/public_projects*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'content-range': '*/0' },
    body: '[]',
  }));
  await page.goto('/#/');
  await expect(page.getByText('0', { exact: true })).toBeVisible();
  await expect(page.getByText('تعذر إكمال الطلب الآن. يرجى المحاولة لاحقاً.')).toHaveCount(0);
});

test('missing Edge Function shows an actionable Arabic setup error', async ({ page }) => {
  await page.route('**/functions/v1/project-api', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'NOT_FOUND', message: 'Requested function was not found' }),
  }));
  await page.goto('/#/register');
  const names = page.getByPlaceholder('الاسم الكامل');
  const ids = page.getByPlaceholder('الرقم الجامعي');
  for (let index = 0; index < 4; index += 1) {
    await names.nth(index).fill(`طالب ${index + 1}`);
    await ids.nth(index).fill(`000${index + 1}`);
  }
  await page.getByLabel('الوحدة').fill('الوحدة الأولى');
  await page.getByLabel('رقم الصفحة').fill('12');
  await page.getByLabel('وصف التجربة').fill('وصف تجربة صالح للاختبار');
  await page.getByRole('button', { name: 'تأكيد الحجز' }).click();
  await expect(page.getByText(/خدمة التسجيل ورفع الملفات غير مفعّلة بعد/)).toBeVisible();
  await expect(page.getByText('Requested function was not found')).toHaveCount(0);
});

for (const width of widths) {
  test(`registration has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/#/register');
    await expect(page.getByRole('heading', { name: /تسجيل فريق/ })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
    const universityInput = page.getByPlaceholder('الرقم الجامعي').first();
    const box = await universityInput.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  });
}

test('dark book cards and unavailable actions fit mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/#/books');
  await expect(page.getByText('الكتاب غير متاح حالياً').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(5, 9, 20)');
});

test('mobile project cards and upload dialog remain contained', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route('**/rest/v1/public_projects*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'content-range': '0-0/1' },
    body: JSON.stringify([{ id: '10000000-0000-0000-0000-000000000001', grade: 'الصف السابع', subject: 'الرياضيات', unit: 'الوحدة الأولى', page: 12, idea_description: 'وصف تجربة آمن وعام', team_label: 'فريق تجريبي', is_submitted: false, created_at: new Date().toISOString() }]),
  }));
  await page.goto('/#/grade/7');
  await page.getByRole('button', { name: 'رفع الملف' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.height).toBeLessThanOrEqual(640);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
