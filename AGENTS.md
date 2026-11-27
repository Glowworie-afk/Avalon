Day 1｜架构 + 通信打通

Taro 项目初始化，Node 后端骨架（Express + ws）
跑通 wx.login → code 换 openid 的登录流程
跑通一条 WebSocket 链路（客户端发消息 → 服务端广播）
定义数据模型（Room / Player / GameState）和消息协议（event type 枚举）
选型：房间状态放 Redis（快、易过期回收）

Day 2｜房间系统（Lobby）

创建房间（生成 4–6 位房间码）、输码加入、玩家列表实时同步
房主控制、准备状态、人数校验（5–10 人）
模式选择 UI：基础局 + 兰斯洛特开关 + 湖中仙女开关（先只做 UI 和配置存储）

Day 3｜角色系统 + 发牌 + 夜晚

按人数配置好/坏阵营数量表，角色池（梅林、派西维尔、莫甘娜、莫德雷德、刺客、奥伯伦等）
发牌算法（含扩展角色占位）
夜晚信息公示逻辑（梅林看坏人、派西维尔看梅林/莫甘娜、坏人互认等）——这是规则最容易出错的地方，单独留足时间

Day 4｜任务循环（上）

队长轮转、组队提案 UI、每轮人数表（按总人数/轮次）
投票（赞成/反对）、票数结算、连续 5 次反对自动判坏人胜的规则

Day 5｜任务循环（下）

任务执行（成功/失败牌），7 人以上第 4 轮需 2 张失败牌的特殊规则
任务结果公示、计分条（3 胜/3 败追踪）

Day 6｜胜负判定 + 刺客

三成功/三失败检测
刺客猜梅林阶段、最终结算页
到这里基础局应该完整可玩，建议先完整测一局

Day 7｜扩展：兰斯洛特

好/坏兰斯洛特、忠诚切换牌（loyalty cards）机制
与角色公示、任务逻辑的整合（切换后阵营变化对任务结果的影响）

Day 8｜扩展：湖中仙女

令牌分配、第 2/3/4 轮后的查验流程
向持有者揭示目标真实阵营、令牌传递规则（不能传给查过自己的人）

Day 9｜断线重连 + 边界情况

掉线/重连恢复对局状态、房主迁移
异常处理（中途退出、非法操作拦截）
完整跑一局压测各种异常

Day 10｜打磨 + 测试 + 缓冲

UI 收尾、动效/音效（可选）、多设备并发测试、修 bug
这天本身就是 buffer，别排满

## Imported Claude Cowork project instructions


## Ponytail development workflow

Use the project-local `.agents/skills/ponytail/SKILL.md` for coding tasks, in full mode unless the user requests another level. Apply KISS, YAGNI, and DRY: prefer existing project code and platform features, avoid speculative abstractions and dependencies, and choose the smallest complete change.

Preserve functionality, private-role boundaries, server-side authorization, validation, error handling, and relevant tests. Read callers before changing shared behavior. The roadmap above remains intact; if implementation and roadmap conflict, report the discrepancy rather than silently choosing new game rules.

Use `.agents/skills/ponytail-audit/SKILL.md` for repository audits and `.agents/skills/ponytail-review/SKILL.md` for change reviews. Audits and reviews report findings without modifying application code unless separately requested. Prefer these local skill paths if the global plugin also appears in the skill selector.

See `docs/ponytail-setup.md` for installation provenance, invocation, updates, and removal; `docs/ponytail-audit.md` records the initial audit. Run relevant existing checks for behavior changes; do not add tests for documentation-only edits.


## Avalon 长期项目约定（2026-11-25）

项目是学习型全栈作品：完成可玩的多人游戏，同时掌握 Git、测试、CI/CD、Docker、AWS 与监控，能够解释实现取舍。

当前为 v0.1.0（工程基础与 CI）。版本顺序以 `docs/ROADMAP.md` 为准：v0.1.0 → v0.2.0 核心功能 → v0.3.0 测试/可靠性/容器化 → v1.0.0 AWS/CD/监控。上方十天计划原文保留为历史功能拆解；版本排期采用新路线，游戏规则分歧必须先讨论，不自动覆盖实现。

- 当前不创建 AWS 资源。候选服务不等于已选架构；先完成核心功能，再做容器化和部署。
- 重要技术决策实施前解释原因与取舍。把维护者当作学习者，不一次性生成全部工程；大型重构、规则调整和存储迁移先讨论发现。
- 使用功能分支、Conventional Commits、小 PR；遵循 `CONTRIBUTING.md`，保留已有未提交改动。
- 功能开发同步编写有意义的测试。保持功能、安全、验证、错误处理和私密状态边界。
- 用 GitHub Issues 与 Projects 的 Version 字段跟踪进度，不要求 Milestones 或复杂管理流程。没有实际执行远端操作就不宣称已创建、更新或关闭任务。
- 本次首项代码审查已产出 `docs/ponytail-audit.md`，后续先讨论报告，不重复安装 Ponytail，也不据此自动重构。

新会话先读 `README.md`、`docs/ROADMAP.md`、`docs/PRD.md`、`docs/ARCHITECTURE.md` 和 `CONTRIBUTING.md`，再查看当前 git 状态。审计中的检查结果带日期，不当作后续改动自动通过的证据。
