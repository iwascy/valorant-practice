# 实现结构

## 模块职责

| 文件 | 职责与常用入口 |
| --- | --- |
| `index.html`、`src/style.css` | 原生 DOM、模式选项、HUD、弹窗、设置与移动端布局 |
| `src/main.ts` | `enter` 请求鼠标锁定；`applySettings` 更新控件；`update` 更新 HUD；`results` 结算并存储 |
| `src/model.ts` | `Mode`、`DEFAULTS`、`LIMITS`、`sanitizeSettings`、`Session`、伤害与速度参数、基础统计 |
| `src/game.ts` | `Game.start/pause/resume/finish`、输入、固定步进、开枪、换弹、模式规则与闪光集成 |
| `src/scene.ts` | `RangeScene` 管理场景与碰撞；`setMode` 配置目标和掩体；`collidables` 返回可被子弹命中的物体 |
| `src/vandal.ts` | `ShotCadence` 出弹排程；`VandalRecoil` 热度、恢复及镜头偏移；`sampleSpread` 圆锥采样 |
| `src/flash.ts` | `FlashTrial` 闪光时序；`evaluateFlash` 判定；`summarizeFlashes` 汇总，无 DOM 或 Three.js 依赖 |
| `src/audio.ts`、`src/vandal-sound.ts` | 本地录音加载、Web Audio 调度、导入和合成回退；`flashCue` 为闪光合成提示音 |

## 训练生命周期

1. `main.init` 等待场景和物理初始化、音频预加载后启用开始按钮。
2. `enter` 新建训练或恢复现有训练。Pointer Lock 请求需直接处于用户点击调用链中，不能等音频初始化后才请求。
3. `Game.start` 创建 `Session`，重置弹匣、后坐力、闪光、位置和输入。此时尚未运行，由鼠标锁定成功事件调用 `resume`。
4. `loop` 用 requestAnimationFrame 渲染，累积时间后以 `1/120` 秒调用 `step`。单帧累积最多 100 ms，极低 FPS 时训练时间会慢于墙钟。
5. `step` 先推进 `session.elapsed`，到时立即结算；否则处理移动、换弹、恢复、相机、射击、闪光、目标复活和清角统计。
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

`range-settings` 保存 `DEFAULTS` 推导出的 `Settings`，读取时经过 `sanitizeSettings`。数值有类型和范围检查，布尔值有独立类型检查。`applySettings` 按默认字段寻找同名 input，数值还需要 `<字段名>-value` output；新增字段必须同时修改模型、HTML 和绑定分支。

灵敏度、FOV、音量等由 `applySettings` 更新；闪光开关在 `Game.start` 快照为 `session.flashEnabled`，当前轮不会随设置变更重新调度。

`range-history` 只保存最近 30 轮摘要，包含模式、日期、命中率、击杀、发数、后坐力设置、难度、武器 profile，以及可选闪光摘要与致盲秒数。旧记录允许缺少新字段。当前最佳命中率只筛选至少 10 发且武器 profile 相同的记录，没有按难度、后坐力强度或闪光开关分组。

设置值和基础历史字段有校验，但新增的嵌套闪光摘要尚无完整读取校验。后续扩展历史存储时补齐类型检查，不要假定 localStorage 内容可信。动态内容使用 textContent；上传枪声只保留在内存。
