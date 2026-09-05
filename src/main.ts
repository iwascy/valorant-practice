import './style.css';
import './training.css';
import { createIcons, Zap, Crosshair, ChartNoAxesCombined, Volume2, VolumeX, Settings2, Maximize, MoveHorizontal, ScanLine, CornerUpRight, Play, ArrowUpRight, Layers2, Pause, X, RotateCcw, Upload } from 'lucide';
import { RangeScene } from './scene';
import { Game } from './game';
import { GunAudio } from './audio';
import { DEFAULTS, names, sanitizeSettings, summarize, WEAPON, type Mode, type Session, type Settings } from './model';
import { summarizeFlashes } from './flash';
import { botNames, summarizeTargets, type BotMode } from './bots';
import { summarizeReaim } from './reaim';
import { defaultCrosshair, parseCrosshair, drawCrosshair } from './crosshair';
import { allowedBots, configKey, effectiveSettings, projectDefaults, projectKeys, readPreferences, sanitizeProject, type ProjectConfig } from './preferences';
import { installLocale, setLanguage } from './i18n';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
$('settings-form').append($<HTMLTemplateElement>('global-fields').content);
for (const name of ['recoil', 'assist']) $('project-form').insertBefore(document.querySelector(`input[name=${name}]`)!.closest('label')!, $('reset-project'));
$('settings-dialog').querySelector('h2')!.textContent = '全局设置';
$('settings').title = '全局设置'; $('settings').setAttribute('aria-label', '全局设置');
document.querySelector('.lobby-bottom span')!.textContent = '同条件最佳命中率';
const icons = { Zap, Crosshair, ChartNoAxesCombined, Volume2, VolumeX, Settings2, Maximize, MoveHorizontal, ScanLine, CornerUpRight, Play, ArrowUpRight, Layers2, Pause, X, RotateCcw, Upload };
const refreshIcons = () => createIcons({ icons }); refreshIcons();
function load(key: string): unknown { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } }
function save(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('浏览器存储不可用，本次成绩仅在当前页面保留'); } }
const preferences = readPreferences(load('range-preferences'), load('range-settings'), navigator.language);
let settings = effectiveSettings(preferences, selectedMode());
installLocale(preferences.language);
let crosshair = defaultCrosshair(settings.crosshairSize);
const crosshairCanvas = document.createElement('canvas'); crosshairCanvas.setAttribute('aria-label', '准星'); $('crosshair').replaceChildren(crosshairCanvas);
interface RecordEntry { mode: Mode; date: string; accuracy: number; kills: number; shots: number; recoil: number; difficulty: string; profile?: string; flashStats?: ReturnType<typeof summarizeFlashes>; blindSeconds?: number;
  config?: ProjectConfig; configKey?: string; botMode?: BotMode; targetStats?: ReturnType<typeof summarizeTargets>; reaimStats?: ReturnType<typeof summarizeReaim> }
