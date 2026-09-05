import type { Language } from './preferences.ts';

// Source messages are also the Chinese catalog; templates preserve runtime values.
const messages: Record<string, string> = {
  '出角方向': 'Peek direction', '随机两侧': 'Random side', '左侧': 'Left', '右侧': 'Right', '平均出角间隔': 'Mean peek interval',
  '请选择不超过 5 秒的单发枪声': 'Choose a single shot no longer than 5 seconds.',
  'RANGE LAB · 战术训练场': 'RANGE LAB · Tactical Range', '三维射击训练场': '3D shooting range',
  'Range Lab 首页': 'Range Lab home', '战术训练场': 'Tactical Range', '训练基地': 'Training Base',
  '训练记录': 'Training History', '静音': 'Mute', '取消静音': 'Unmute', '训练设置': 'Settings',
  '全局设置': 'Global Settings', '全屏': 'Fullscreen', '每一发，': 'Every shot.', '都有把握。': 'Make it count.',
  '专注此刻。练好下一枪。': 'Stay focused. Take your next shot.', '训练项目': 'Training Projects',
  '急停点射': 'Counter-strafe', '精准点射': 'Precision', '预瞄清角': 'Angle Clearing',
  '项目配置': 'Project Settings', '训练时长': 'Duration', '目标难度': 'Difficulty', '标准': 'Standard',
  '入门': 'Easy', '进阶': 'Hard', '开始训练': 'Start Training', '正在准备训练场': 'Preparing range',
  '训练场就绪': 'Range ready', '个人最佳命中率': 'Personal best accuracy', '同条件最佳命中率': 'Best with these settings',
  '保持专注 / STAY SHARP': 'STAY SHARP', '剩余时间': 'Time Left', '命中率': 'Accuracy', '击杀': 'Kills',
  '已停稳': 'Stable', '移动中': 'Moving', '首发就绪': 'First shot ready', '精度恢复中': 'Accuracy recovering',
  '狂徒 / VANDAL': 'VANDAL', '标准腰射': 'Hip fire', '独立战术训练实验室': 'Independent Tactical Training Lab',
  '训练备用弹药无限': 'Unlimited reserve ammo', '稍作调整，再来一枪。': 'Take a moment.',
  '本轮训练已暂停': 'Session paused', '继续训练': 'Resume Training', '结束并查看成绩': 'Finish & View Results',
  '关闭': 'Close', '随机闪光躲避': 'Random flash dodging', '机器人移动': 'Target behavior',
  '静止': 'Stationary', '随机前后': 'Forward / backward', '左右横移': 'Strafing', '混合移动': 'Mixed movement',
  '随机出角': 'Random peeking', '主动清角': 'Clear angles', '架枪等出角': 'Hold against peeks',
  '机器人速度': 'Target speed', '移动半径': 'Movement range', '随机出角距离': 'Random peek distance',
  '无限弹匣': 'Infinite magazine', '标准弹匣': 'Standard magazine', '恢复项目默认': 'Reset Project',
  '无畏契约准星分享码': 'VALORANT crosshair code', '导入准星': 'Import crosshair', '恢复默认准星': 'Reset crosshair',
  '默认准星': 'Default crosshair', '准星预览': 'Crosshair preview', '准星': 'Crosshair', '已导入腰射准星': 'Hip-fire crosshair imported',
  '灵敏度': 'Sensitivity', '视野 FOV': 'Field of view', '后坐力强度': 'Recoil strength', '枪声音量': 'Gun volume',
  '准星尺寸': 'Crosshair size', '教学状态提示': 'Training feedback', '枪声音源': 'Shot audio',
  '狂徒': 'Vandal', '参考录音': 'Reference recording', '合成': 'Synthesized', '试听枪声': 'Preview shot',
  '导入本地单发枪声': 'Import local shot audio', '恢复狂徒枪声': 'Reset Vandal audio', '恢复全局默认': 'Reset Global Settings',
  '每一轮，都更进一步。': 'Session Results', '射击角度分布图': 'Shot angle chart',
  '射击角度分布 · 青色命中 / 红色未命中': 'Shot angles · Mint: hit / Red: miss', '再练一轮': 'Train Again',
  '闪光致盲': 'Flash blindness', '暂无训练记录': 'No training history', '旧版': 'Legacy', '旧版配置': 'Legacy settings',
  '闪光开启': 'Flash on', '闪光关闭': 'Flash off', '提示开启': 'Feedback on', '提示关闭': 'Feedback off',
  '头部命中': 'Head hit', '停稳射击': 'Stable shots', '过早开枪': 'Early shots', '出角偏差': 'Angle error',
  '停稳后开枪': 'Shot after stop', '未归属射击': 'Unassigned shots', '闪光次数': 'Flashes',
  '背闪成功': 'Successful dodges', '未躲过': 'Failed dodges', '掩体阻挡': 'Blocked by cover',
  '背闪成功率': 'Dodge success rate', '平均背闪反应': 'Mean dodge reaction', '累计致盲': 'Total blind time',
  '背闪回瞄样本': 'Reacquisition trials', '重新瞄准完成': 'Targets reacquired', '平均重新瞄准': 'Mean reacquisition',
  '回瞄首发样本': 'First-shot samples', '回瞄首发命中率': 'First-shot accuracy', '背闪后击杀': 'Post-dodge kills',
  '背闪后击杀耗时': 'Post-dodge kill time', '未完成击杀': 'Unfinished kills',
  '开枪过早': 'Shot too early', '尚未停稳': 'Still moving', '先完成横移，再停稳射击': 'Strafe, stop, then shoot',
  '移动射击': 'Shooting while moving', '散布增加': 'Increased spread',
  '本轮尚未射击。下一轮从一次准确的点射开始。': 'No shots this session. Start with a precise tap next time.',
  '下一轮减少连射，待首发精度恢复后再开枪。': 'Use shorter bursts and let first-shot accuracy recover.',
  '停稳与瞄准表现稳定，可以尝试更远的目标与更快的节奏。': 'Stable aim and stops. Try farther targets or a faster pace.',
  '浏览器存储不可用，本次成绩仅在当前页面保留': 'Browser storage unavailable. Results will only last on this page.',
  '训练需要桌面浏览器、鼠标与键盘': 'Training requires a desktop browser, mouse and keyboard.',
  '音频暂不可用，训练可以继续': 'Audio unavailable. Training can continue.',
  '未能锁定鼠标，请点击继续训练重试': 'Pointer lock failed. Click Resume Training to retry.',
  '音频文件不能超过 5 MB': 'Audio file must be 5 MB or smaller.', '已载入单发枪声，仅用于当前页面': 'Shot audio loaded for this page.',
  '无法解码此音频文件': 'Unable to decode this audio file.', '音频暂不可用': 'Audio unavailable.',
  '当前浏览器不支持全屏': 'Fullscreen unavailable in this browser.',
  '桌面键鼠训练 · 可浏览场景与记录': 'Desktop training · Range and history available',
  '训练场加载失败，请确认浏览器支持 WebGL 2 后刷新': 'Range failed to load. Check WebGL 2 support and reload.',
  '训练场未能加载': 'Unable to load range.', '分享码无效': 'Invalid crosshair code.',
  '分享码格式无效：需要版本 0 的 P 腰射准星配置': 'Invalid code: version 0 with a primary P crosshair is required.',
  '分享码字段不完整': 'Incomplete crosshair fields.', '自定义颜色无效': 'Invalid custom color.',
  '分享码缺少自定义颜色': 'Custom color is missing.', '开镜配置已保留，当前仅应用腰射准星': 'ADS settings retained; only hip-fire settings are applied.',
};
const templates: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/^(\d+) 秒$/, m => `${m[1]} s`], [/^(\d+) 发射击$/, m => `${m[1]} shots`], [/^(\d+) 发$/, m => `${m[1]} shots`],
  [/^(\d+) 击杀$/, m => `${m[1]} kills`], [/^后坐力 ([\d.]+)$/, m => `Recoil ${m[1]}`],
  [/^换弹中 ([\d.]+)s$/, m => `Reloading ${m[1]}s`], [/^(身体|腿部)命中$/, m => m[1] === '身体' ? 'Body hit' : 'Leg hit'],
  [/^背闪 (\d+\/\d+)$/, m => `Dodged ${m[1]}`], [/^致盲 ([\d.]+)s$/, m => `Blind ${m[1]}s`],
  [/^回瞄 (\d+)ms$/, m => `Reacquire ${m[1]}ms`],
  [/^(动靶|静靶)(射击数|命中率|爆头占比|击杀|交战耗时| [\d.]+%)$/, m => `${m[1] === '动靶' ? 'Moving' : 'Stationary'} ${({ 射击数: 'shots', 命中率: 'accuracy', 爆头占比: 'head hit rate', 击杀: 'kills', 交战耗时: 'engagement time' } as Record<string, string>)[m[2]] ?? m[2].trim()}`],
  [/^重复字段：(.*)$/, m => `Duplicate field: ${m[1]}`], [/^准星字段 (.*) 超出范围$/, m => `Crosshair field ${m[1]} is out of range`],
  [/^未应用字段：(.*)$/, m => `Unsupported field: ${m[1]}`],
  [/^有 (\d+) 发在停稳前射出。先放慢节奏，感受减速完成的时机。$/, m => `${m[1]} shots fired before stopping. Slow down and feel the deceleration.`],
  [/^出角时平均需要修正 ([\d.]+)°。下一轮将准星提前放在掩体边缘的头线位置。$/, m => `Mean angle correction: ${m[1]}°. Pre-aim at head height by the cover edge.`],
];
export function translate(source: string, language: Language): string {
  if (language === 'zh-CN') return source;
  const key = source.trim();
  let result = Object.hasOwn(messages, key) ? messages[key] : '';
  if (!result) for (const [pattern, render] of templates) { const match = key.match(pattern); if (match) { result = render(match); break; } }
  if (!result && key.includes(' · ')) result = key.split(' · ').map(part => translate(part, language)).join(' · ');
  return result ? source.replace(key, result) : source;
}

