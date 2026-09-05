export interface ReaimResult {
  target: number; generation: number; startedAt: number; aim: number | null; firstShot: boolean | null;
  kill: number | null; status: 'active' | 'killed' | 'timeout' | 'lost' | 'ended';
}
export class ReaimTrial {
  results: ReaimResult[] = [];
  active: ReaimResult | null = null;
  private alignedAt: number | null = null;
  reset() { this.results = []; this.active = null; this.alignedAt = null; }
  begin(target: number, generation: number, now: number) {
    this.end('ended'); this.alignedAt = null;
    this.active = { target, generation, startedAt: now, aim: null, firstShot: null, kill: null, status: 'active' };
    this.results.push(this.active);
  }
  step(now: number, alive: boolean, aligned: boolean) {
    const r = this.active; if (!r) return;
    if (!alive) { this.end('lost'); return; }
    if (now - r.startedAt >= 5) { this.end('timeout'); return; }
    if (aligned) this.alignedAt ??= now; else this.alignedAt = null;
    if (r.aim === null && this.alignedAt !== null && now - this.alignedAt >= 0.08) r.aim = this.alignedAt - r.startedAt;
  }
  shot(now: number, target: number | null, generation: number | null, killed: boolean) {
    const r = this.active; if (!r) return;
    if (now - r.startedAt >= 5) { this.end('timeout'); return; }
    const matched = target === r.target && generation === r.generation;
    r.firstShot ??= matched;
    if (matched && killed) { r.kill = now - r.startedAt; this.end('killed'); }
  }
  end(status: ReaimResult['status']) { if (this.active) this.active.status = status; this.active = null; this.alignedAt = null; }
}
export function summarizeReaim(results: ReaimResult[]) {
  const aims = results.flatMap(r => r.aim === null ? [] : [r.aim]), kills = results.flatMap(r => r.kill === null ? [] : [r.kill]);
  const shots = results.filter(r => r.firstShot !== null);
  const mean = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 1000) : null;
  return { total: results.length, acquired: aims.length, aim: mean(aims), firstShots: shots.length,
    firstHit: shots.length ? Math.round(shots.filter(r => r.firstShot).length / shots.length * 100) : null,
    kills: kills.length, kill: mean(kills), unfinished: results.filter(r => r.kill === null).length };
}
