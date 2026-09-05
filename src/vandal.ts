import { WEAPON, radians } from './model.ts';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class ShotCadence {
  scheduledAt = 0;
  private next = 0;
  private previous = -Infinity;
  press(now: number) { this.next = Math.max(now, this.previous + WEAPON.interval); }
  take(now: number): boolean {
    if (now + 1e-9 < this.next) return false;
    if (now - this.next > WEAPON.interval) this.next = now;
    this.scheduledAt = this.next;
    this.next += WEAPON.interval;
    this.previous = now;
    return true;
  }
  reset() { this.next = this.scheduledAt = 0; this.previous = -Infinity; }
}

// The magnitudes and interpolation below are approximations, separate from the sourced weapon constants.
export const RECOIL = {
  riseDegrees: [0.48, 0.62, 0.76, 0.85, 0.9, 0.88, 0.77, 0.6, 0.43, 0.26],
  ceilingDegrees: 7.4, horizontalLimitDegrees: 2.3,
  cameraPitchLimitDegrees: 2.1, cameraFraction: 0.55,
  maxRecovery: 0.675, recoveryPerExtraShot: 0.02,
};

export class VandalRecoil {
  x = 0;
  y = 0;
  heat = 0;
  shotCount = 0;
  yawDirection = 0;
  private lastShot = -Infinity;
  private lastSwitch = -Infinity;
  private savedX = 0;
  private savedY = 0;
  private savedHeat = 0;
  private recoveryDuration = WEAPON.recovery;
  private random: () => number;

  constructor(random: () => number = Math.random) { this.random = random; }

  reset() {
    this.x = this.y = this.heat = this.shotCount = this.yawDirection = 0;
    this.savedX = this.savedY = this.savedHeat = 0;
    this.lastShot = this.lastSwitch = -Infinity;
    this.recoveryDuration = WEAPON.recovery;
  }

  recover(now: number) {
    if (this.savedHeat === 0) return;
    const progress = clamp((now - this.lastShot - WEAPON.interval) / (this.recoveryDuration - WEAPON.interval), 0, 1);
    if (progress >= 1) { this.reset(); return; }
    const remaining = 1 - progress * progress * (3 - 2 * progress);
    this.heat = this.savedHeat * (1 - progress);
    this.x = this.savedX * remaining;
    this.y = this.savedY * remaining;
  }

  kick(now: number, strength: number, running: boolean) {
    this.recover(now);
    const index = Math.min(RECOIL.riseDegrees.length - 1, Math.floor(this.heat));
    const rise = RECOIL.riseDegrees[index] * (0.94 + this.random() * 0.12);
    const movementMultiplier = running ? 1.8 : 1;
    this.y = Math.min(radians(RECOIL.ceilingDegrees) * strength * movementMultiplier,
      this.y + radians(rise) * strength * movementMultiplier);
    this.shotCount++;
    this.updateYaw(now, strength);
    this.heat = Math.min(20, this.heat + 1);
    this.savedX = this.x; this.savedY = this.y; this.savedHeat = this.heat;
    this.lastShot = now;
    this.recoveryDuration = Math.min(RECOIL.maxRecovery,
      WEAPON.recovery + Math.max(0, this.heat - 3) * RECOIL.recoveryPerExtraShot);
  }

  private updateYaw(now: number, strength: number) {
    if (this.shotCount <= WEAPON.protectedBullets) {
      this.x += radians((this.random() - 0.5) * 0.035) * strength;
      return;
    }
    if (this.yawDirection === 0) {
      this.yawDirection = this.random() < 0.5 ? -1 : 1;
      this.lastSwitch = now;
    } else if (now - this.lastSwitch >= WEAPON.yawSwitchTime && this.random() < WEAPON.yawSwitchChance) {
      this.yawDirection *= -1;
      this.lastSwitch = now;
    }
    const target = radians(RECOIL.horizontalLimitDegrees * (0.7 + this.random() * 0.3)) * this.yawDirection * strength;
    this.x += (target - this.x) * 0.28;
  }

  cameraOffset() {
    return { x: this.x * 0.3, y: Math.min(this.y * RECOIL.cameraFraction, radians(RECOIL.cameraPitchLimitDegrees)) };
  }
}

export function sampleSpread(angle: number, random: () => number = Math.random) {
  const radius = Math.tan(angle) * Math.sqrt(random());
  const azimuth = random() * Math.PI * 2;
  return { x: Math.cos(azimuth) * radius, y: Math.sin(azimuth) * radius };
}