type Binding = { source: string; rendered: string };
let language: Language = 'zh-CN';
const texts = new Map<Text, Binding>(), attributes = new Map<Element, Map<string, Binding>>();
let observer: MutationObserver | undefined;
function bind(node: Node) {
  if (node instanceof Text && node.parentElement && !node.parentElement.closest('script, style, textarea, [data-no-i18n]')) {
    const previous = texts.get(node);
    if (!previous || previous.rendered !== node.data) texts.set(node, { source: node.data, rendered: node.data });
  }
  if (node instanceof Element) {
    if (node.matches('script, style, textarea, [data-no-i18n]')) return;
    for (const key of ['title', 'aria-label', 'placeholder']) {
      const value = node.getAttribute(key); if (value === null) continue;
      const map = attributes.get(node) ?? new Map<string, Binding>(), previous = map.get(key);
      if (!previous || previous.rendered !== value) map.set(key, { source: value, rendered: value });
      attributes.set(node, map);
    }
  }
  node.childNodes.forEach(bind);
}
function render() {
  observer?.disconnect();
  document.documentElement.lang = language;
  for (const [node, value] of texts) {
    if (!node.isConnected) { texts.delete(node); continue; }
    value.rendered = translate(value.source, language);
    if (node.data !== value.rendered) node.data = value.rendered;
  }
  for (const [node, map] of attributes) {
    if (!node.isConnected) { attributes.delete(node); continue; }
    for (const [key, value] of map) {
      value.rendered = translate(value.source, language);
      if (node.getAttribute(key) !== value.rendered) node.setAttribute(key, value.rendered);
    }
  }
  observer?.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
}
export function setLanguage(value: Language) { language = value; bind(document.documentElement); render(); }
export function installLocale(value: Language) {
  observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(bind);
      else bind(record.target);
    }
    render();
  });
  setLanguage(value);
}
