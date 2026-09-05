export const FLASH = { fuse: 0.8, fullDuration: 2, backDuration: 0.3, backAngle: 100, minGap: 6, maxGap: 11 };
export interface FlashResult { time: number; angle: number; outcome: 'back' | 'hit' | 'blocked'; duration: number; reaction: number | null }
export function evaluateFlash(angle: number, blocked: boolean) {
  const outcome = blocked ? 'blocked' : angle >= FLASH.backAngle ? 'back' : 'hit';
  const duration = blocked ? 0 : outcome === 'back' ? FLASH.backDuration
    : FLASH.fullDuration - Math.max(0, angle - 45) / (FLASH.backAngle - 45) * (FLASH.fullDuration - FLASH.backDuration);
  return { outcome, duration } as const;
}
export class FlashTrial {
  nextAt = Infinity;
  warningAt: number | null = null;
  blindUntil = 0;
  blindDuration = 0;
  private backSince: number | null = null;
  readonly results: FlashResult[] = [];
  blindSeconds = 0;
  private random: () => number;
  constructor(random = Math.random) { this.random = random; }
  reset(enabled: boolean) {
    this.results.length = 0; this.warningAt = this.backSince = null;
    this.blindUntil = this.blindDuration = this.blindSeconds = 0;
    this.nextAt = enabled ? this.gap() : Infinity;
  }
  private gap() { return FLASH.minGap + this.random() * (FLASH.maxGap - FLASH.minGap); }
  begin(now: number) { this.warningAt = now; this.backSince = null; }
  step(now: number, dt: number, angle: number, blocked: boolean) {
    this.blindSeconds += Math.max(0, Math.min(now, this.blindUntil)
      - Math.max(now - dt, this.blindUntil - this.blindDuration));
    if (this.warningAt === null) return null;
    if (angle >= FLASH.backAngle && !blocked) this.backSince ??= now;
    else this.backSince = null;
    if (now - this.warningAt + 1e-8 < FLASH.fuse) return null;
    const evaluation = evaluateFlash(angle, blocked);
    const result: FlashResult = { ...evaluation, time: now, angle,
      reaction: evaluation.outcome === 'back' && this.backSince !== null ? this.backSince - this.warningAt : null };
    this.results.push(result); this.blindDuration = result.duration; this.blindUntil = now + result.duration;
    this.warningAt = null; this.nextAt = now + result.duration + this.gap();
    return result;
  }
  opacity(now: number) {
    const remaining = this.blindUntil - now;
    if (remaining <= 0 || this.blindDuration === 0) return 0;
    return (this.blindDuration <= FLASH.backDuration ? 0.3 : 0.76) * Math.min(1, remaining / Math.min(0.65, this.blindDuration));
  }
}
export function summarizeFlashes(results: FlashResult[]) {
  const back = results.filter(r => r.outcome === 'back'), hit = results.filter(r => r.outcome === 'hit');
  const reactions = back.flatMap(r => r.reaction === null ? [] : [r.reaction]);
  return { total: results.length, back: back.length, hit: hit.length, blocked: results.length - back.length - hit.length,
    rate: back.length + hit.length ? Math.round(back.length / (back.length + hit.length) * 100) : null,
    reaction: reactions.length ? Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length * 1000) : null };
}
