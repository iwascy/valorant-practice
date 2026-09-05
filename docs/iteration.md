# 迭代与验证

## 按改动定位

| 改动 | 需要检查的连接点 |
| --- | --- |
| 新增数值设置 | `DEFAULTS`、`LIMITS`、sanitize、同名 input、对应 output、应用位置、旧设置缺省 |
| 新增布尔开关 | `DEFAULTS`、sanitize 独立分支、数值键类型排除、checkbox、`applySettings` 布尔分支、决定即时生效或开局快照 |
| 新增训练模式 | `Mode` 与 `names`、HTML mode radio、`RangeScene.setMode`、`Game` 评分条件、Session 字段、结算与历史读取 |
| 新增技能或计时效果 | 可独测状态、固定 step 集成、生成与遮挡、暂停/重开/结束清理、HUD、实际经历时间统计 |
| 调整射击手感 | `WEAPON`、`VandalRecoil`、`ShotCadence`、相机/子弹角度、音频排程、校准文档与必要的 profile 变更 |
| 新增结算数据 | Session 原始样本、纯统计函数、空样本处理、`results`、`RecordEntry`、旧历史校验与展示 |
| 替换音频 | 加载/解码/回退/导入优先级、WAV 起音与峰值、SOURCE 来源及授权、浏览器实际播放 |

先核对当前实现，再做相关范围的修改。新增计时逻辑使用训练时钟；不要用 setTimeout 驱动会话内技能。纯逻辑保留可注入随机源，避免测试依赖抽样运气。当前 Node 纯 TS 测试仅擦除类型，可测试模块避免使用需要转换的 TypeScript 参数属性。

## 常用命令

从项目根目录运行：

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

已有服务时复用；端口被其他项目占用时换端口，并同步测试的 baseURL。`playwright.config.ts` 默认指向 5173，不会自动启动服务。

```sh
npm test
npm run build
npm run test:e2e -- --grep 'random flashes|mobile renders'
npm run test:e2e -- --grep 'desktop range renders|Vandal spray'
```

首次需要 Playwright 浏览器时执行 `npx playwright install chromium`；已有兼容浏览器可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`，不要将某位开发者机器上的缓存路径写成项目默认。

完整回归为 `npm run test:e2e`，其中 `timer finishes automatically` 会实际等待 60 秒训练结束。只改文档时校验链接、代码名和 skill 即可，无需重跑游戏；涉及生命周期、时钟或共享射击逻辑时扩大相应回归范围。

## 浏览器验收

- 桌面必须验证真实 WebGL 画布非空、Pointer Lock、输入与动态效果；截图结合 canvas 像素取样，不能仅看 DOM 存在。
- 移动端验证 390 × 844 的场景与设置布局。实际训练仍限桌面键鼠，不以触屏无法开始视作回归。
- 状态驱动测试轮询 `data-shots`、闪光结果或可见性；固定睡眠不能证明模拟时间达到目标。低 FPS 会使模拟时间落后墙钟。
- 测试截图写入 `test-results/`，下一次运行可能清空，不将它作为永久交付附件路径。
- 当前构建有 Three.js/Rapier 大包警告；该警告不等于构建失败，优化应单独评估。

## 调试数据

开发环境下 `#scene` 暴露 `data-shots`、`data-speed`、`data-elapsed`、`data-position`、`data-recoil`、`data-shot-log`、`data-flash`。`data-ready` 表示初始化完成。复杂字段是 JSON，HUD 数据最多每 60 ms 更新一次；结束后可能保留最后一帧值，不能单凭旧属性判断训练仍在进行。

`data-flash` 含 warning、nextAt、results、opacity、blindSeconds。关闭调度的内部 nextAt 为 Infinity，JSON 序列化后变为 null。生产构建没有这组 DEV 诊断数据，不把测试钩子作为业务接口。

`data-bots` 提供目标位置、实际速度、动作阶段与存活可见状态；visible 不是遮挡测试结果。`data-reaim` 提供本轮回瞄结果。新功能见 [进阶训练](advanced-training.md)。测试支持 `PLAYWRIGHT_BASE_URL` 覆盖默认 5173 端口；改用其他服务端口时应同步该环境变量。

## 文档维护

行为和字段变更同步 [实现结构](implementation.md)；闪光规则与统计同步 [闪光训练](flash-training.md)；武器数值、来源和近似假设同步 [狂徒校准](vandal-calibration.md)。新专题加入 [索引](README.md)。只有入口或开发约定改变才更新项目 skill，避免把所有实现细节复制进去。

自动化测试证明已覆盖的行为，不能证明原版手感 1:1。新增原版参数需说明来源，未经实测的曲线注明近似。现有社区枪声分发权利尚未明确，公开部署前需确认素材授权或替换为可分发音源。