const rawHistory = load('range-history');
let history: RecordEntry[] = Array.isArray(rawHistory) ? rawHistory.filter((r): r is RecordEntry => !!r && typeof r === 'object' && Object.hasOwn(names, r.mode) && typeof r.date === 'string' && Number.isFinite(Date.parse(r.date)) && Number.isFinite(r.accuracy) && r.accuracy >= 0 && r.accuracy <= 100 && Number.isFinite(r.kills) && Number.isFinite(r.shots)).slice(0, 30) : [];
let game: Game;
let feedbackUntil = 0, hitUntil = 0, toastTimeout = 0;
let initialized = false;
let importedSample = false;
const startButton = $<HTMLButtonElement>('start'); startButton.disabled = true;
function toast(message: string) { $('toast').textContent = message; $('toast').style.display = 'block'; clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => $('toast').style.display = 'none', 4500); }
function modal(id: string) { const d = $<HTMLDialogElement>(id); if (!d.open) d.showModal(); }
function closeDialogs() { document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d => d.close()); }
function best() { const key = configKey(selectedMode(), preferences.projects[selectedMode()]); const value = history.filter(r => r.shots >= 10 && r.profile === WEAPON.profile && r.configKey === key).reduce((max, r) => Math.max(max, r.accuracy), -1); $('best').textContent = value < 0 ? '--%' : `${value}%`; }
best();
function selectedMode() { return (document.querySelector<HTMLInputElement>('input[name=mode]:checked')?.value ?? 'stop') as Mode; }
function applySettings() {
  const mode = selectedMode(), config = preferences.projects[mode];
  settings = effectiveSettings(preferences, mode);
  $<HTMLSelectElement>('language').value = preferences.language;
  $<HTMLSelectElement>('duration').value = String(config.duration); $<HTMLSelectElement>('difficulty').value = config.difficulty;
  $('difficulty').closest('label')!.hidden = mode === 'peek' && config.botMode === 'peek';
  $('project-title').textContent = names[mode];
  $('project-summary').textContent = `${names[mode]} · 项目配置`;
  const select = document.querySelector<HTMLSelectElement>('select[name=botMode]')!;
  select.replaceChildren(...allowedBots[mode].map(value => new Option(mode === 'peek' ? value === 'static' ? '主动清角' : '架枪等出角' : botNames[value], value)));
  $('peek-side-field').hidden = $('peek-interval-field').hidden = settings.botMode !== 'peek';
  document.querySelector<HTMLSelectElement>('select[name=peekSide]')!.value = config.peekSide;
  document.querySelector<HTMLInputElement>('input[name=peekInterval]')!.value = String(config.peekInterval);
  $('peekInterval-value').textContent = `${config.peekInterval.toFixed(1)} s`;
  for (const key of ['botSpeed', 'botRange']) {
    const input = document.querySelector<HTMLInputElement>(`input[name=${key}]`)!;
    input.max = mode === 'stop' ? '1.5' : key === 'botSpeed' ? '5.4' : '4';
    input.closest('label')!.hidden = settings.botMode === 'static' || key === 'botRange' && settings.botMode === 'peek';
  }
  document.documentElement.style.setProperty('--cross-size', `${settings.crosshairSize}px`);
  const imported = settings.crosshairCode ? parseCrosshair(settings.crosshairCode) : null;
  crosshair = imported?.config ?? defaultCrosshair(settings.crosshairSize);
  $<HTMLTextAreaElement>('crosshair-code').value = settings.crosshairCode;
  $('crosshair-status').textContent = imported ? ['已导入腰射准星', ...imported.warnings].join(' · ') : '默认准星';
  drawCrosshair($<HTMLCanvasElement>('crosshair-preview'), crosshair, 0, 0, 160); drawCrosshair(crosshairCanvas, crosshair);
  if (game) { game.settings = settings; game.range.resize(settings.fov, !!game.session); game.audio.volume(game.muted ? 0 : settings.volume); }
  if (initialized && !game.session) previewRange();
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    if (key === 'crosshairCode') continue;
    if (key === 'botMode') { document.querySelector<HTMLSelectElement>('select[name=botMode]')!.value = settings.botMode; continue; }
    const input = document.querySelector<HTMLInputElement>(`input[name=${key}]`)!;
    if (key === 'assist' || key === 'flashEnabled' || key === 'infiniteAmmo') input.checked = settings[key];
    else { input.value = String(settings[key]); $(`${key}-value`).textContent = key === 'fov' ? `${settings[key]}°` : key === 'volume' ? `${Math.round(settings[key] * 100)}%` : String(settings[key]); }
  }
  document.querySelector<HTMLInputElement>('input[name=crosshairSize]')!.disabled = !!settings.crosshairCode;
  document.querySelector<HTMLInputElement>('input[name=botRange]')!.disabled = settings.botMode === 'peek' || settings.botMode === 'static';
  document.querySelector<HTMLInputElement>('input[name=botSpeed]')!.disabled = settings.botMode === 'static';
  $('botSpeed-value').textContent = `${settings.botSpeed.toFixed(2)} m/s`;
  $('botRange-value').textContent = settings.botMode === 'peek' ? '随机出角距离' : `${settings.botRange.toFixed(1)} m`;
  if (!game?.session) { $('ammo').textContent = settings.infiniteAmmo ? '∞' : '25'; document.querySelector('.weapon-meta small')!.textContent = settings.infiniteAmmo ? '9.75 RPS · ∞ ROUNDS' : '9.75 RPS · 25 ROUNDS'; }
  best();
}
function persist() { save('range-preferences', preferences); }
applySettings();
async function enter(resume = false) {
  if (!initialized) return;
  if (matchMedia('(pointer: coarse)').matches) { toast('训练需要桌面浏览器、鼠标与键盘'); return; }
  closeDialogs();
  if (!resume) game.start(selectedMode(), $<HTMLSelectElement>('difficulty').value, Number($<HTMLSelectElement>('duration').value), preferences.projects[selectedMode()]);
  document.body.classList.add('playing'); $('hud').hidden = false;
  try {
    // Pointer lock must be requested directly from the user gesture, before awaiting audio setup.
    const locked = game.range.renderer.domElement.requestPointerLock();
    game.audio.init().then(() => {
      game.audio.volume(game.muted ? 0 : settings.volume);
      if (!importedSample) $('sample-name').textContent = game.audio.sourceName;
    }).catch(() => toast('音频暂不可用，训练可以继续'));
    await locked;
  } catch {
    game.pause(); modal('pause-dialog'); toast('未能锁定鼠标，请点击继续训练重试');
  }
}
startButton.addEventListener('click', () => void enter());
$('resume').addEventListener('click', () => void enter(true));
$('retry').addEventListener('click', () => void enter());
$('finish').addEventListener('click', () => { closeDialogs(); game.finish(); });
document.addEventListener('pointerlockchange', () => {
  if (!game?.session) return;
  if (document.pointerLockElement === game.range.renderer.domElement) { closeDialogs(); game.resume(); }
  else { game.pause(); nextHud = 0; update(); modal('pause-dialog'); }
});
document.addEventListener('pointerlockerror', () => { if (game?.session) { game.pause(); modal('pause-dialog'); } });
$<HTMLDialogElement>('pause-dialog').addEventListener('cancel', event => event.preventDefault());
document.querySelectorAll<HTMLButtonElement>('.close').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));
$('settings').addEventListener('click', () => modal('settings-dialog'));
$('project-settings').addEventListener('click', () => modal('project-dialog'));
$('language').addEventListener('change', () => {
  preferences.language = $<HTMLSelectElement>('language').value === 'en' ? 'en' : 'zh-CN';
  setLanguage(preferences.language); persist();
});
$('settings-form').addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (!Object.hasOwn(DEFAULTS, input.name)) return;
  settings = sanitizeSettings({ ...settings, [input.name]: input.name === 'botMode' ? input.value : input.type === 'checkbox' ? input.checked : Number(input.value) });
  preferences.global = { ...preferences.global, [input.name]: settings[input.name as keyof Settings] }; applySettings(); persist();
});
$('project-form').addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  const key = input.name || input.id;
  if (![...projectKeys, 'duration', 'difficulty', 'peekSide', 'peekInterval'].includes(key)) return;
  const value = key === 'botMode' || key === 'difficulty' || key === 'peekSide' ? input.value : input.type === 'checkbox' ? input.checked : Number(input.value);
  preferences.projects[selectedMode()] = sanitizeProject(selectedMode(), { ...preferences.projects[selectedMode()], [key]: value });
  applySettings(); persist();
});
$('project-form').addEventListener('submit', event => event.preventDefault());
$('reset-project').addEventListener('click', () => { preferences.projects[selectedMode()] = projectDefaults(selectedMode()); applySettings(); persist(); });
$('settings-form').addEventListener('submit', event => event.preventDefault());
$('import-crosshair').addEventListener('click', () => {
  const code = $<HTMLTextAreaElement>('crosshair-code').value.trim();
  try { parseCrosshair(code); preferences.global.crosshairCode = code; applySettings(); persist(); }
  catch (error) { $('crosshair-status').textContent = error instanceof Error ? error.message : '分享码无效'; }
});
$('reset-crosshair').addEventListener('click', () => { preferences.global.crosshairCode = ''; applySettings(); persist(); });
$('reset-settings').addEventListener('click', () => { preferences.global = readPreferences(null, null).global; applySettings(); persist(); });
$('sample-file').addEventListener('change', async event => {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file || !game) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('音频文件不能超过 5 MB');
    await game.audio.importSample(await file.arrayBuffer()); game.audio.volume(game.muted ? 0 : settings.volume);
    importedSample = true; $('sample-name').dataset.noI18n = ''; $('sample-name').textContent = file.name; toast('已载入单发枪声，仅用于当前页面');
  } catch (error) { toast(error instanceof Error ? error.message : '无法解码此音频文件'); }
  input.value = '';
});
$('clear-sample').addEventListener('click', () => { game?.audio.clearSample(); importedSample = false; delete $('sample-name').dataset.noI18n; $('sample-name').textContent = game?.audio.sourceName ?? '狂徒 · 参考录音'; });
$('preview-sample').addEventListener('click', async () => {
  if (!game) return;
  try {
    await game.audio.init(); game.audio.volume(game.muted ? 0 : settings.volume); game.audio.shot();
    if (!importedSample) $('sample-name').textContent = game.audio.sourceName;
  } catch { toast('音频暂不可用'); }
});
$('sound').addEventListener('click', () => {
  if (!game) return; game.muted = !game.muted; game.audio.volume(game.muted ? 0 : settings.volume);
  const icon = document.createElement('i'); icon.dataset.lucide = game.muted ? 'volume-x' : 'volume-2'; $('sound').replaceChildren(icon); refreshIcons();
  $('sound').title = game.muted ? '取消静音' : '静音'; $('sound').setAttribute('aria-label', $('sound').title);
});
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('当前浏览器不支持全屏'); }
});
$('history').addEventListener('click', () => {
  const list = $('history-list'); list.replaceChildren();
  if (!history.length) { const p = document.createElement('p'); p.textContent = '暂无训练记录'; list.append(p); }
  for (const record of history) {
    const row = document.createElement('div'); row.className = 'history-row';
    const name = document.createElement('span'); name.textContent = names[record.mode];
    const date = document.createElement('small'); date.textContent = `${new Date(record.date).toLocaleString(preferences.language)} · ${record.kills} 击杀 · ${record.shots} 发 · ${record.profile === WEAPON.profile ? '狂徒' : '旧版'}`;
    if (record.config) date.textContent += ` · ${configDescription(sanitizeProject(record.mode, record.config))}`;
    else date.textContent += ' · 旧版配置';
    if (record.flashStats && Number.isFinite(record.flashStats.total)) date.textContent += ` · 背闪 ${record.flashStats.back}/${record.flashStats.total} · 致盲 ${(typeof record.blindSeconds === 'number' && Number.isFinite(record.blindSeconds) ? record.blindSeconds : 0).toFixed(1)}s`;
    if (record.botMode && Object.hasOwn(botNames, record.botMode)) date.textContent += ` · ${behaviorName(record.mode, record.botMode)}`;
    if (Array.isArray(record.targetStats)) for (const stats of record.targetStats) {
      if (stats && typeof stats.moving === 'boolean' && Number.isFinite(stats.accuracy)) date.textContent += ` · ${stats.moving ? '动靶' : '静靶'} ${stats.accuracy}%`;
    }
    if (record.reaimStats && Number.isFinite(record.reaimStats.aim)) date.textContent += ` · 回瞄 ${record.reaimStats.aim}ms`;
    const accuracy = document.createElement('strong'); accuracy.textContent = `${record.accuracy}%`; row.append(name, date, accuracy); list.append(row);
  }
  modal('history-dialog');
});
function previewRange() { game.range.setMode(selectedMode(), $<HTMLSelectElement>('difficulty').value); game.range.configureBots(settings.botMode); }
document.querySelectorAll('input[name=mode]').forEach(input => input.addEventListener('change', () => applySettings()));
$('difficulty').addEventListener('change', () => { if (initialized) previewRange(); });
window.addEventListener('resize', () => { if (game) game.range.resize(settings.fov, !!game.session); });
function configDescription(config: ProjectConfig) {
  const movement = config.botMode === 'static' ? '' : ` · ${config.botSpeed.toFixed(2)} m/s` + (config.botMode === 'peek'
    ? ` · ${{ random: '随机两侧', left: '左侧', right: '右侧' }[config.peekSide]} · ${config.peekInterval.toFixed(1)} s`
    : ` · ${config.botRange.toFixed(1)} m`);
  return `${config.duration} 秒 · ${{ easy: '入门', normal: '标准', hard: '进阶' }[config.difficulty]} · ${config.infiniteAmmo ? '无限弹匣' : '标准弹匣'} · ${config.flashEnabled ? '闪光开启' : '闪光关闭'}${movement} · 后坐力 ${config.recoil} · ${config.assist ? '提示开启' : '提示关闭'}`;
}
function behaviorName(mode: Mode, bot: BotMode) { return mode === 'peek' ? bot === 'peek' ? '架枪等出角' : '主动清角' : botNames[bot]; }
function results(session: Session) {
  document.body.classList.remove('playing'); $('hud').hidden = true; closeDialogs();
  const stats = summarize(session);
  const flashStats = summarizeFlashes(session.flashes ?? []);
  const targetStats = summarizeTargets(session.targetShots ?? [], session.targetKills ?? []), reaimStats = summarizeReaim(session.reaim ?? []);
  history.unshift({ mode: session.mode, date: session.date, accuracy: stats.accuracy, kills: session.kills, shots: stats.shots, recoil: session.config?.recoil ?? settings.recoil, difficulty: session.config?.difficulty ?? 'normal', profile: WEAPON.profile,
    config: session.config, configKey: session.config ? configKey(session.mode, session.config) : undefined,
    flashStats: session.flashEnabled ? flashStats : undefined, blindSeconds: session.blindSeconds, botMode: session.botMode, targetStats, reaimStats });
  history = history.slice(0, 30); save('range-history', history); best();
  $('result-mode').textContent = `${names[session.mode]} · ${behaviorName(session.mode, session.botMode ?? 'static')} · ${Math.round(session.elapsed)} 秒 · ${stats.shots} 发射击`;
  if (session.config) $('result-mode').textContent += ` · ${configDescription(session.config)}`;
  const peeks = session.peekErrors ?? [], peekAverage = peeks.length ? peeks.reduce((a, b) => a + b, 0) / peeks.length : null;
  const clearing = session.mode === 'peek' && session.botMode !== 'peek';
  const metrics = [['命中率', `${stats.accuracy}%`], ['击杀', String(session.kills)], ['头部命中', String(stats.headshots)], ['停稳射击', `${stats.clean}%`], ['过早开枪', String(stats.early)], clearing ? ['出角偏差', peekAverage === null ? '--' : `${peekAverage.toFixed(1)}°`] : ['停稳后开枪', stats.delay === null ? '--' : `${stats.delay} ms`]];
  $('result-stats').replaceChildren();
  for (const group of targetStats) {
    const label = group.moving ? '动靶' : '静靶';
    metrics.push([`${label}射击数`, String(group.shots)], [`${label}命中率`, group.accuracy === null ? '--' : `${group.accuracy}%`],
      [`${label}爆头占比`, group.headRate === null ? '--' : `${group.headRate}%`], [`${label}击杀`, String(group.kills)], [`${label}交战耗时`, group.ttk === null ? '--' : `${group.ttk} ms`]);
  }
  metrics.push(['未归属射击', String(stats.shots - (session.targetShots?.length ?? 0))]);
  if (session.flashEnabled) metrics.push(['闪光次数', String(flashStats.total)], ['背闪成功', String(flashStats.back)],
    ['未躲过', String(flashStats.hit)], ['掩体阻挡', String(flashStats.blocked)],
    ['背闪成功率', flashStats.rate === null ? '--' : `${flashStats.rate}%`],
    ['平均背闪反应', flashStats.reaction === null ? '--' : `${flashStats.reaction} ms`],
    ['累计致盲', `${(session.blindSeconds ?? 0).toFixed(1)} s`]);
  if (session.flashEnabled) metrics.push(['背闪回瞄样本', String(reaimStats.total)], ['重新瞄准完成', String(reaimStats.acquired)],
    ['平均重新瞄准', reaimStats.aim === null ? '--' : `${reaimStats.aim} ms`], ['回瞄首发样本', String(reaimStats.firstShots)],
    ['回瞄首发命中率', reaimStats.firstHit === null ? '--' : `${reaimStats.firstHit}%`], ['背闪后击杀', String(reaimStats.kills)],
    ['背闪后击杀耗时', reaimStats.kill === null ? '--' : `${reaimStats.kill} ms`], ['未完成击杀', String(reaimStats.unfinished)]);
  for (const [label, value] of metrics) { const div = document.createElement('div'), small = document.createElement('small'), b = document.createElement('b'); small.textContent = label; b.textContent = value; div.append(small, b); $('result-stats').append(div); }
  $('insight').textContent = !stats.shots ? '本轮尚未射击。下一轮从一次准确的点射开始。' : stats.early > stats.shots * 0.15 ? `有 ${stats.early} 发在停稳前射出。先放慢节奏，感受减速完成的时机。` : clearing && peekAverage !== null ? `出角时平均需要修正 ${peekAverage.toFixed(1)}°。下一轮将准星提前放在掩体边缘的头线位置。` : stats.accuracy < 60 ? '下一轮减少连射，待首发精度恢复后再开枪。' : '停稳与瞄准表现稳定，可以尝试更远的目标与更快的节奏。';
  const ctx = $<HTMLCanvasElement>('shot-chart').getContext('2d')!;
  ctx.clearRect(0, 0, 560, 180); ctx.strokeStyle = '#7a9d8033'; ctx.lineWidth = 1;
  for (let x = 0; x <= 560; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 180); ctx.stroke(); }
  for (let y = 0; y <= 180; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(560, y); ctx.stroke(); }
  ctx.strokeStyle = '#b3d6b77a'; ctx.beginPath(); ctx.moveTo(280, 0); ctx.lineTo(280, 180); ctx.moveTo(0, 150); ctx.lineTo(560, 150); ctx.stroke();
  const maxAngle = Math.max(0.04, ...session.shots.map(s => Math.max(Math.abs(s.x), Math.abs(s.y))));
  for (const shot of session.shots) { ctx.fillStyle = shot.hit ? '#a7f0cd' : '#f86358'; ctx.beginPath(); ctx.arc(280 + shot.x / maxAngle * 130, 150 - shot.y / maxAngle * 125, 2.5, 0, Math.PI * 2); ctx.fill(); }
  modal('results-dialog');
}
let nextHud = 0;
function update() {
  drawCrosshair(crosshairCanvas, crosshair, Math.max(0, ((game?.speed ?? 0) - WEAPON.accurateSpeed) / (WEAPON.maxSpeed - WEAPON.accurateSpeed)), game?.heat ?? 0);
  const blindOpacity = game.session && game.running ? game.flashTrial.opacity(game.session.elapsed) : 0;
  $('blind-overlay').hidden = blindOpacity === 0;
  $('blind-overlay').style.backgroundColor = `rgba(110, 114, 119, ${blindOpacity})`;
  $('blind-icon').style.opacity = String(Math.min(1, blindOpacity * 3));
  $('blind-remaining').textContent = game.session ? `${Math.max(0, game.flashTrial.blindUntil - game.session.elapsed).toFixed(1)} s` : '';
  const now = performance.now();
  if (now < nextHud) return; nextHud = now + 60;
  $('hitmarker').style.opacity = now < hitUntil ? '1' : '0'; $('feedback').style.opacity = now < feedbackUntil ? '1' : '0';
  if (!game.session) return;
  const session = game.session, stats = summarize(session), remaining = Math.ceil(session.duration - session.elapsed);
  $('timer').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  $('accuracy').textContent = `${stats.accuracy}%`; $('kills').textContent = String(session.kills); $('ammo').textContent = session.config?.infiniteAmmo ? '∞' : String(game.ammo);
  $('movement').textContent = game.speed <= WEAPON.accurateSpeed ? '已停稳' : '移动中'; $('movement').className = game.speed <= WEAPON.accurateSpeed ? 'stable' : 'moving';
  $('weapon-state').textContent = game.reloading > 0 ? `换弹中 ${game.reloading.toFixed(1)}s` : game.heat > 0 ? '精度恢复中' : '首发就绪';
  $('movement').hidden = !session.config?.assist; $('weapon-state').hidden = !session.config?.assist && !game.reloading;
  if (import.meta.env.DEV) {
    $('scene').dataset.bots = JSON.stringify(game.range.targets.map(t => ({ x: t.group.position.x, z: t.group.position.z, speed: t.speed, phase: t.motion.phase, visible: t.group.visible })));
    $('scene').dataset.reaim = JSON.stringify(game.reaimTrial.results);
    $('scene').dataset.shots = String(stats.shots); $('scene').dataset.speed = game.speed.toFixed(2); $('scene').dataset.elapsed = session.elapsed.toFixed(2);
    $('scene').dataset.position = JSON.stringify(game.range.player.translation());
    $('scene').dataset.recoil = JSON.stringify({ x: game.recoilX, y: game.recoilY, view: game.recoil.cameraOffset(), heat: game.heat });
    $('scene').dataset.shotLog = JSON.stringify(session.shots.map(s => ({ time: s.time, spread: s.spread, x: s.x, y: s.y })));
    $('scene').dataset.flash = JSON.stringify({ warning: game.flashTrial.warningAt !== null, nextAt: game.flashTrial.nextAt,
      results: game.flashTrial.results, opacity: blindOpacity, blindSeconds: game.flashTrial.blindSeconds });
  }
}
async function init() {
  try {
    const range = new RangeScene($<HTMLCanvasElement>('scene')); await range.init();
    game = new Game(range, new GunAudio(), settings); game.onFinish = results; game.onUpdate = update;
    previewRange();
    game.onFeedback = (message, head, hit) => { $('feedback').textContent = message; feedbackUntil = performance.now() + 1100; if (hit) { hitUntil = performance.now() + 140; $('hitmarker').classList.toggle('head', !!head); } };
    range.resize(settings.fov, false); game.init();
    await game.audio.prepare(); $('sample-name').textContent = game.audio.sourceName; initialized = true;
    startButton.disabled = false; $('ready').replaceChildren(); const dot = document.createElement('span'); dot.className = 'live-dot'; $('ready').append(dot, matchMedia('(pointer: coarse)').matches ? '桌面键鼠训练 · 可浏览场景与记录' : '训练场就绪');
    $('scene').dataset.ready = 'true';
  } catch (error) { console.error(error); $('ready').textContent = '训练场加载失败，请确认浏览器支持 WebGL 2 后刷新'; toast('训练场未能加载'); }
}
void init();
