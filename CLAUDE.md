# Texas Hold'em Poker — 项目文档

网页版德州扑克，支持多人实时对战、Claude AI 机器人、WebRTC 语音聊天。

---

## 快速启动

```bash
# 安装依赖（首次）
export PNPM_HOME="$HOME/Library/pnpm" && export PATH="$PNPM_HOME:$PATH"
pnpm install

# 终端1：后端（端口 3001）
cd apps/server
npx tsx --env-file=.env src/index.ts

# 终端2：前端（端口 5173）
cd apps/client
pnpm dev
```

前端访问：http://localhost:5173  
后端健康检查：http://localhost:3001

---

## 实际 Tech Stack

| 层 | 实际使用 | 备注 |
|---|---|---|
| 前端 | React 19 + Vite + Tailwind + Zustand | |
| 后端 | Node.js + Fastify + Socket.io | |
| 状态存储 | **内存（JavaScript Map）** | Redis 已在 package.json 但未接入 |
| 认证 | JWT（guest token，24h 有效） | |
| AI Bot | Anthropic Claude API（可选） | 未配置 key 时用规则引擎 |
| 语音 | WebRTC P2P + Socket.io 信令 | 适合 ≤4 人；>4 人需升级 Mediasoup |
| 测试 | Vitest | 28 个测试全通过 |
| Monorepo | pnpm workspaces | |

> **重要**：服务器重启后所有牌局数据丢失（无持久化）。

---

## 目录结构

```
texasPoker/
├── packages/shared/src/
│   ├── types/          card.ts, player.ts, game.ts, action.ts
│   ├── constants/      events.ts（Socket事件名）, poker.ts
│   └── utils/          handEvaluator.ts, actions.ts（computeValidActions）
│
├── apps/server/src/
│   ├── game/           GameEngine.ts*, Deck.ts, PotManager.ts, BettingRound.ts
│   ├── table/          TableManager.ts*（内存+锁）
│   ├── bot/            BotPlayer.ts, BotPromptBuilder.ts, AnthropicClient.ts
│   ├── websocket/      gameHandlers.ts*, middleware.ts（JWT）
│   ├── http/           auth.ts, tables.ts
│   ├── config.ts
│   └── index.ts
│
└── apps/client/src/
    ├── pages/          LoginPage, LobbyPage, GamePage
    ├── components/     Table/, Player/, Actions/, Voice/VoicePanel
    ├── store/          gameStore.ts*, authStore.ts, voiceStore.ts
    ├── socket/         socketClient.ts*（单例，禁止重建）
    └── hooks/          useSocketEvents.ts, useCountdown.ts
```

`*` 标注的是最核心的文件，改动前必读。

---

## 架构关键决策

### 1. 状态机单一入口
`GameEngine.applyAction()` 是**唯一**能修改游戏状态的方法。WebSocket handler、Bot、超时计时器都通过它操作，不允许直接改 state。

### 2. 每桌 async mutex 锁
`TableManager.withLock(tableId, fn)` 串行化同一张桌的所有操作，防止并发 action 竞争。Bot 行动、超时弃牌、玩家 action 都走这个锁。

### 3. Bot = 规则引擎 + LLM 风格层
规则引擎先算出合法 action 集合。LLM 只在合法集合内选择"风格"（激进/保守）。LLM 超时（5s）或返回非法结果时，自动降级为规则引擎的 check/call/fold。

### 4. Socket 单例（客户端）
`socketClient.ts` 导出的 socket 是模块级单例。`connectSocket(token)` 不重建 socket，只更新 `auth.token` 后调用 `socket.connect()`。**绝对不要在 connectSocket 里 `socket = io(...)` 重建**，会导致 useSocketEvents 的监听器丢失。

### 5. 状态裁剪
服务端为每个 socket 单独发 `GameState`：对手底牌在非 showdown 阶段永远是 `null`。实现在 `GameEngine.getStateForPlayer(playerId)`。

### 6. 断线规则
- 断线期间轮到该玩家：30s 计时器继续跑，到期 auto-fold
- 断线后 60s 内重连：恢复座位，下一手正常参与
- 超过 60s：自动离座
- 同一 userId 新 socket 上线：踢掉旧 socket

---

## 运行测试

```bash
# 全部测试（28个）
pnpm test

# 只跑 shared 包
pnpm --filter @texas-poker/shared test

# 只跑 server
pnpm --filter server test
```

---

## 接入 Claude AI Bot

编辑 `apps/server/.env`：

```env
ANTHROPIC_API_KEY=sk-ant-xxxx
```

重启服务器后，点击游戏界面的 `+ Bot` 按钮即可添加 AI 机器人。未配置 key 时 Bot 使用规则引擎（check/call/fold），不调用 API。

Bot 相关文件：
- `apps/server/src/bot/BotPromptBuilder.ts` — 局面序列化为 prompt
- `apps/server/src/bot/AnthropicClient.ts` — API 调用 + 解析 + 降级
- `apps/server/src/bot/BotPlayer.ts` — 决策流程 + 合法性校验

---

## 待完成项（按优先级）

### 高优先级
- [ ] **Bug 验证**：多人对局完整测试（join → start → 多轮下注 → showdown）
- [ ] **边池测试**：含 all-in 的多人场景
- [ ] **WebRTC 语音联调**：两个浏览器 tab 互通

### 中优先级
- [ ] **Redis 持久化**：`ioredis` 已在依赖里，需实现 `TableRepository`，服务重启后恢复牌局
- [ ] **观战者模式**：不占座位，订阅 `spectate:{tableId}` room
- [ ] **Mediasoup SFU**：5+ 人语音升级（`apps/server/src/voice/` 目录待创建）

### 低优先级
- [ ] PostgreSQL + Prisma（牌局历史、玩家统计）
- [ ] Docker Compose（postgres + redis + coturn 一键启动）
- [ ] 部署（Fly.io 后端 + Vercel 前端）

---

## 环境变量说明

`apps/server/.env`（参考 `.env.example`）：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3001` | 服务端口 |
| `JWT_SECRET` | `dev-secret-...` | **生产必须更换** |
| `CORS_ORIGIN` | `http://localhost:5173` | 前端地址 |
| `ANTHROPIC_API_KEY` | 空 | 空时 Bot 用规则引擎 |
| `REDIS_URL` | `redis://localhost:6379` | 当前未使用 |
