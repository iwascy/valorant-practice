import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPreferences, effectiveSettings, sanitizeProject, projectDefaults, configKey } from '../src/preferences.ts';
import { translate } from '../src/i18n.ts';
import { createMotion, stepMotion } from '../src/bots.ts';

test('legacy migration keeps global preferences and restores distinct project defaults', () => {
  const prefs = readPreferences(null, { sensitivity: 0.42, botMode: 'peek', flashEnabled: true }, 'en-US');
  assert.equal(prefs.language, 'en'); assert.equal(prefs.global.sensitivity, 0.42);
  assert.equal(prefs.projects.stop.botMode, 'static'); assert.equal(prefs.projects.precision.flashEnabled, false);
  prefs.projects.precision.botMode = 'mixed'; prefs.projects.precision.infiniteAmmo = true;
  assert.equal(effectiveSettings(prefs, 'stop').infiniteAmmo, false);
  assert.equal(effectiveSettings(prefs, 'precision').infiniteAmmo, true);
  assert.deepEqual(readPreferences(JSON.parse(JSON.stringify(prefs)), null), prefs);
});
test('project validation restricts behaviors and handles malformed persisted settings', () => {
  assert.equal(sanitizeProject('precision', { botMode: 'peek' }).botMode, 'static');
  assert.equal(sanitizeProject('peek', { botMode: 'mixed' }).botMode, 'static');
  const stop = sanitizeProject('stop', { botMode: 'strafe', botSpeed: 5.4, botRange: 4, duration: 2, infiniteAmmo: 'yes' });
  assert.equal(stop.botSpeed, 1.5); assert.equal(stop.botRange, 1.5); assert.equal(stop.duration, 60); assert.equal(stop.infiniteAmmo, false);
  assert.equal(readPreferences({ version: 2, projects: { stop: null }, language: 'xx' }, null, 'zh-TW').language, 'zh-CN');
  const config = projectDefaults('precision');
  assert.notEqual(configKey('precision', config), configKey('precision', { ...config, infiniteAmmo: true }));
});
test('English catalog translates composed results, parser errors and feedback without touching codes', () => {
  assert.equal(translate('精准点射 · 60 秒 · 30 发射击 · 无限弹匣', 'en'), 'Precision · 60 s · 30 shots · Infinite magazine');
  assert.equal(translate('准星字段 c 超出范围', 'en'), 'Crosshair field c is out of range');
  assert.equal(translate('动靶交战耗时', 'en'), 'Moving engagement time');
  assert.equal(translate('换弹中 2.1s', 'en'), 'Reloading 2.1s');
  assert.equal(translate('0;P;c;5', 'en'), '0;P;c;5');
  assert.equal(translate('精准点射', 'zh-CN'), '精准点射');
});
test('peek direction settings constrain actual movement', () => {
  for (const side of ['left', 'right'] as const) {
    const motion = createMotion();
    for (let i = 0; i < 800; i++) {
      stepMotion(motion, 'peek', i / 120, 1 / 120, 3.24, 2, () => 0.5, { side, interval: 2 });
      assert.ok(side === 'left' ? motion.x <= 0 : motion.x >= 0);
    }
  }
});
