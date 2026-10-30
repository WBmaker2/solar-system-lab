import { expect, test } from '@playwright/test';

test('home loads full lab UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Solar System Lab/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /시간 조절/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /오늘의 우주/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /도전! 퀴즈/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /일식·월식 예측/ })).toBeVisible();
});

test('3D scene initializes without the WebGL fallback', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#scene')).toBeVisible();
  await expect(page.locator('.label-layer .body-label').first()).toBeVisible();
  await expect(page.getByText('2D 정보 패널만 표시')).toHaveCount(0);
});

test('play/pause toggles simulation', async ({ page }) => {
  await page.goto('/');
  const play = page.getByRole('button', { name: /재생하기|정지하기/ });
  await expect(play).toContainText('재생하기');
  await play.click();
  await expect(play).toContainText('정지하기');
  await play.click();
  await expect(play).toContainText('재생하기');
});

test('time scrubber moves earth (date label changes)', async ({ page }) => {
  await page.goto('/');
  const dateLabel = page.locator('#tp-date');
  const before = await dateLabel.textContent();
  await page.locator('#tp-slider').fill('200');
  const after = await dateLabel.textContent();
  expect(before).not.toBe(after);
  await expect(dateLabel).toContainText('2026-');
});

test('eclipse predictor lists 2026 windows with jump buttons', async ({ page }) => {
  await page.goto('/');
  const items = page.locator('.eclipse-list li');
  await expect(items.first()).toBeVisible();
  expect(await items.count()).toBeGreaterThanOrEqual(4);
  // Jump to first eclipse window and see the stage badge react.
  await items.first().getByRole('button', { name: '이 날짜로 이동' }).click();
  await expect(page.locator('#eclipse-badge')).toBeVisible();
});

test('quiz scoring works for the full-moon mission', async ({ page }) => {
  await page.goto('/');
  // 2026-03-03 is (nearly) a full moon: illumination > 98%.
  await page.locator('#tp-input').fill('2026-03-03');
  const firstQuiz = page.locator('.quiz-item').first();
  await firstQuiz.getByRole('button', { name: '정답 확인하기' }).click();
  await expect(firstQuiz.locator('.result')).toContainText('조건 달성');
  await expect(page.locator('#qz-score')).toContainText('/ 100점');
});

test('observer sky diagram renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.sky-svg')).toBeVisible();
  await expect(page.locator('.graph-svg')).toBeVisible();
});

test('tilt slider changes seasonal contrast', async ({ page }) => {
  await page.goto('/');
  const noon = page.locator('#gr-noon');
  const before = await noon.textContent();
  await page.locator('#tilt-slider').fill('0');
  await expect(page.locator('#gr-tilt-val')).toContainText('0');
  await expect(page.locator('#ic-tilt')).toContainText('0.0°');
  const after = await noon.textContent();
  expect(before).not.toBe(after);
  // Reset for other tests (fresh context per test, but keep UI tidy).
  await page.locator('[data-tilt="23.4"]').click();
});

test('observer button does not move the page scroll', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => window.scrollY);
  await page.getByRole('button', { name: '관측자', exact: true }).click();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await expect(page.locator('#ui-observer .card')).toHaveClass(/highlight|card/);
});

test('shared link restores date and tilt', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tp-input').fill('2026-08-12');
  await page.locator('#tilt-slider').fill('30');
  await page.waitForTimeout(700); // debounce flush
  const url = page.url();
  expect(url).toContain('#s=');
  await page.goto(url);
  await expect(page.locator('#tp-date')).toContainText('2026-08-12');
  await expect(page.locator('#gr-tilt-val')).toContainText('30');
});

test('no console errors or page errors on load and interaction', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  await page.getByRole('button', { name: /재생하기|정지하기/ }).click();
  await page.locator('#tp-slider').fill('200');
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
