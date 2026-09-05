# 开发文档索引

本项目是 Three.js + Rapier + Web Audio 的单人网页训练场，无后端。以下内容以当前代码为准；参数变化时同步相应专题，避免复制多份数值表。

| 需求 | 优先阅读 | 实现入口 |
| --- | --- | --- |
| 了解模块、训练循环和存储 | [实现结构](implementation.md) | `src/main.ts`、`src/game.ts`、`src/model.ts` |
| 修改狂徒手感、散布或枪声 | [狂徒校准](vandal-calibration.md)、[音频来源](../public/audio/vandal/SOURCE.md) | `src/vandal.ts`、`src/audio.ts` |
| 修改闪光、背闪和躲避统计 | [闪光训练](flash-training.md) | `src/flash.ts`、`Game.updateFlash` |
| 新增模式、设置或结算项 | [迭代与验证](iteration.md) | 按文档中的改动清单定位 |
| 让编码助手继续开发 | [项目 skill](../skills/range-lab-development/SKILL.md) | 根目录 `AGENTS.md` 提供读取入口 |

产品使用方式见 [README](../README.md)，架构决策与边界见 [DESIGN](../DESIGN.md)。这里记录已实现行为，不将建议当作已完成功能。
