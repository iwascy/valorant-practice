import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/'); await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
}
async function canvasColors(page: Page) {
  return page.locator('#scene').evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2')!;
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 400) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    return colors.size;
  });
}
test('random flashes persist settings, blind in grey, freeze on pause, score a back turn and reset', async ({ page }) => {
  test.setTimeout(65000);
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await ready(page); await page.locator('#settings').click();
  await page.locator('input[name=flashEnabled]').check();
  await page.locator('#settings-dialog .close').click(); await page.reload();
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('input[name=flashEnabled]')).toBeChecked();
  await page.locator('input[value=precision]').check({ force: true });
  await page.locator('#start').click();
  const state = async () => JSON.parse((await page.locator('#scene').getAttribute('data-flash'))!);
  await expect.poll(async () => (await state()).warning, { timeout: 18000, intervals: [40] }).toBe(true);
  expect(await canvasColors(page)).toBeGreaterThan(30);
  await page.screenshot({ path: 'test-results/flash-warning.png' });
  await expect(page.locator('#blind-overlay')).toBeVisible({ timeout: 5000 });
  const background = await page.locator('#blind-overlay').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(background).toContain('110, 114, 119');
  await page.screenshot({ path: 'test-results/flash-blind.png' });
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator('#blind-overlay')).toBeHidden();
  const paused = await state(); await page.waitForTimeout(300); expect(await state()).toEqual(paused);
  await page.locator('#resume').click();
  await expect.poll(async () => (await state()).warning, { timeout: 20000, intervals: [20] }).toBe(true);
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementX: 180 / (0.07 * 0.35) })));
  await expect.poll(async () => (await state()).results.length, { timeout: 5000 }).toBe(2);
  expect((await state()).results[1].outcome).toBe('back');
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementX: -180 / (0.07 * 0.35) })));
  await expect.poll(async () => {
    const results = JSON.parse((await page.locator('#scene').getAttribute('data-reaim'))!);
    return results[0]?.aim;
  }, { timeout: 3000 }).toEqual(expect.any(Number));
  await page.mouse.down(); await page.waitForTimeout(130); await page.mouse.up();
  await expect.poll(async () => JSON.parse((await page.locator('#scene').getAttribute('data-reaim'))!)[0]?.status).toBe('killed');
  expect(JSON.parse((await page.locator('#scene').getAttribute('data-reaim'))!)[0].firstShot).toBe(true);
  await page.evaluate(() => document.exitPointerLock()); await page.locator('#finish').click();
  await expect(page.locator('#result-stats')).toContainText('背闪成功');
  await expect(page.locator('#result-stats')).toContainText('50%');
  await expect(page.locator('#result-stats')).toContainText('平均重新瞄准');
  await page.screenshot({ path: 'test-results/flash-results.png' });
  await page.locator('#retry').click();
  await expect.poll(async () => (await state()).results.length).toBe(0);
  await expect(page.locator('#blind-overlay')).toBeHidden();
});
test('crosshair codes preview, reject invalid edits, persist and reset on desktop and mobile', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page); await page.locator('#settings').click();
  const code = '0;P;c;8;u;FF3300FF;h;0;d;1;z;3;0b;0;1b;0';
  await page.locator('#crosshair-code').fill(code); await page.locator('#import-crosshair').click();
  await expect(page.locator('#crosshair-status')).toContainText('已导入');
  const pixels = await page.locator('#crosshair-preview').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')!;
    return Array.from(context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data);
  });
  expect(pixels).toEqual([255, 51, 0, 255]);
  const margins = await page.evaluate(async () => {
    const url = '/src/crosshair.ts', { parseCrosshair, drawCrosshair } = await import(url);
    const canvas = document.createElement('canvas');
    const { config } = parseCrosshair('0;P;t;6;0o;40;0l;20;0m;1;0s;3;0f;1;0e;3;1b;0');
    drawCrosshair(canvas, config, 1, 20);
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let min = canvas.width, max = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3]) { min = Math.min(min, x); max = Math.max(max, x); }
    return { min, max, width: canvas.width };
  });
  expect(margins.min).toBeGreaterThan(0); expect(margins.max).toBeLessThan(margins.width - 1);
  await page.locator('#crosshair-code').fill('0;P;c;99'); await page.locator('#import-crosshair').click();
  await expect(page.locator('#crosshair-status')).toContainText('超出范围');
  await page.reload(); await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await page.locator('#settings').click(); await expect(page.locator('#crosshair-code')).toHaveValue(code);
  await page.screenshot({ path: 'test-results/crosshair-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#crosshair-preview').scrollIntoViewIfNeeded();
  expect(await page.locator('#settings-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/crosshair-mobile.png' });
  await page.locator('#reset-crosshair').click(); await expect(page.locator('#crosshair-code')).toHaveValue('');
  expect(errors).toEqual([]);
});
for (const mode of ['depth', 'strafe', 'peek']) test(`bots ${mode} move, pause, resume, render and save target statistics`, async ({ page }) => {
  await page.addInitScript(() => { let seed = 783; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page); await page.locator('#settings').click();
  await page.locator('select[name=botMode]').selectOption(mode);
  await page.locator('#settings-dialog .close').click();
  await page.locator('input[value=precision]').check({ force: true }); await page.locator('#start').click();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  const bots = async () => JSON.parse((await page.locator('#scene').getAttribute('data-bots'))!);
  await expect.poll(async () => (await bots())?.[2]?.speed).toBeGreaterThan(0.2);
  const active = await bots();
  expect(mode === 'depth' ? active[2].z : active[2].x).not.toBe(mode === 'depth' ? -12 : 0);
  if (mode === 'peek') {
    await expect.poll(async () => (await bots())[2].phase).toBe('hold');
    expect(Math.abs((await bots())[2].x)).toBeGreaterThan(1.95);
    expect(await canvasColors(page)).toBeGreaterThan(30);
    await page.screenshot({ path: 'test-results/bots-peek-exposed.png' });
    await expect.poll(async () => (await bots())[2].phase).toBe('wait');
    expect(Math.abs((await bots())[2].x)).toBeLessThan(0.025);
    await page.screenshot({ path: 'test-results/bots-peek-hidden.png' });
    await page.mouse.down(); await page.waitForTimeout(100); await page.mouse.up();
    await expect(page.locator('#kills')).toHaveText('0');
    await expect.poll(async () => (await bots())[2].phase, { intervals: [30] }).toBe('hold');
    const target = (await bots())[2];
    await page.evaluate(({ x, z }) => document.dispatchEvent(new MouseEvent('mousemove', {
      movementX: Math.atan2(x, 8 - z) * 180 / Math.PI / (0.07 * 0.35),
    })), target);
    await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up();
    await expect(page.locator('#kills')).toHaveText('1');
  } else {
    await page.mouse.down(); await page.waitForTimeout(160); await page.mouse.up();
  }
  await page.evaluate(() => document.exitPointerLock()); await expect(page.locator('#pause-dialog')).toBeVisible();
  const paused = await bots(); await page.waitForTimeout(300); expect(await bots()).toEqual(paused);
  await page.locator('#resume').click();
  await expect.poll(async () => (await bots()).some((t: {speed:number}) => t.speed > 0.2)).toBe(true);
  await page.evaluate(() => document.exitPointerLock()); await page.locator('#finish').click();
  await expect(page.locator('#result-stats')).toContainText('动靶命中率');
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('range-history')!));
  expect(history[0].botMode).toBe(mode); expect(history[0].targetStats).toHaveLength(2);
  await page.screenshot({ path: `test-results/bots-${mode}-results.png` });
  expect(errors).toEqual([]);
});
test('desktop range renders, settings persist and precision session pauses and saves', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page); expect(await canvasColors(page)).toBeGreaterThan(30);
  await page.screenshot({ path: 'test-results/desktop-lobby.png' });
  await page.getByRole('button', { name: '训练设置', exact: true }).click();
  await page.locator('input[name=sensitivity]').fill('0.42'); await page.locator('input[name=sensitivity]').dispatchEvent('input');
  await page.locator('#settings-dialog .close').click(); await page.reload(); await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  expect(await page.locator('input[name=sensitivity]').inputValue()).toBe('0.42');
  await page.locator('input[value=precision]').check({ force: true });
  await page.locator('#start').click();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await page.mouse.down(); await page.waitForTimeout(380); await page.mouse.up();
  expect(Number(await page.locator('#scene').getAttribute('data-shots'))).toBeGreaterThanOrEqual(2);
  expect(Number(await page.locator('#kills').textContent())).toBeGreaterThanOrEqual(1);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(350); await page.keyboard.up('KeyD'); await page.waitForTimeout(180);
  const position = JSON.parse((await page.locator('#scene').getAttribute('data-position'))!); expect(position.x).toBeGreaterThan(0.5);
  await page.keyboard.press('KeyR'); await expect(page.locator('#weapon-state')).toContainText('换弹中');
  await page.waitForTimeout(2700); await expect(page.locator('#ammo')).toHaveText('25');
  await page.screenshot({ path: 'test-results/desktop-playing.png' });
  await page.evaluate(() => document.exitPointerLock()); await expect(page.locator('#pause-dialog')).toBeVisible();
  const elapsed = await page.locator('#scene').getAttribute('data-elapsed'); await page.waitForTimeout(400); expect(await page.locator('#scene').getAttribute('data-elapsed')).toBe(elapsed);
  await page.locator('#finish').click(); await expect(page.locator('#results-dialog')).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop-results.png' });
  await page.locator('#results-dialog .close').click(); await page.locator('#history').click(); await expect(page.locator('.history-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('mobile renders nonblank scene and accessible settings without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await ready(page);
  expect(await canvasColors(page)).toBeGreaterThan(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-lobby.png' });
  await page.locator('#settings').click(); await expect(page.locator('#settings-dialog')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-settings.png' });
});
test('clearing mode changes scene, and rapid fire reloads an empty magazine', async ({ page }) => {
  await ready(page); await page.locator('input[value=peek]').check({ force: true });
  await page.screenshot({ path: 'test-results/peek-lobby.png' });
  await page.locator('#start').click(); await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await page.mouse.down(); await page.waitForTimeout(3100); await page.mouse.up();
  await expect(page.locator('#ammo')).toHaveText('0'); await expect(page.locator('#weapon-state')).toContainText('换弹中');
  await page.waitForTimeout(2700); await expect(page.locator('#ammo')).toHaveText('25');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW'); await page.waitForTimeout(180);
  const position = JSON.parse((await page.locator('#scene').getAttribute('data-position'))!);
  expect(position.z).toBeGreaterThan(-1); expect(position.z).toBeLessThan(1);
  expect(Number(await page.locator('#kills').textContent())).toBe(0);
  await page.screenshot({ path: 'test-results/peek-playing.png' });
  await page.evaluate(() => document.exitPointerLock()); await page.locator('#finish').click(); await expect(page.locator('#result-mode')).toContainText('预瞄清角');
});
test('local sound import is decoded and can be reset', async ({ page }) => {
  await ready(page); await page.locator('#settings').click();
  const buffer = Buffer.alloc(44 + 4410 * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(44100, 24); buffer.writeUInt32LE(88200, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(8820, 40);
  for (let i = 0; i < 4410; i++) buffer.writeInt16LE(Math.round(Math.sin(i / 20) * 5000 * (1 - i / 4410)), 44 + i * 2);
  await page.locator('#sample-file').setInputFiles({ name: 'test-shot.wav', mimeType: 'audio/wav', buffer });
  await expect(page.locator('#sample-name')).toHaveText('test-shot.wav');
  await page.locator('#clear-sample').click(); await expect(page.locator('#sample-name')).toHaveText('狂徒 · 参考录音');
});
test('Vandal spray climbs above the crosshair and plays recorded shots at firing cadence', async ({ page }) => {
  await page.addInitScript(() => {
    const captured: { time: number; duration: number; peak: number }[] = [];
    (window as unknown as { audioStarts: typeof captured }).audioStarts = captured;
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof original>) {
      if (this.buffer && this.buffer.duration > 0.5) {
        captured.push({ time: args[0] ?? this.context.currentTime, duration: this.buffer.duration,
          peak: Math.max(...this.buffer.getChannelData(0).map(Math.abs)) });
      }
      return original.apply(this, args);
    };
  });
  await ready(page); await page.locator('input[value=precision]').check({ force: true });
  await page.locator('#settings').click(); await page.locator('#preview-sample').click();
  await expect(page.locator('#sample-name')).toHaveText('狂徒 · 参考录音');
  await page.locator('#settings-dialog .close').click(); await page.locator('#start').click();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await page.mouse.down();
  await expect.poll(async () => Number(await page.locator('#scene').getAttribute('data-shots')),
    { timeout: 8000, intervals: [40] }).toBeGreaterThanOrEqual(16);
  await page.mouse.up();
  const recoil = JSON.parse((await page.locator('#scene').getAttribute('data-recoil'))!);
  expect(recoil.y - recoil.view.y).toBeGreaterThan(0.045);
  const shots = JSON.parse((await page.locator('#scene').getAttribute('data-shot-log'))!) as {time:number;spread:number}[];
  expect(shots.length).toBeGreaterThan(14); expect(shots.length).toBeLessThanOrEqual(20);
  expect(shots[0].spread).toBeCloseTo(0.25 * Math.PI / 180, 7);
  expect(shots.at(-1)!.spread).toBeCloseTo(Math.PI / 180, 5);
  const rate = (shots.length - 1) / (shots.at(-1)!.time - shots[0].time); expect(rate).toBeCloseTo(9.75, 1);
  await page.screenshot({ path: 'test-results/vandal-spray.png' });
  await page.waitForTimeout(800); await expect(page.locator('#weapon-state')).toHaveText('首发就绪');
  const sounds = await page.evaluate(() => (window as unknown as {audioStarts:{time:number;duration:number;peak:number}[]}).audioStarts);
  expect(sounds.length).toBeGreaterThan(14); expect(sounds.every(s => s.duration > 0.8 && s.duration < 0.85 && s.peak > 0.4 && s.peak < 0.9)).toBe(true);
  await page.evaluate(() => document.exitPointerLock()); await page.locator('#finish').click();
});
test('missing reference audio falls back to a usable synthetic Vandal sound', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/audio/vandal/*.wav', route => route.abort()); await ready(page);
  await page.locator('#settings').click(); await page.locator('#preview-sample').click();
  await expect(page.locator('#sample-name')).toHaveText('狂徒 · 合成'); expect(errors).toEqual([]);
});
test('stationary shooting cannot score in stop mode and timer finishes automatically', async ({ page }) => {
  test.setTimeout(90000);
  await ready(page); await page.locator('#start').click(); await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up();
  await expect(page.locator('#feedback')).toContainText('先完成横移'); await expect(page.locator('#kills')).toHaveText('0');
  await expect(page.locator('#results-dialog')).toBeVisible({ timeout: 75000 });
  await expect(page.locator('#result-mode')).toContainText('60 秒'); expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
});
