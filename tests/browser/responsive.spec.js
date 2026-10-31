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

test('book library separates grade selection from all 11 books', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/#/books');
  const grades = page.getByRole('region', { name: 'الصفوف الدراسية' });
  await expect(grades.getByRole('link')).toHaveCount(3);
  await grades.getByRole('link', { name: /الصف الثامن/ }).click();
  await expect(page).toHaveURL(/#\/books\/8$/);
  await expect(page.getByRole('heading', { name: 'كتب الصف الثامن' })).toBeVisible();
  await expect(page.getByText('كتاب الجبر')).toBeVisible();
  await expect(page.getByText('كتاب الهندسة')).toBeVisible();
  await expect(page.locator('main article')).toHaveCount(4);
  await page.goto('/#/books/7');
  await expect(page.locator('main article')).toHaveCount(3);
  await page.goto('/#/books/9');
  await expect(page.locator('main article')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(5, 9, 20)');
});

test('sortable project table and both dialogs remain contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route('**/functions/v1/project-api', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'details' && body.teamCode === 'valid-team-code') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, members: [{ position: 1, name: 'الطالب الأول' }, { position: 2, name: 'الطالب الثاني' }] }),
      });
      return;
    }
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'unauthorized' }) });
  });
  await page.route('**/rest/v1/public_projects*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'content-range': '0-1/2' },
    body: JSON.stringify([
      { id: 1, grade: 'الصف السابع', subject: 'الرياضيات', unit: 'الوحدة الأولى', page: 12, idea_description: 'فكرة 1', is_submitted: false, created_at: new Date().toISOString() },
      { id: 2, grade: 'الصف السابع', subject: 'العلوم', unit: 'الوحدة الثانية', page: 18, idea_description: 'فكرة 2', is_submitted: false, created_at: new Date().toISOString() },
    ]),
  }));
  await page.goto('/#/grade/7');
  const tableRegion = page.getByRole('region', { name: 'جدول المشاريع' });
  await expect(tableRegion).toBeVisible();
  await expect(page.getByRole('button', { name: 'ترتيب فكرة المشروع تصاعدياً' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ترتيب رقم الصفحة تصاعدياً' })).toBeVisible();
  await page.getByRole('button', { name: 'ترتيب فكرة المشروع تنازلياً' }).click();
  await expect(page.locator('tbody tr').first().locator('td').first()).toContainText('فكرة 2');
  await page.getByRole('button', { name: 'ترتيب رقم الصفحة تصاعدياً' }).click();
  await expect(page.locator('tbody tr').first().locator('td').nth(4)).toHaveText('12');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.getByRole('button', { name: 'عرض التفاصيل' }).first().click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'تفاصيل المشروع' })).toBeVisible();
  await expect(dialog.getByText('رقم الصفحة')).toBeVisible();
  await expect(dialog.getByText('رقم المشروع')).toHaveCount(0);
  await expect(dialog.getByText('الفريق العام')).toHaveCount(0);
  await dialog.getByLabel('كود الفريق السري').fill('valid-team-code');
  await dialog.getByRole('button', { name: 'عرض أعضاء الفريق' }).click();
  await expect(dialog.getByText('الطالب الأول')).toBeVisible();
  await expect(dialog.getByText('الطالب الثاني')).toBeVisible();
  let box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.height).toBeLessThanOrEqual(640);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'رفع الملف' }).first().click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'رفع ملف HTML خاص' })).toBeVisible();
  box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.height).toBeLessThanOrEqual(640);
});
