import { DEFAULTS, sanitizeSettings, type Mode, type Settings } from './model.ts';
import type { BotMode } from './bots.ts';

export type Language = 'zh-CN' | 'en';
export interface ProjectConfig {
  duration: number;
  difficulty: 'easy' | 'normal' | 'hard';
  botMode: BotMode;
  botSpeed: number;
  botRange: number;
  flashEnabled: boolean;
  infiniteAmmo: boolean;
  recoil: number;
  assist: boolean;
  peekSide: 'random' | 'left' | 'right';
  peekInterval: number;
}
export const projectKeys = ['botMode', 'botSpeed', 'botRange', 'flashEnabled', 'infiniteAmmo', 'recoil', 'assist'] as const;
export const allowedBots: Record<Mode, BotMode[]> = {
  stop: ['static', 'strafe'], precision: ['static', 'depth', 'strafe', 'mixed'], peek: ['static', 'peek'],
};
export function projectDefaults(mode: Mode): ProjectConfig {
  return { duration: 60, difficulty: 'normal', botMode: 'static', botSpeed: mode === 'stop' ? 1 : 3.24,
    botRange: mode === 'stop' ? 1 : 2, flashEnabled: false, infiniteAmmo: false, recoil: 1, assist: true, peekSide: 'random', peekInterval: 1.6 };
}
export function sanitizeProject(mode: Mode, raw: unknown): ProjectConfig {
  const base = projectDefaults(mode);
  if (!raw || typeof raw !== 'object') return base;
  const value = raw as Partial<ProjectConfig>, settings = sanitizeSettings({ ...base, ...value });
  for (const key of projectKeys) Object.assign(base, { [key]: settings[key] });
  if (!allowedBots[mode].includes(base.botMode)) base.botMode = 'static';
  if (mode === 'stop') { base.botSpeed = Math.min(base.botSpeed, 1.5); base.botRange = Math.min(base.botRange, 1.5); }
  if ([60, 120, 180].includes(value.duration!)) base.duration = value.duration!;
  if (['easy', 'normal', 'hard'].includes(value.difficulty!)) base.difficulty = value.difficulty!;
  if (mode === 'peek' && base.botMode === 'peek') base.difficulty = 'normal';
  if (['random', 'left', 'right'].includes(value.peekSide!)) base.peekSide = value.peekSide!;
  if (typeof value.peekInterval === 'number' && Number.isFinite(value.peekInterval)) base.peekInterval = Math.max(0.5, Math.min(4, value.peekInterval));
  return base;
}
export interface Preferences {
  version: 2;
  language: Language;
  global: Pick<Settings, 'sensitivity' | 'fov' | 'volume' | 'crosshairSize' | 'crosshairCode'>;
  projects: Record<Mode, ProjectConfig>;
}
export function readPreferences(raw: unknown, legacy: unknown, browserLanguage = 'zh-CN'): Preferences {
  const value = raw && typeof raw === 'object' ? raw as Partial<Preferences> : {};
  const valid = value.version === 2;
  const source = sanitizeSettings(valid ? value.global : legacy);
  const projects = {} as Preferences['projects'];
  for (const mode of ['stop', 'precision', 'peek'] as const) projects[mode] = sanitizeProject(mode, valid ? value.projects?.[mode] : null);
  return { version: 2, language: valid && ['zh-CN', 'en'].includes(value.language!) ? value.language! : browserLanguage.startsWith('zh') ? 'zh-CN' : 'en',
    global: { sensitivity: source.sensitivity, fov: source.fov, volume: source.volume, crosshairSize: source.crosshairSize, crosshairCode: source.crosshairCode }, projects };
}
export function effectiveSettings(preferences: Preferences, mode: Mode): Settings {
  return { ...DEFAULTS, ...preferences.global, ...preferences.projects[mode] };
}
export function configKey(mode: Mode, config: ProjectConfig) {
  return JSON.stringify([mode, config.duration, config.difficulty, config.botMode, config.botSpeed, config.botRange,
    config.flashEnabled, config.infiniteAmmo, config.recoil, config.assist, config.peekSide, config.peekInterval]);
}
