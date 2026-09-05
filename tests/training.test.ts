import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCrosshair } from '../src/crosshair.ts';
import { createMotion, stepMotion, summarizeTargets } from '../src/bots.ts';
import { ReaimTrial, summarizeReaim } from '../src/reaim.ts';
import { sanitizeSettings } from '../src/model.ts';

test('crosshair import decodes common static, dot and custom asymmetric profiles', () => {
  const { config } = parseCrosshair('0;P;c;5;h;0;f;0;0l;4;0o;2;0a;1;0f;0;0m;0;1b;0');
  assert.equal(config.color, '#00ffff'); assert.equal(config.outline, false);
  assert.equal(config.lines[0].length, 4); assert.equal(config.lines[0].offset, 2); assert.equal(config.lines[1].enabled, false);
  const dot = parseCrosshair('0;P;c;8;u;FF3300FF;d;1;z;3;0b;0;1b;0').config;
  assert.equal(dot.color, '#FF3300'); assert.equal(dot.dotSize, 3);
  const asymmetric = parseCrosshair('0;s;1;P;0g;1;0v;8;0l;3;0m;1;0s;2;A;c;1;S;c;0');
  assert.equal(asymmetric.config.lines[0].vertical, 8); assert.equal(asymmetric.config.lines[0].independent, true);
  assert.ok(asymmetric.warnings.length);
});
test('crosshair import rejects unsafe or truncated fields and preserves unsupported-field warnings', () => {
  for (const code of ['', '1;P;c;1', '0;P;c', '0;P;c;NaN', '0;P;h;2', '0;P;0l;-1', '0;P;c;8;u;url(x)', '0;P;c;8', '0;P;c;1;c;2']) assert.throws(() => parseCrosshair(code), code);
  assert.match(parseCrosshair('0;P;future;1').warnings.join(), /future/);
  assert.equal(sanitizeSettings({ crosshairCode: '0;P;c;-1', botMode: 'unknown' }).crosshairCode, '');
  assert.equal(sanitizeSettings({ botMode: 'strafe', botSpeed: 100, botRange: -1 }).botSpeed, 5.4);
});
test('motion stays bounded, accelerates gradually and depth never changes lateral position', () => {
  const state = createMotion(); const dt = 1 / 120;
  let previous = 0, max = 0;
  for (let i = 0; i < 1200; i++) {
    stepMotion(state, 'depth', i * dt, dt, 3.24, 2, () => 0.9);
    assert.equal(state.x, 0); assert.ok(Math.abs(state.z) <= 2);
    assert.ok(Math.abs(state.vz - previous) <= 30 * dt + 1e-8); previous = state.vz; max = Math.max(max, state.z);
  }
  assert.ok(max > 1);
  const frozen = { ...state }; stepMotion(state, 'static', 11, dt, 3, 2);
  assert.equal(state.z, frozen.z); assert.equal(state.vz, 0);
});
test('random peek crosses cover edge, holds, returns and waits', () => {
  const state = createMotion(), phases = new Set<string>(); let furthest = 0;
  for (let i = 0; i < 1200; i++) {
    stepMotion(state, 'peek', i / 120, 1 / 120, 3.24, 4, () => 0.5);
    phases.add(state.phase); furthest = Math.max(furthest, state.x); assert.equal(state.z, 0);
  }
  assert.ok(furthest > 2); assert.deepEqual([...phases].sort(), ['hold', 'out', 'return', 'wait']);
});
test('target statistics include misses in the intended movement group and empty samples remain null', () => {
  const stats = summarizeTargets([{ targetMoving: true, hit: false, head: false }, { targetMoving: true, hit: true, head: true }], [{ moving: true, seconds: 0.4 }]);
  assert.equal(stats[0].accuracy, 50); assert.equal(stats[0].headRate, 100); assert.equal(stats[0].ttk, 400);
  assert.equal(stats[1].accuracy, null); assert.equal(stats[1].ttk, null);
});
test('reaim requires held alignment, remembers first miss and ignores replacement target kills', () => {
  const trial = new ReaimTrial(); trial.begin(2, 4, 10);
  trial.step(10.1, true, true); trial.step(10.14, true, false); assert.equal(trial.active!.aim, null);
  trial.step(10.3, true, true); trial.step(10.39, true, true);
  assert.ok(Math.abs(trial.active!.aim! - 0.3) < 1e-8);
  trial.shot(10.4, null, null, false); trial.shot(10.5, 2, 5, true); assert.ok(trial.active);
  trial.shot(10.6, 2, 4, true); assert.equal(trial.active, null);
  assert.deepEqual(summarizeReaim(trial.results), { total: 1, acquired: 1, aim: 300, firstShots: 1, firstHit: 0, kills: 1, kill: 600, unfinished: 0 });
});
test('reaim handles timeout, lost targets, session end and reset without manufacturing success', () => {
  const trial = new ReaimTrial(); trial.begin(0, 1, 0); trial.step(5, true, true);
  assert.equal(trial.results[0].status, 'timeout'); trial.begin(0, 2, 6); trial.step(6.1, false, true);
  assert.equal(trial.results[1].status, 'lost'); trial.begin(1, 1, 7); trial.end('ended');
  assert.equal(summarizeReaim(trial.results).aim, null); assert.equal(summarizeReaim(trial.results).firstHit, null);
  const old = trial.results; trial.reset(); assert.equal(trial.results.length, 0); assert.equal(old.length, 3);
});
