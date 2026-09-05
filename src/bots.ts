export type BotMode = 'static' | 'depth' | 'strafe' | 'mixed' | 'peek';
export const botNames: Record<BotMode, string> = { static: '静止', depth: '随机前后', strafe: '左右横移', mixed: '混合移动', peek: '随机出角' };
export interface BotMotion { x: number; z: number; vx: number; vz: number; goalX: number; goalZ: number; nextAt: number; phase: 'wait' | 'out' | 'hold' | 'return'; }
export function createMotion(): BotMotion { return { x: 0, z: 0, vx: 0, vz: 0, goalX: 0, goalZ: 0, nextAt: 0, phase: 'wait' }; }
export function stepMotion(state: BotMotion, mode: BotMode, now: number, dt: number, speed: number, range: number, random = Math.random) {
  if (mode === 'static') { state.vx = state.vz = 0; return; }
  const arrived = Math.hypot(state.x - state.goalX, state.z - state.goalZ) < 0.02;
  if (mode === 'peek') {
    if (state.phase === 'wait' && now >= state.nextAt) {
      state.goalX = (random() < 0.5 ? -1 : 1) * (2 + random() * 0.65); state.phase = 'out';
    } else if (state.phase === 'out' && arrived) { state.phase = 'hold'; state.nextAt = now + 0.15 + random() * 0.65; }
    else if (state.phase === 'hold' && now >= state.nextAt) { state.goalX = 0; state.phase = 'return'; }
    else if (state.phase === 'return' && arrived) { state.phase = 'wait'; state.nextAt = now + 0.6 + random() * 2; }
  } else if (now >= state.nextAt) {
    const axis = mode === 'mixed' ? (random() < 0.5 ? 'depth' : 'strafe') : mode;
    if (random() < 0.25) {
      state.goalX = Math.max(-range, Math.min(range, state.x + state.vx * Math.abs(state.vx) / 60));
      state.goalZ = Math.max(-range, Math.min(range, state.z + state.vz * Math.abs(state.vz) / 60));
    }
    else if (axis === 'depth') state.goalZ = (random() * 2 - 1) * range;
    else state.goalX = (random() * 2 - 1) * range;
    state.nextAt = now + 0.35 + random() * 1.2;
  }
  const dx = state.goalX - state.x, dz = state.goalZ - state.z, distance = Math.hypot(dx, dz);
  const factor = Math.min(6, speed / Math.max(distance, 1e-9));
  const changeX = dx * factor - state.vx, changeZ = dz * factor - state.vz;
  const acceleration = Math.min(1, 30 * dt / Math.max(Math.hypot(changeX, changeZ), 1e-9));
  state.vx += changeX * acceleration; state.vz += changeZ * acceleration;
  const bound = mode === 'peek' ? 2.65 : range;
  state.x = Math.max(-bound, Math.min(bound, state.x + state.vx * dt));
  state.z = Math.max(-bound, Math.min(bound, state.z + state.vz * dt));
  if (distance < 0.001 && Math.hypot(state.vx, state.vz) < 0.01) { state.x = state.goalX; state.z = state.goalZ; state.vx = state.vz = 0; }
}
export interface TargetShot { targetMoving: boolean; hit: boolean; head: boolean }
export interface TargetKill { moving: boolean; seconds: number }
export function summarizeTargets(shots: TargetShot[], kills: TargetKill[]) {
  return [true, false].map(moving => {
    const group = shots.filter(s => s.targetMoving === moving), hits = group.filter(s => s.hit), deaths = kills.filter(k => k.moving === moving);
    return { moving, shots: group.length, hits: hits.length, accuracy: group.length ? Math.round(hits.length / group.length * 100) : null,
      headRate: hits.length ? Math.round(hits.filter(s => s.head).length / hits.length * 100) : null,
      kills: deaths.length, ttk: deaths.length ? Math.round(deaths.reduce((sum, k) => sum + k.seconds, 0) / deaths.length * 1000) : null };
  });
}
