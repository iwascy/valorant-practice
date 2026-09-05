# 实现结构

## 模块职责

| 文件 | 职责与常用入口 |
| --- | --- |
| `index.html`、`src/style.css` | 原生 DOM、模式选项、HUD、弹窗、设置与移动端布局 |
| `src/main.ts` | `enter` 请求鼠标锁定；`applySettings` 更新控件；`update` 更新 HUD；`results` 结算并存储 |
| `src/model.ts` | `Mode`、`DEFAULTS`、`LIMITS`、`sanitizeSettings`、`Session`、伤害与速度参数、基础统计 |
| `src/preferences.ts`、`src/i18n.ts` | 全局/项目配置、迁移与校验、配置比较键、中英文文案及 DOM 本地化 |
| `src/game.ts` | `Game.start/pause/resume/finish`、输入、固定步进、开枪、换弹、模式规则与闪光集成 |
| `src/scene.ts` | `RangeScene` 管理场景与碰撞；`setMode` 配置目标和掩体；`collidables` 返回可被子弹命中的物体 |
| `src/vandal.ts` | `ShotCadence` 出弹排程；`VandalRecoil` 热度、恢复及镜头偏移；`sampleSpread` 圆锥采样 |
| `src/flash.ts` | `FlashTrial` 闪光时序；`evaluateFlash` 判定；`summarizeFlashes` 汇总，无 DOM 或 Three.js 依赖 |
| `src/crosshair.ts` | 分享码解析、准星预览与 HUD 绘制 |
| `src/bots.ts`、`src/reaim.ts` | 运动状态机、动静目标统计、锁定目标的背闪回瞄状态与汇总 |
| `src/audio.ts`、`src/vandal-sound.ts` | 本地录音加载、Web Audio 调度、导入和合成回退；`flashCue` 为闪光合成提示音 |

## 训练生命周期

1. `main.init` 等待场景和物理初始化、音频预加载后启用开始按钮。
2. `enter` 新建训练或恢复现有训练。Pointer Lock 请求需直接处于用户点击调用链中，不能等音频初始化后才请求。
3. `Game.start` 创建 `Session`，重置弹匣、后坐力、闪光、位置和输入。此时尚未运行，由鼠标锁定成功事件调用 `resume`。
4. `loop` 用 requestAnimationFrame 渲染，累积时间后以 `1/120` 秒调用 `step`。单帧累积最多 100 ms，极低 FPS 时训练时间会慢于墙钟。
5. `step` 先推进 `session.elapsed`，到时立即结算；否则处理移动、换弹、恢复、相机、机器人移动、回瞄、射击、闪光、目标复活和清角统计。
6. 失去鼠标锁定时暂停。清空按键、扳机、速度和积压时间，保留训练及效果状态；恢复时重置帧时间起点。
7. `finish` 获取统计，隐藏闪光源、结束训练、退出锁定并调用同步的 `results`。DOM 致盲遮罩在非运行状态隐藏。

新增倒计时或技能效果应使用 `session.elapsed`，与暂停、重开和自动结束保持一致。当前 `FlashTrial.results` 和 `Session.flashes` 共用数组；重开会清空它。若将结算改为异步或保留完整 Session 历史，先复制所需数据，避免上一轮被清空。

## 射击与模式约定

- 射线从相机位置出发，使用玩家鼠标角度、完整弹道后坐力和散布；枪口位置仅用于曳光视觉。相机只应用 `cameraOffset`，不能把它替代弹道偏移。
- 射击命中最近的墙、箱体、有效清角掩体或目标部件。射线查询前更新矩阵，避免读到上一帧变换。隐藏目标不参与命中。
- 移动精度看 Rapier 碰撞修正后的实际速度。急停模式未满足移动距离和停稳要求时，命中仍进入命中率，但不伤害目标、不计击杀。
- `RangeScene.flash` / `Game.flashTime` 是枪口火光；`Game.flashSource` / `Game.flashTrial` 是闪光弹训练，不要混用。
- 清角偏差记录移动中目标头部首次可见时的夹角。视野范围是近似判定，新增真实屏幕可见性时需同步统计定义。
- 狂徒公开参数、手工近似和音频权利说明分别维护于 [校准记录](vandal-calibration.md) 和 [SOURCE](../public/audio/vandal/SOURCE.md)。

## 设置与持久化

`range-preferences` v2 按全局偏好和项目配置保存。`range-settings` 仅用于旧数据迁移。`sanitizeSettings` 校验基础参数，`sanitizeProject` 进一步限制各项目允许的行为。准星代码经过解析器。完整结构、默认值和迁移见 [项目配置与语言](project-settings.md)。

灵敏度、FOV、音量、准星和语言即时应用；`Game.start` 校验并复制 `Session.config`，弹药、后坐力、教学提示、机器人和闪光使用本局快照。无限弹匣仅取消弹药消耗与换弹，不修改狂徒连射状态。

机器人模式、速度和半径同样开局快照；准星即时更新。新增目标样本、回瞄样本及历史摘要的定义见 [进阶训练](advanced-training.md)。所有有效掩体经 `RangeScene.obstacles()` 提供给子弹、闪光与可见性查询。

`range-history` 保存最近 30 轮摘要，新增完整项目配置和 `configKey`，结果说明训练条件。最佳命中率筛选至少 10 发、相同武器 profile 及相同项目配置键。旧记录允许缺少新字段，继续展示但不参与配置最佳值比较。

设置值和基础历史字段有校验，但新增的嵌套闪光摘要尚无完整读取校验。后续扩展历史存储时补齐类型检查，不要假定 localStorage 内容可信。动态内容使用 textContent；上传枪声只保留在内存。
