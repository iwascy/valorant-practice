export interface CrosshairLine {
  enabled: boolean; opacity: number; length: number; vertical: number; independent: boolean;
  thickness: number; offset: number; movement: boolean; firing: boolean; moveScale: number; fireScale: number;
}
export interface Crosshair {
  color: string; outline: boolean; outlineWidth: number; outlineOpacity: number;
  dot: boolean; dotSize: number; dotOpacity: number; fade: boolean;
  lines: CrosshairLine[];
}
export function defaultCrosshair(size = 5): Crosshair {
  return { color: '#a7f0cd', outline: true, outlineWidth: 1, outlineOpacity: 0.5,
    dot: false, dotSize: 2, dotOpacity: 1, fade: false,
    lines: [0, 1].map(i => ({ enabled: i === 0, opacity: 1, length: size, vertical: size,
      independent: false, thickness: 2, offset: 4, movement: false, firing: false, moveScale: 1, fireScale: 1 })) };
}
const colors = ['#ffffff', '#00ff00', '#7fff00', '#dfff00', '#ffff00', '#00ffff', '#ff00ff', '#ff0000'];
/** Decode the primary (P) section; retain the original code separately for unsupported sections. */
export function parseCrosshair(code: string) {
  const tokens = code.trim().split(';');
  if (code.length > 4096 || tokens[0] !== '0' || !tokens.includes('P')) throw new Error('分享码格式无效：需要版本 0 的 P 腰射准星配置');
  const config = defaultCrosshair(6), warnings: string[] = [];
  config.color = '#ffffff'; config.lines[0].movement = true; config.lines[0].firing = true;
  config.lines[1] = { ...config.lines[1], enabled: true, opacity: 0.35, length: 2, vertical: 2, offset: 10, movement: true, firing: true };
  const fields = new Map<string, string>();
  let section = '';
  for (let i = 1; i < tokens.length;) {
    const key = tokens[i++];
    if (['P', 'A', 'S'].includes(key)) { section = key; continue; }
    if (!key || i >= tokens.length || ['P', 'A', 'S'].includes(tokens[i])) throw new Error('分享码字段不完整');
    const value = tokens[i++];
    if (section === 'P') { if (fields.has(key)) throw new Error(`重复字段：${key}`); fields.set(key, value); }
    else if (section && !warnings.includes('开镜配置已保留，当前仅应用腰射准星')) warnings.push('开镜配置已保留，当前仅应用腰射准星');
  }
  function number(key: string, fallback: number, min: number, max: number, integer = false) {
    const raw = fields.get(key); fields.delete(key);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`准星字段 ${key} 超出范围`);
    return value;
  }
  const flag = (key: string, fallback: boolean) => !!number(key, Number(fallback), 0, 1, true);
  const color = number('c', 0, 0, 8, true), custom = fields.get('u'); fields.delete('u');
  if (custom !== undefined && !/^[\da-f]{6}([\da-f]{2})?$/i.test(custom)) throw new Error('自定义颜色无效');
  if (color === 8 && !custom) throw new Error('分享码缺少自定义颜色');
  config.color = color === 8 ? `#${custom!.slice(0, 6)}` : colors[color];
  config.outline = flag('h', true); config.outlineWidth = number('t', 1, 0, 6, true); config.outlineOpacity = number('o', 0.5, 0, 1);
  config.dot = flag('d', false); config.dotSize = number('z', 2, 0, 6, true); config.dotOpacity = number('a', 1, 0, 1);
  flag('s', true); // Spectator crosshair preference has no effect in a single-player session.
  config.fade = flag('f', true);
  config.lines.forEach((line, i) => {
    line.enabled = flag(`${i}b`, line.enabled); line.opacity = number(`${i}a`, line.opacity, 0, 1);
    line.length = number(`${i}l`, line.length, 0, 20, true); line.vertical = number(`${i}v`, line.length, 0, 20, true);
    line.independent = flag(`${i}g`, false); line.thickness = number(`${i}t`, 2, 0, 10, true);
    line.offset = number(`${i}o`, line.offset, 0, 40, true); line.movement = flag(`${i}m`, line.movement);
    line.firing = flag(`${i}f`, line.firing); line.moveScale = number(`${i}s`, 1, 0, 3); line.fireScale = number(`${i}e`, 1, 0, 3);
  });
  for (const key of fields.keys()) warnings.push(`未应用字段：${key}`);
  return { config, warnings };
}
export function drawCrosshair(canvas: HTMLCanvasElement, config: Crosshair, movement = 0, heat = 0, size = 320) {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== size * ratio) { canvas.width = size * ratio; canvas.height = size * ratio; }
  const ctx = canvas.getContext('2d')!; ctx.setTransform(ratio, 0, 0, ratio, size / 2 * ratio, size / 2 * ratio);
  ctx.clearRect(-size / 2, -size / 2, size, size);
  function rect(x: number, y: number, width: number, height: number, alpha: number) {
    if (!width || !height) return;
    if (config.outline) {
      const edge = config.outlineWidth; ctx.fillStyle = '#000'; ctx.globalAlpha = config.outlineOpacity * alpha;
      ctx.fillRect(x - edge, y - edge, width + edge * 2, height + edge * 2);
    }
    ctx.fillStyle = config.color; ctx.globalAlpha = alpha; ctx.fillRect(x, y, width, height);
  }
  for (const line of config.lines) {
    if (!line.enabled) continue;
    const gap = line.offset + (line.movement ? movement * 10 * line.moveScale : 0) + (line.firing ? heat * 0.8 * line.fireScale : 0);
    const t = line.thickness, h = line.independent ? line.vertical : line.length;
    rect(-gap - line.length, -t / 2, line.length, t, line.opacity); rect(gap, -t / 2, line.length, t, line.opacity);
    rect(-t / 2, -gap - h, t, h, line.opacity * (config.fade ? Math.max(0, 1 - heat / 9) : 1));
    rect(-t / 2, gap, t, h, line.opacity);
  }
  if (config.dot) rect(-config.dotSize / 2, -config.dotSize / 2, config.dotSize, config.dotSize, config.dotOpacity);
  ctx.globalAlpha = 1;
}
