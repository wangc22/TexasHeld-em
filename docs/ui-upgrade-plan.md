# UI 全面升级方案 — 赌场豪华风格

> 状态：**待实施**  
> 创建时间：2026-04-16

---

## 设计目标

| 维度 | 当前 | 目标 |
|------|------|------|
| 背景色 | `gray-950/900/800`（冷灰） | 深海军蓝 `#060b18 / #0c1528` |
| 强调色 | `yellow-400/600`（偏冷黄） | 琥珀金 `#f5c842 / #d4a017` |
| 桌面 | 单色 `#1a5c38` | 径向渐变毡布 + 木纹围边 |
| 按钮 | 纯色 flat | 线性渐变 + 阴影深度 |
| 动画 | 几乎没有 | 发牌、筹码弹出、胜者光圈、弃牌 |
| 字体排版 | 博客脚手架默认样式 | 全面重置为游戏 UI 风格 |

---

## 文件修改清单（按执行顺序）

### 1. `apps/client/tailwind.config.js`

新增 color tokens（加在 `theme.extend.colors`）：

```js
navy: {
  950: '#060b18', 900: '#0c1528', 800: '#152040', 700: '#1e2f5c',
},
gold: {
  300: '#fde68a', 400: '#f5c842', 500: '#d4a017', 600: '#b8860b', 700: '#8b6508',
},
card: {
  face: '#fafaf5',   // 暖白牌面
  back: '#1e3a6e',   // 深蓝牌背
  rim:  '#c8a96e',   // 金边
},
```

新增 `theme.extend.animation` + `theme.extend.keyframes`：

```js
animation: {
  'card-deal':   'card-deal 0.35s cubic-bezier(0.22,1,0.36,1) both',
  'chip-pop':    'chip-pop 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
  'winner-glow': 'winner-glow 1.4s ease-in-out infinite',
  'card-fold':   'card-fold 0.3s ease-in forwards',
  'chip-slide':  'chip-slide 0.4s cubic-bezier(0.22,1,0.36,1) both',
  'fade-in-up':  'fade-in-up 0.4s ease-out both',
  'shimmer':     'shimmer 2.5s linear infinite',
},
keyframes: {
  'card-deal':  { '0%': { opacity:'0', transform:'translate(-60px,-30px) rotate(-15deg) scale(0.7)' }, '100%': { opacity:'1', transform:'none' } },
  'chip-pop':   { '0%': { opacity:'0', transform:'scale(0.4) translateY(6px)' }, '100%': { opacity:'1', transform:'none' } },
  'winner-glow':{ '0%,100%': { boxShadow:'0 0 12px 2px rgba(245,200,66,.5),0 0 28px 6px rgba(245,200,66,.2)' }, '50%': { boxShadow:'0 0 24px 6px rgba(245,200,66,.85),0 0 56px 14px rgba(245,200,66,.35)' } },
  'card-fold':  { '0%': { opacity:'1', transform:'none' }, '100%': { opacity:'0', transform:'scale(0.7) rotate(25deg) translateY(-10px)' } },
  'chip-slide': { '0%': { opacity:'0', transform:'translateY(-16px) scale(0.8)' }, '100%': { opacity:'1', transform:'none' } },
  'fade-in-up': { '0%': { opacity:'0', transform:'translateY(12px)' }, '100%': { opacity:'1', transform:'none' } },
  'shimmer':    { '0%': { backgroundPosition:'-200% center' }, '100%': { backgroundPosition:'200% center' } },
},
```

---

### 2. `apps/client/src/index.css`

**关键改动：**

1. **修复 `#root`**：删除 `width:1126px`、`border-inline`、`text-align:center`，改为全宽全屏
2. **重置 `:root` 变量**：`--bg: #060b18`，`color-scheme: dark`，移除 light 变量
3. **新增 CSS 工具类**：

