import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON, radians } from '../src/model.ts';
import { ShotCadence, VandalRecoil, sampleSpread } from '../src/vandal.ts';
import { synthesizeVandalShot } from '../src/vandal-sound.ts';
import fs from 'node:fs';

test('25 continuous Vandal shots span 24 / 9.75 seconds at different simulation rates', () => {
  for (const rate of [60, 120, 144, 240]) {
    const cadence = new ShotCadence(), times: number[] = [];
    cadence.press(0);
    for (let tick = 0; times.length < 25; tick++) {
      const time = tick / rate;
      if (cadence.take(time)) times.push(time);
    }
    assert.ok(Math.abs(times[24] - times[0] - 24 / 9.75) < 1 / rate + 1e-9);
    assert.ok(times.slice(1).every((time, i) => time - times[i] >= WEAPON.interval - 1 / rate - 1e-9));
  }
});

test('repeated presses cannot use a stale automatic-fire deadline to shoot too early', () => {
  const cadence = new ShotCadence(); cadence.press(0); assert.ok(cadence.take(0));
  cadence.press(0.18); assert.ok(cadence.take(0.18));
  assert.equal(cadence.take(0.21), false);
  assert.equal(cadence.take(0.28), false);
  assert.ok(cadence.take(0.283));
  cadence.press(0.284); assert.equal(cadence.take(0.29), false);
});

test('six protected bullets precede yaw changes; switches respect the 0.6 second window', () => {
  const recoil = new VandalRecoil(() => 0);
  for (let i = 0; i < 6; i++) { recoil.kick(i * WEAPON.interval, 1, false); assert.equal(recoil.yawDirection, 0); }
  recoil.kick(6 * WEAPON.interval, 1, false); assert.equal(recoil.yawDirection, -1);
  for (let i = 7; i < 12; i++) { recoil.kick(i * WEAPON.interval, 1, false); assert.equal(recoil.yawDirection, -1); }
  recoil.kick(12 * WEAPON.interval, 1, false); assert.equal(recoil.yawDirection, 1);
});

test('eligible yaw switches are probabilistic rather than a fixed sine wave', () => {
  const neverSwitch = new VandalRecoil(() => 0.5);
  for (let i = 0; i < 25; i++) neverSwitch.kick(i * WEAPON.interval, 1, false);
  assert.equal(neverSwitch.yawDirection, 1);
});

test('single-shot recovery completes at 0.375 seconds and short gaps retain spray state', () => {
  const recoil = new VandalRecoil(() => 0.5);
  recoil.kick(0, 1, false); const initial = recoil.y;
  recoil.recover(0.2); assert.ok(recoil.y > 0 && recoil.y < initial);
  recoil.kick(0.2, 1, false); assert.ok(recoil.heat > 1);
  recoil.recover(0.575001); assert.equal(recoil.y, 0); assert.equal(recoil.heat, 0); assert.equal(recoil.shotCount, 0);
});

test('sustained fire rises above the hip-fire crosshair and settles only after recovery', () => {
  const recoil = new VandalRecoil(() => 0.5);
  for (let i = 0; i < 20; i++) recoil.kick(i * WEAPON.interval, 1, false);
  assert.ok(recoil.y > radians(6)); assert.ok(recoil.y < radians(8));
  assert.ok(recoil.y - recoil.cameraOffset().y > radians(3));
  recoil.recover(19 * WEAPON.interval + 0.2); assert.ok(recoil.heat > 0);
  recoil.recover(19 * WEAPON.interval + 0.7); assert.equal(recoil.heat, 0); assert.equal(recoil.x, 0);
});

test('running increases vertical kick by the sourced 1.8 multiplier', () => {
  const standing = new VandalRecoil(() => 0.5), running = new VandalRecoil(() => 0.5);
  standing.kick(0, 1, false); running.kick(0, 1, true);
  assert.ok(Math.abs(running.y / standing.y - 1.8) < 1e-9);
});

test('spread is bounded by the actual cone angle', () => {
  const angle = radians(6.25);
  const sample = sampleSpread(angle, () => 1);
  assert.ok(Math.abs(Math.atan(Math.hypot(sample.x, sample.y)) - angle) < 1e-9);
});

test('fallback sound has a prompt transient, quiet tail and bounded peaks at 44.1 and 48 kHz', () => {
  for (const rate of [44100, 48000]) {
    const data = synthesizeVandalShot(rate, 88217);
    const rms = (start: number, end: number) => {
      const window = data.slice(Math.floor(start * rate), Math.floor(end * rate));
      return Math.sqrt(window.reduce((sum, x) => sum + x * x, 0) / window.length);
    };
    assert.ok(data.every(Number.isFinite)); assert.ok(Math.max(...data.map(Math.abs)) <= 0.861);
    assert.ok(rms(0, 0.01) > 0.05); assert.ok(rms(0.25, 0.33) < rms(0, 0.01) * 0.02);
    assert.equal(Math.abs(data[0]), 0); assert.equal(Math.abs(data.at(-1)!), 0);
    assert.notDeepEqual(data, synthesizeVandalShot(rate, 99318));
  }
});

test('bundled reference shots are small valid WAV files with immediate non-clipped audio', () => {
  for (const index of [1, 2, 3]) {
    const buffer = fs.readFileSync(new URL(`../public/audio/vandal/shot-${index}.wav`, import.meta.url));
    assert.equal(buffer.toString('ascii', 0, 4), 'RIFF'); assert.equal(buffer.toString('ascii', 8, 12), 'WAVE');
    let offset = 12, pcm: Buffer | undefined;
    while (offset + 8 <= buffer.length) {
      const size = buffer.readUInt32LE(offset + 4);
      if (buffer.toString('ascii', offset, offset + 4) === 'data') { pcm = buffer.subarray(offset + 8, offset + 8 + size); break; }
      offset += 8 + size + size % 2;
    }
    assert.ok(pcm); assert.ok(pcm.length > 44100 && pcm.length < 88200);
    let peak = 0, onset = Infinity;
    for (let i = 0; i < pcm.length / 2; i++) { const amplitude = Math.abs(pcm.readInt16LE(i * 2)); peak = Math.max(peak, amplitude); if (amplitude > 1000 && onset === Infinity) onset = i / 44100; }
    assert.ok(peak > 10000 && peak < 32767); assert.ok(onset < 0.01);
  }
});
