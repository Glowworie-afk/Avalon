# Day 4 · 任务循环（上）：队长轮转 + 组队 + 投票

完成：**队长轮转、组队提案、每轮人数表（按总人数/轮次）、投票（赞成/反对）、票数结算、连续 5 次反对自动判坏人胜**。

> 说明：发牌/夜晚身份（CLAUDE.md 的 Day 3）尚未做，但组队+投票循环不依赖身份牌，只需座位和对局状态，所以可以先行。投票通过后进入「任务执行」占位（成功/失败牌、成败判定是 Day 5）。

## 规则要点

- **开局**：房主点开始 → 服务端初始化对局，首任队长 = 座位 0，进入「组队」阶段。
- **每轮人数表**（官方标准，`shared/missions.ts`）：

  | 人数 | 1轮 | 2轮 | 3轮 | 4轮 | 5轮 |
  |---|---|---|---|---|---|
  | 5 | 2 | 3 | 2 | 3 | 3 |
  | 6 | 2 | 3 | 4 | 3 | 4 |
  | 7 | 2 | 3 | 3 | 4★ | 4 |
  | 8 | 3 | 4 | 4 | 5★ | 5 |
  | 9 | 3 | 4 | 4 | 5★ | 5 |
  | 10 | 3 | 4 | 4 | 5★ | 5 |

  ★ = 7 人及以上第 4 轮需 **2 张失败牌** 才算任务失败（`failsRequired()`，Day 5 用）。

- **组队**：只有当前队长能提名，且人数必须等于本轮要求、不可重复、座位合法（服务端校验）。
- **投票**：每人投一次赞成/反对；投票期间只广播「已投人数」，**不泄露谁投了什么**；全部投完才揭晓每个人的票（`VOTE_RESULT`）。
- **结算**：赞成严格过半 → 提案通过（进入任务执行，否决轨清零）；平票或反对过半 → 否决，**队长顺位轮转**，回到组队。
- **连续 5 次否决 → 坏人直接获胜**（`MAX_REJECTS=5`），游戏结束。

## 改动文件

**shared/**
- `missions.ts`（新）：`MISSION_TEAM_SIZE` 人数表、`teamSize()`、`failsRequired()`、`TOTAL_ROUNDS`、`MAX_REJECTS`。
- `protocol.ts`：新增 `ProposeTeam`/`Vote`/`VoteResult`/`PhaseChange`/`GameOver`/`GameStarted` payload。
- `types.ts`：`PublicGameState` 加 `votedCount`（只报已投人数、不泄露投票内容）。

**server/**
- `game/engine.ts`（新）：`initGame` / `proposeTeam` / `castVote` —— 纯函数，队长校验、人数校验、票数结算、否决轮转、连续 5 否决判坏人胜。
- `ws/index.ts`：`START_GAME` 改为真正初始化对局；新增 `PROPOSE_TEAM` / `VOTE` handler，广播 `ROOM_UPDATE` / `VOTE_RESULT` / `GAME_OVER`。
  - **并修复一个真实并发 bug**：同一连接的消息原本并发处理，导致 `JOIN_ROOM` 紧跟 `TOGGLE_READY` 时 toggle 可能在 join 设好 roomId 前执行而丢失。改为 **per-socket 串行队列**。
- `test/`（新）：`missions`、`engine`、`game.e2e`（5 人开局→组队→投票全流程）。

**client/**
- `components/GameBoard/`（新）：每轮人数表（当前轮高亮、★标注两失败轮）、否决轨 0–5、队长点选组队、赞成/反对投票、票数结算揭晓、坏人胜结算。
- `pages/room`：`status==='playing'` 时渲染 `GameBoard`，并接收 `VOTE_RESULT` / `GAME_OVER`。

## 测试

```bash
cd server && npm test        # 32 个用例全绿
cd server && npm run typecheck
```

覆盖：人数表/失败牌数、组队校验（非队长、人数不符、重复）、过半通过、平票否决+队长轮转、不可重复投票、连续 5 否决判坏人胜；ws 端到端 5 人走「开局→组队→全员赞成→通过」。

前端联调（开发者工具）：用 5 个自定义编译条件 / 真机各登录一个号，凑满 5 人开始；队长点选 2 人提交，其余人投票，验证票数揭晓、通过/否决轨、连续否决到 5 判负。前端我只做了编译校验，真机多人需你实测。

## 待办（后续）

- 发牌 + 夜晚信息（Day 3）。
- 任务执行（成功/失败牌）、3 胜/3 败追踪、第 4 轮两失败规则生效（Day 5）。
- 掉线重连对局状态（Day 9）。
