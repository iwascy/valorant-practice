import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, WEAPON, moveVelocity, sanitizeSettings, spreadAngle, summarize, radians } from '../src/model.ts';

test('settings reject invalid persistence and clamp valid numeric values', () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULTS);
  const value = sanitizeSettings({ sensitivity: NaN, fov: 200, recoil: -1, assist: false, volume: '1' });
  assert.equal(value.fov, 115); assert.equal(value.recoil, 0.3); assert.equal(value.sensitivity, DEFAULTS.sensitivity); assert.equal(value.assist, false); assert.equal(value.volume, DEFAULTS.volume);
});
test('releasing movement stops in a bounded interval independent of timestep', () => {
  for (const rate of [60, 120, 240]) {
    let speed = WEAPON.maxSpeed;
    for (let i = 0; i < Math.ceil(rate * 0.15); i++) speed = moveVelocity(speed, 0, 1 / rate);
    assert.equal(speed, 0);
  }
  assert.ok(moveVelocity(5, -5, 1 / 120) < moveVelocity(5, 0, 1 / 120));
});
test('Vandal sourced standing, walking and running spread values use degrees converted to radians', () => {
  assert.ok(spreadAngle(5, 0) > spreadAngle(0, 0) * 20);
  assert.ok(spreadAngle(0, 20) > spreadAngle(0, 1));
  assert.equal(spreadAngle(0, 0), radians(0.25));
  assert.equal(spreadAngle(0, 20), radians(1));
  assert.equal(spreadAngle(WEAPON.maxSpeed, 0), radians(6.25));
  assert.equal(spreadAngle(WEAPON.walkSpeed, 0, true), radians(3.25));
  assert.equal(spreadAngle(WEAPON.accurateSpeed, 0), radians(0.25));
  assert.ok(spreadAngle(WEAPON.accurateSpeed + 0.01, 0) > radians(0.25));
});
test('session aggregates hits, early shots and measured stop delays without zero divisions', () => {
  const base = { mode: 'stop' as const, kills: 0, elapsed: 1, duration: 60, date: new Date().toISOString() };
  assert.equal(summarize({ ...base, shots: [] }).accuracy, 0);
  const stats = summarize({ ...base, shots: [
    { hit: true, head: true, moving: false, x: 0, y: 0, stopDelay: 0.12 },
    { hit: false, head: false, moving: true, x: 0, y: 0, stopDelay: null },
  ] });
  assert.equal(stats.accuracy, 50); assert.equal(stats.early, 1); assert.equal(stats.delay, 120); assert.equal(stats.headshots, 1);
});
