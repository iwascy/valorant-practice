import './style.css';
import { createIcons, Zap, Crosshair, ChartNoAxesCombined, Volume2, VolumeX, Settings2, Maximize, MoveHorizontal, ScanLine, CornerUpRight, Play, ArrowUpRight, Layers2, Pause, X, RotateCcw, Upload } from 'lucide';
import { RangeScene } from './scene';
import { Game } from './game';
import { GunAudio } from './audio';
import { DEFAULTS, names, sanitizeSettings, summarize, WEAPON, type Mode, type Session, type Settings } from './model';
import { summarizeFlashes } from './flash';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const icons = { Zap, Crosshair, ChartNoAxesCombined, Volume2, VolumeX, Settings2, Maximize, MoveHorizontal, ScanLine, CornerUpRight, Play, ArrowUpRight, Layers2, Pause, X, RotateCcw, Upload };
const refreshIcons = () => createIcons({ icons }); refreshIcons();
function load(key: string): unknown { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } }
function save(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('浏览器存储不可用，本次成绩仅在当前页面保留'); } }
let settings = sanitizeSettings(load('range-settings'));
interface RecordEntry { mode: Mode; date: string; accuracy: number; kills: number; shots: number; recoil: number; difficulty: string; profile?: string; flashStats?: ReturnType<typeof summarizeFlashes>; blindSeconds?: number }
const rawHistory = load('range-history');
let history: RecordEntry[] = Array.isArray(rawHistory) ? rawHistory.filter((r): r is RecordEntry => !!r && typeof r === 'object' && Object.hasOwn(names, r.mode) && typeof r.date === 'string' && Number.isFinite(Date.parse(r.date)) && Number.isFinite(r.accuracy) && r.accuracy >= 0 && r.accuracy <= 100 && Number.isFinite(r.kills) && Number.isFinite(r.shots)).slice(0, 30) : [];
let game: Game;
let feedbackUntil = 0, hitUntil = 0, toastTimeout = 0;
let initialized = false;
const startButton = $<HTMLButtonElement>('start'); startButton.disabled = true;
function toast(message: string) { $('toast').textContent = message; $('toast').style.display = 'block'; clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => $('toast').style.display = 'none', 4500); }
function modal(id: string) { const d = $<HTMLDialogElement>(id); if (!d.open) d.showModal(); }
function closeDialogs() { document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d => d.close()); }
function best() { const value = history.filter(r => r.shots >= 10 && r.profile === WEAPON.profile).reduce((max, r) => Math.max(max, r.accuracy), -1); $('best').textContent = value < 0 ? '--%' : `${value}%`; }
best();
function selectedMode() { return (document.querySelector<HTMLInputElement>('input[name=mode]:checked')?.value ?? 'stop') as Mode; }
function applySettings() {
  document.documentElement.style.setProperty('--cross-size', `${settings.crosshairSize}px`);
  if (game) { game.settings = settings; game.range.resize(settings.fov, !!game.session); game.audio.volume(game.muted ? 0 : settings.volume); }
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const input = document.querySelector<HTMLInputElement>(`input[name=${key}]`)!;
    if (key === 'assist' || key === 'flashEnabled') input.checked = settings[key];
    else { input.value = String(settings[key]); $(`${key}-value`).textContent = key === 'fov' ? `${settings[key]}°` : key === 'volume' ? `${Math.round(settings[key] * 100)}%` : String(settings[key]); }
  }
}
applySettings();
async function enter(resume = false) {
  if (!initialized) return;
  if (matchMedia('(pointer: coarse)').matches) { toast('训练需要桌面浏览器、鼠标与键盘'); return; }
  closeDialogs();
  if (!resume) game.start(selectedMode(), $<HTMLSelectElement>('difficulty').value, Number($<HTMLSelectElement>('duration').value));
  document.body.classList.add('playing'); $('hud').hidden = false;
  try {
    // Pointer lock must be requested directly from the user gesture, before awaiting audio setup.
    const locked = game.range.renderer.domElement.requestPointerLock();
    game.audio.init().then(() => {
      game.audio.volume(game.muted ? 0 : settings.volume);
      if ($('sample-name').textContent?.startsWith('狂徒')) $('sample-name').textContent = game.audio.sourceName;
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
$('settings-form').addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (!Object.hasOwn(DEFAULTS, input.name)) return;
  settings = sanitizeSettings({ ...settings, [input.name]: input.type === 'checkbox' ? input.checked : Number(input.value) });
  applySettings(); save('range-settings', settings);
});
$('settings-form').addEventListener('submit', event => event.preventDefault());
$('reset-settings').addEventListener('click', () => { settings = { ...DEFAULTS }; applySettings(); save('range-settings', settings); });
$('sample-file').addEventListener('change', async event => {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file || !game) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('音频文件不能超过 5 MB');
    await game.audio.importSample(await file.arrayBuffer()); game.audio.volume(game.muted ? 0 : settings.volume);
    $('sample-name').textContent = file.name; toast('已载入单发枪声，仅用于当前页面');
  } catch (error) { toast(error instanceof Error ? error.message : '无法解码此音频文件'); }
  input.value = '';
});
$('clear-sample').addEventListener('click', () => { game?.audio.clearSample(); $('sample-name').textContent = game?.audio.sourceName ?? '狂徒 · 参考录音'; });
$('preview-sample').addEventListener('click', async () => {
  if (!game) return;
  try {
    await game.audio.init(); game.audio.volume(game.muted ? 0 : settings.volume); game.audio.shot();
    if ($('sample-name').textContent?.startsWith('狂徒')) $('sample-name').textContent = game.audio.sourceName;
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
    const date = document.createElement('small'); date.textContent = `${new Date(record.date).toLocaleString('zh-CN')} · ${record.kills} 击杀 · ${record.shots} 发 · ${record.profile === WEAPON.profile ? '狂徒' : '旧版'}`;
    if (record.flashStats && Number.isFinite(record.flashStats.total)) date.textContent += ` · 背闪 ${record.flashStats.back}/${record.flashStats.total} · 致盲 ${(record.blindSeconds ?? 0).toFixed(1)}s`;
    const accuracy = document.createElement('strong'); accuracy.textContent = `${record.accuracy}%`; row.append(name, date, accuracy); list.append(row);
  }
  modal('history-dialog');
});
document.querySelectorAll('input[name=mode]').forEach(input => input.addEventListener('change', () => { if (initialized) game.range.setMode(selectedMode(), $<HTMLSelectElement>('difficulty').value); }));
$('difficulty').addEventListener('change', () => { if (initialized) game.range.setMode(selectedMode(), $<HTMLSelectElement>('difficulty').value); });
window.addEventListener('resize', () => { if (game) game.range.resize(settings.fov, !!game.session); });
function results(session: Session) {
  document.body.classList.remove('playing'); $('hud').hidden = true; closeDialogs();
  const stats = summarize(session);
  const flashStats = summarizeFlashes(session.flashes ?? []);
  history.unshift({ mode: session.mode, date: session.date, accuracy: stats.accuracy, kills: session.kills, shots: stats.shots, recoil: settings.recoil, difficulty: $<HTMLSelectElement>('difficulty').value, profile: WEAPON.profile,
    flashStats: session.flashEnabled ? flashStats : undefined, blindSeconds: session.blindSeconds });
  history = history.slice(0, 30); save('range-history', history); best();
  $('result-mode').textContent = `${names[session.mode]} · ${Math.round(session.elapsed)} 秒 · ${stats.shots} 发射击`;
  const peeks = session.peekErrors ?? [], peekAverage = peeks.length ? peeks.reduce((a, b) => a + b, 0) / peeks.length : null;
  const metrics = [['命中率', `${stats.accuracy}%`], ['击杀', String(session.kills)], ['头部命中', String(stats.headshots)], ['停稳射击', `${stats.clean}%`], ['过早开枪', String(stats.early)], session.mode === 'peek' ? ['出角偏差', peekAverage === null ? '--' : `${peekAverage.toFixed(1)}°`] : ['停稳后开枪', stats.delay === null ? '--' : `${stats.delay} ms`]];
  $('result-stats').replaceChildren();
  if (session.flashEnabled) metrics.push(['闪光次数', String(flashStats.total)], ['背闪成功', String(flashStats.back)],
    ['未躲过', String(flashStats.hit)], ['掩体阻挡', String(flashStats.blocked)],
    ['背闪成功率', flashStats.rate === null ? '--' : `${flashStats.rate}%`],
    ['平均背闪反应', flashStats.reaction === null ? '--' : `${flashStats.reaction} ms`],
    ['累计致盲', `${(session.blindSeconds ?? 0).toFixed(1)} s`]);
  for (const [label, value] of metrics) { const div = document.createElement('div'), small = document.createElement('small'), b = document.createElement('b'); small.textContent = label; b.textContent = value; div.append(small, b); $('result-stats').append(div); }
  $('insight').textContent = !stats.shots ? '本轮尚未射击。下一轮从一次准确的点射开始。' : stats.early > stats.shots * 0.15 ? `有 ${stats.early} 发在停稳前射出。先放慢节奏，感受减速完成的时机。` : session.mode === 'peek' && peekAverage !== null ? `出角时平均需要修正 ${peekAverage.toFixed(1)}°。下一轮将准星提前放在掩体边缘的头线位置。` : stats.accuracy < 60 ? '下一轮减少连射，待首发精度恢复后再开枪。' : '停稳与瞄准表现稳定，可以尝试更远的目标与更快的节奏。';
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
  $('accuracy').textContent = `${stats.accuracy}%`; $('kills').textContent = String(session.kills); $('ammo').textContent = String(game.ammo);
  $('movement').textContent = game.speed <= WEAPON.accurateSpeed ? '已停稳' : '移动中'; $('movement').className = game.speed <= WEAPON.accurateSpeed ? 'stable' : 'moving';
  $('weapon-state').textContent = game.reloading > 0 ? `换弹中 ${game.reloading.toFixed(1)}s` : game.heat > 0 ? '精度恢复中' : '首发就绪';
  $('movement').hidden = !settings.assist; $('weapon-state').hidden = !settings.assist && !game.reloading;
  if (import.meta.env.DEV) {
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
    game.onFeedback = (message, head, hit) => { $('feedback').textContent = message; feedbackUntil = performance.now() + 1100; if (hit) { hitUntil = performance.now() + 140; $('hitmarker').classList.toggle('head', !!head); } };
    range.resize(settings.fov, false); game.init();
    await game.audio.prepare(); $('sample-name').textContent = game.audio.sourceName; initialized = true;
    startButton.disabled = false; $('ready').replaceChildren(); const dot = document.createElement('span'); dot.className = 'live-dot'; $('ready').append(dot, matchMedia('(pointer: coarse)').matches ? '桌面键鼠训练 · 可浏览场景与记录' : '训练场就绪');
    $('scene').dataset.ready = 'true';
  } catch (error) { console.error(error); $('ready').textContent = '训练场加载失败，请确认浏览器支持 WebGL 2 后刷新'; toast('训练场未能加载'); }
}
void init();