```css
.table-felt {
  background: radial-gradient(ellipse 80% 65% at 50% 50%, #1a5c38 0%, #0f3d24 55%, #082a18 100%);
}
.table-rail {
  background: linear-gradient(180deg, #5c3a1e 0%, #7a4e2a 30%, #6b4422 60%, #4a2c14 100%);
  box-shadow: inset 0 2px 4px rgba(255,255,255,.12), inset 0 -3px 6px rgba(0,0,0,.5),
              0 0 0 4px #3a2010, 0 4px 20px rgba(0,0,0,.8);
}
.gold-text {
  background: linear-gradient(135deg, #f5c842 0%, #fde68a 50%, #d4a017 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.winner-glow { animation: winner-glow 1.4s ease-in-out infinite; }
.card-shimmer {
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.35) 50%, transparent 60%);
  background-size: 200% auto;
  animation: shimmer 2.5s linear infinite;
}
```

4. **新增所有 7 个 `@keyframes`**（card-deal、chip-pop、winner-glow、card-fold、chip-slide、fade-in-up、shimmer）
5. **清理博客脚手架样式**：删除 `h1`、`h2`、`p`、`code` 全局覆写

---

### 3. `src/components/Card/PlayingCard.tsx`

- **牌背**：`bg-blue-800 border-blue-600` → 深蓝渐变 + 菱形纹理 + 金边
- **牌面**：`bg-white border-gray-200` → `background:#fafaf5` + `border-card-rim/60`；大尺寸加 `animate-card-deal`
- **花色颜色**：`text-gray-900` → `text-slate-900`；`text-red-600` → `text-rose-600`

---

### 4. `src/components/Table/BetDisplay.tsx`

- **每个筹码**：纯色背景 → `radial-gradient(ellipse at 35% 35%, rgba(255,255,255,.4) 0%, ${color} 50%)`
- **动画**：加 `animate-chip-pop` + `animationDelay: i*30ms`（堆叠逐帧弹出）
- **金额文字**：`text-yellow-300` → `gold-text`

---

### 5. `src/components/Player/PlayerSeat.tsx`

- **info box 底色**：`bg-gray-900/80` → `bg-navy-900/85`
- **当前回合**：额外加 `outline outline-2 outline-offset-2 outline-gold-400/70`
- **胜者**：移除内联 `boxShadow`，改用 CSS class `winner-glow`
- **D/SB/BB 徽章**：纯色 → 线性渐变小药丸
- **名字**：自己 `text-yellow-300` → `gold-text`；他人 `text-white` → `text-slate-100`
- **筹码数**：`text-green-400` → `text-emerald-400/90`，去掉 "chips" 文字，前置 `◆`
- **弃牌动画**：`useRef` 追踪状态变化，`非folded→folded` 时设 `isFolding=true` 持续 320ms，给牌 div 加 `animate-card-fold`

---

### 6. `src/components/Table/CommunityCards.tsx`

- **空位占位**：`border-dashed border-white/20` → `border border-white/10 bg-black/20`（无虚线）
- **底池**：`bg-black/40 text-yellow-300` → `bg-black/50 border-gold-700/30 shadow` + `◆` 图标 + `text-gold-300`

---

### 7. `src/components/Table/PokerTable.tsx`

- **毡布**拆为两层：
  - 围边：`inset-2` + `table-rail` CSS class（木纹）
  - 桌面：`inset-5` + `table-felt` CSS class（径向渐变）+ 内阴影
- **下注显示**：加 `key={bet-${player.id}-${amount}}`（值变时重挂载）+ `animate-chip-slide`
- **阶段文字**：`text-white/60` → `text-gold-400/70` + 圆角 pill 背景

---

### 8. `src/components/Actions/ActionPanel.tsx`

- **容器**：`bg-gray-900/90 border-gray-700` → 深海军蓝渐变 + 顶部金线 `borderTop:1px solid rgba(212,160,23,.3)`
- **按钮升级为渐变**：
  - Fold: `from-red-700 to-red-900`
  - Check: `from-slate-600 to-slate-800`
  - Call: `from-blue-600 to-blue-800`（蓝色光晕阴影）
  - All-in: `from-gold-400 to-gold-600`（金色光晕 + `animate-pulse`）
  - Raise: `from-emerald-600 to-emerald-800`
