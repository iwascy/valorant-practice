export const VANDAL_SOUND = { seconds: 0.34, peak: 0.86, variants: 8 };

function noiseGenerator(seed: number) {
  let value = seed | 0;
  return () => {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    return (value >>> 0) / 0x100000000 * 2 - 1;
  };
}

// Original procedural sound design: a dry rifle crack, low-mid blast and short mechanical transients.
export function synthesizeVandalShot(sampleRate: number, seed: number): Float32Array {
  const noise = noiseGenerator(seed || 1);
  const dry = new Float32Array(Math.ceil(sampleRate * VANDAL_SOUND.seconds));
  let low = 0, mid = 0, air = 0, phase = 0;
  const lowRate = 1 - Math.exp(-2 * Math.PI * 620 / sampleRate);
  const midRate = 1 - Math.exp(-2 * Math.PI * 2400 / sampleRate);
  const airRate = 1 - Math.exp(-2 * Math.PI * 7200 / sampleRate);
  for (let i = 0; i < dry.length; i++) {
    const t = i / sampleRate, white = noise();
    low += (white - low) * lowRate; mid += (white - mid) * midRate; air += (white - air) * airRate;
    const attack = Math.min(1, t / 0.00035);
    const crack = (air - mid) * 3.4 * Math.exp(-t / 0.008);
    const blast = (mid - low) * 2.7 * Math.exp(-t / 0.032) + low * 2 * Math.exp(-t / 0.046);
    phase += 2 * Math.PI * (85 + 135 * Math.exp(-t / 0.011)) / sampleRate;
    const pressure = Math.sin(phase) * 0.35 * Math.exp(-t / 0.028);
    const bolt = t > 0.019 ? (air - low) * 0.32 * Math.exp(-(t - 0.019) / 0.007) : 0;
    const casing = t > 0.052 ? (air - mid) * 0.1 * Math.exp(-(t - 0.052) / 0.01) : 0;
    dry[i] = Math.tanh((crack + blast + pressure + bolt + casing) * attack * 1.2);
  }
  const result = new Float32Array(dry.length);
  const firstReflection = Math.round(sampleRate * 0.036), secondReflection = Math.round(sampleRate * 0.074);
  let peak = 0;
  for (let i = 0; i < result.length; i++) {
    result[i] = dry[i] + (i >= firstReflection ? dry[i - firstReflection] * 0.1 : 0)
      + (i >= secondReflection ? dry[i - secondReflection] * 0.035 : 0);
    result[i] *= Math.min(1, (result.length - 1 - i) / (sampleRate * 0.01));
    peak = Math.max(peak, Math.abs(result[i]));
  }
  for (let i = 0; i < result.length; i++) result[i] *= VANDAL_SOUND.peak / Math.max(peak, 0.001);
  return result;
}
