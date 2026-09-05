export type Mode = 'stop' | 'precision' | 'peek';
export const names: Record<Mode, string> = { stop: '急停点射', precision: '精准点射', peek: '预瞄清角' };
export const DEFAULTS = { sensitivity: 0.35, fov: 103, recoil: 1, volume: 0.55, crosshairSize: 5, assist: true, flashEnabled: false };
export type Settings = typeof DEFAULTS;
export const LIMITS: Record<string, [number, number]> = { sensitivity: [0.05, 1], fov: [80, 115], recoil: [0.3, 1.5], volume: [0, 1], crosshairSize: [3, 12] };
export function sanitizeSettings(raw: unknown): Settings {
  const result = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return result;
  for (const key of Object.keys(LIMITS) as Exclude<keyof Settings, 'assist' | 'flashEnabled'>[]) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.max(LIMITS[key][0], Math.min(LIMITS[key][1], value));
  }
  if (typeof (raw as Settings).assist === 'boolean') result.assist = (raw as Settings).assist;
  if (typeof (raw as Settings).flashEnabled === 'boolean') result.flashEnabled = (raw as Settings).flashEnabled;
  return result;
}
// Public Vandal hip-fire values and provenance are recorded in docs/vandal-calibration.md.
export const WEAPON = {
  profile: 'vandal-pc-11.08-r1', magazine: 25, interval: 1 / 9.75, reload: 2.5,
  recovery: 0.375, maxSpeed: 5.4, walkSpeed: 3.24, accurateSpeed: 5.4 * 0.275,
  firstSpreadDegrees: 0.25, maxSpreadDegrees: 1,
  walkErrorDegrees: 3, runErrorDegrees: 6,
  protectedBullets: 6, yawSwitchTime: 0.6, yawSwitchChance: 0.1,
  headDamage: 160, bodyDamage: 40, legDamage: 34, targetHealth: 150,
};
export const radians = (degrees: number) => degrees * Math.PI / 180;
export function moveVelocity(current: number, desired: number, dt: number): number {
  const acceleration = desired === 0 ? 42 : Math.sign(current) !== Math.sign(desired) ? 62 : 36;
  const difference = desired - current;
  return current + Math.sign(difference) * Math.min(Math.abs(difference), acceleration * dt);
}
export function spreadAngle(speed: number, heat: number, walking = false): number {
  const maximumSpeed = walking ? WEAPON.walkSpeed : WEAPON.maxSpeed;
  const movement = Math.max(0, Math.min(1, (speed - WEAPON.accurateSpeed) / (maximumSpeed - WEAPON.accurateSpeed)));
  const bloom = Math.pow(Math.max(0, Math.min(1, heat / 9)), 1.7);
  const firing = WEAPON.firstSpreadDegrees + (WEAPON.maxSpreadDegrees - WEAPON.firstSpreadDegrees) * bloom;
  return radians(firing + movement * (walking ? WEAPON.walkErrorDegrees : WEAPON.runErrorDegrees));
}
export interface Shot { hit: boolean; head: boolean; moving: boolean; x: number; y: number; stopDelay: number | null; time?: number; spread?: number }
export interface Session { mode: Mode; shots: Shot[]; kills: number; elapsed: number; duration: number; date: string; peekErrors?: number[]; flashEnabled?: boolean; flashes?: import('./flash').FlashResult[]; blindSeconds?: number }
export function summarize(session: Session) {
  const shots = session.shots;
  const hit = shots.filter(s => s.hit).length;
  const clean = shots.filter(s => !s.moving).length;
  const delays = shots.flatMap(s => s.stopDelay === null ? [] : [s.stopDelay]);
  return { shots: shots.length, hit, accuracy: shots.length ? Math.round(hit / shots.length * 100) : 0, headshots: shots.filter(s => s.head).length, clean: shots.length ? Math.round(clean / shots.length * 100) : 0, early: shots.length - clean, delay: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length * 1000) : null };
}