- **筹码面额按钮**：加 3D box-shadow（顶部高光 + 底部阴影）
- **Preset 激活态**：`bg-yellow-600` → `from-gold-400 to-gold-600`

---

### 9. `src/pages/LoginPage.tsx`

- **页面背景**：`bg-gray-950` → `radial-gradient(ellipse 70% 60% at 50% 40%, #152040 0%, #060b18 100%)`
- **卡片面板**：`bg-gray-900 border-gray-700` → `bg-navy-900/80 backdrop-blur-md border-gold-700/40` + 多层 boxShadow
- **标题**：`text-yellow-400` → `gold-text` + 副标题 "Professional Poker"
- **♠ 图标**：加金色 `drop-shadow` 光晕
- **花色水印**：4 个绝对定位 `♠♥♦♣`，`text-white/[0.03]`，角落装饰
- **输入框**：`bg-gray-800 border-gray-600` → `bg-navy-800/60 border-slate-600/50 focus:border-gold-500`
- **按钮**：`bg-yellow-600` → `from-gold-400 to-gold-600` 渐变

---

### 10. `src/pages/LobbyPage.tsx`

- **背景**：`bg-gray-950` → `linear-gradient(180deg, #0c1528 0%, #060b18 50%)`
- **标题**：`text-yellow-400` → `gold-text`
- **创建区**：`bg-gray-900 border-gray-700` → `bg-navy-900/70 border-slate-700/50`
- **所有输入框**：统一 `bg-navy-800/60 border-slate-600/50 focus:border-gold-500`
- **创建/加入按钮**：纯色 → 渐变（create: gold，join: emerald）
- **桌子列表 hover**：加 `hover:border-gold-700/60 hover:shadow-[0_0_0_1px_rgba(212,160,23,.15)]`

---

### 11. `src/pages/GamePage.tsx`

- **Header**：`bg-gray-900 border-gray-800` → 深海军蓝渐变背景
- **主桌区域**：加背景辐射环境光
- **底部操作栏**：`bg-gray-900/50` → `rgba(6,11,24,.8) backdrop-blur`
- **所有按钮**（Start/Confirm）→ 渐变样式
- **连接 spinner `♠`**：加金色 drop-shadow
- **手牌结果条**：`bg-gray-900` → 深海军蓝渐变

---

### 12. `src/components/Game/SessionLeaderboard.tsx`

- **遮罩**：`bg-black/80` → `rgba(0,0,0,.88) backdrop-blur(4px)`
- **弹窗**：`bg-gray-900 border-yellow-700` → 深海军蓝渐变 + `border-gold-700/35` + 内顶部金线
- **标题**：`text-yellow-400` → `gold-text`
- **第1名行**：加 `card-shimmer` 扫光 + 琥珀金半透明背景
- **返回大厅按钮**：`bg-yellow-600` → `from-gold-400 to-gold-600`

---

## 验证方式

1. `pnpm dev` 启动前端 → 访问 http://localhost:5173
2. **LoginPage**：径向蓝渐变背景，金色标题，花色水印，按钮立体感
3. **LobbyPage**：深蓝背景，hover 金色描边光晕
4. **GamePage 桌面**：毡布径向渐变，木纹围边立体
5. **发社区牌**：牌从偏上左角飞入（`card-deal`）
6. **下注**：筹码从上方滑入（`chip-slide`），单筹码弹出（`chip-pop` stagger）
7. **胜者座位**：持续脉冲金色光圈（`winner-glow`）
8. **弃牌**：牌旋转消失（`card-fold`）
9. **操作按钮**：渐变深度，press 有 `scale-95` 反馈
10. **场次结束弹窗**：第1名行扫光效果
