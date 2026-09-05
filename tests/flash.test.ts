import test from 'node:test';
import assert from 'node:assert/strict';
import { FLASH, FlashTrial, evaluateFlash, summarizeFlashes } from '../src/flash.ts';
import { sanitizeSettings } from '../src/model.ts';

test('flash angles shorten exposure, rear view keeps residual blind, cover blocks', () => {
  assert.equal(evaluateFlash(0, false).duration, 2);
  assert.ok(evaluateFlash(80, false).duration < 2);
  assert.equal(evaluateFlash(100, false).outcome, 'back');
  assert.equal(evaluateFlash(180, false).duration, 0.3);
  assert.equal(evaluateFlash(0, true).duration, 0);
  assert.equal(sanitizeSettings({ flashEnabled: 'true' }).flashEnabled, false);
  assert.equal(sanitizeSettings({ flashEnabled: true }).flashEnabled, true);
});
test('explosion uses final angle; turning back too soon fails; timing and reset remain bounded', () => {
  const trial = new FlashTrial(() => 0); trial.reset(true);
  assert.equal(trial.nextAt, 6); trial.begin(6);
  assert.equal(trial.step(6.3, 0.1, 180, false), null);
  const result = trial.step(6.8, 0.1, 0, false)!;
  assert.equal(result.outcome, 'hit'); assert.equal(result.reaction, null);
  assert.equal(trial.opacity(6.8), 0.76); assert.equal(trial.opacity(9), 0);
  trial.step(9, 3, 180, false); assert.ok(Math.abs(trial.blindSeconds - 2) < 1e-6);
  trial.reset(false); assert.equal(trial.nextAt, Infinity); assert.equal(trial.results.length, 0);
  assert.equal(trial.blindSeconds, 0); assert.equal(trial.opacity(0), 0);
});
test('back-flash reaction requires holding until detonation, cover excluded from success rate', () => {
  const trial = new FlashTrial(() => 0); trial.reset(true); trial.begin(6);
  trial.step(6.2, 0.1, 180, false); trial.step(6.3, 0.1, 0, false); trial.step(6.5, 0.1, 180, false);
  const result = trial.step(6 + FLASH.fuse, 0.1, 180, false)!;
  assert.equal(result.reaction, 0.5); assert.equal(result.outcome, 'back');
  trial.begin(15); trial.step(15.8, 0.1, 0, true);
  const summary = summarizeFlashes(trial.results);
  assert.equal(summary.rate, 100); assert.equal(summary.blocked, 1); assert.equal(summary.reaction, 500);
  assert.equal(summarizeFlashes([]).rate, null);
});
