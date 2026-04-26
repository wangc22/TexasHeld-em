import { useState } from 'react';
import type React from 'react';
import { useAuthStore } from '../../store/authStore.js';

interface Props {
  onClose: () => void;
}

const TABS_EN = ['Hand Rankings', 'Game Flow', 'Blinds & Position', 'Betting Actions', 'Side Pots'] as const;
const TABS_ZH = ['牌型大小', '游戏流程', '盲注与位置', '下注动作', '边池'] as const;
type TabIndex = 0 | 1 | 2 | 3 | 4;

function HandRankings() {
  const hands = [
    { name: 'Royal Flush',     nameZh: '皇家同花顺', rank: 'Best',   example: 'A♠ K♠ Q♠ J♠ T♠', desc: 'A-K-Q-J-T of the same suit. Unbeatable.', descZh: '同花色的 A-K-Q-J-T，最强牌型，无法被击败。' },
    { name: 'Straight Flush',  nameZh: '同花顺',     rank: '2nd',    example: '9♥ 8♥ 7♥ 6♥ 5♥', desc: 'Five consecutive cards of the same suit.', descZh: '五张同花色连续牌。' },
    { name: 'Four of a Kind',  nameZh: '四条',       rank: '3rd',    example: 'K♠ K♥ K♦ K♣ 7♠', desc: 'Four cards of the same rank.', descZh: '四张相同点数的牌。' },
    { name: 'Full House',      nameZh: '葫芦',       rank: '4th',    example: 'Q♠ Q♥ Q♦ 8♣ 8♠', desc: 'Three of a kind + a pair. Trips rank decides.', descZh: '三条加一对，以三条点数决定大小。' },
    { name: 'Flush',           nameZh: '同花',       rank: '5th',    example: 'K♦ J♦ 8♦ 5♦ 2♦', desc: 'Five cards of the same suit. Highest card decides.', descZh: '五张同花色，最大单张决定大小。' },
    { name: 'Straight',        nameZh: '顺子',       rank: '6th',    example: '8♠ 7♥ 6♦ 5♣ 4♠', desc: 'Five consecutive ranks. A can be low (A-2-3-4-5) or high (T-J-Q-K-A).', descZh: '五张连续点数，A 可高可低。' },
    { name: 'Three of a Kind', nameZh: '三条',       rank: '7th',    example: 'J♠ J♥ J♦ 9♠ 4♣', desc: 'Three cards of the same rank, two unpaired kickers.', descZh: '三张相同点数加两张散牌。' },
    { name: 'Two Pair',        nameZh: '两对',       rank: '8th',    example: 'T♠ T♥ 6♦ 6♣ A♠', desc: 'Two separate pairs. Highest pair decides.', descZh: '两组对子，较大对子决定大小。' },
    { name: 'One Pair',        nameZh: '一对',       rank: '9th',    example: '7♠ 7♦ K♥ 9♣ 3♠', desc: 'Two cards of the same rank. Pair rank decides.', descZh: '两张相同点数，对子大小决定胜负。' },
    { name: 'High Card',       nameZh: '高牌',       rank: 'Worst',  example: 'A♠ Q♦ 9♥ 6♣ 2♠', desc: 'No combination — highest single card wins.', descZh: '无任何组合，最大单张决定大小。' },
  ];
  const lang = useAuthStore((s) => s.language);

  return (
    <div className="space-y-2">
      {hands.map((h, i) => (
        <div key={h.name} className="flex items-start gap-3 bg-gray-800/60 rounded-lg px-3 py-2">
          <span className="text-xs text-gray-500 w-6 text-right shrink-0 mt-0.5">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm">{lang === 'zh' ? h.nameZh : h.name}</span>
              <span className="font-mono text-xs text-yellow-300">{h.example}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{lang === 'zh' ? h.descZh : h.desc}</div>
          </div>
          <span className="text-xs text-gray-500 shrink-0">{h.rank}</span>
        </div>
      ))}
    </div>
  );
}

function GameFlow() {
  const lang = useAuthStore((s) => s.language);
  const steps = [
    {
      phase: 'Pre-Flop', phaseZh: '翻牌前',
      icon: '🃏',
      color: 'bg-blue-900/50 border-blue-700',
      desc: 'Each player is dealt 2 private hole cards. Small blind posts a forced bet; big blind posts double. Action starts left of the big blind: players can Call, Raise, or Fold.',
      descZh: '每位玩家获得 2 张底牌。小盲注强制下注，大盲注下双倍。行动从大盲左侧开始：可选择跟注、加注或弃牌。',
    },
    {
      phase: 'Flop', phaseZh: '翻牌',
      icon: '🎴',
      color: 'bg-green-900/50 border-green-700',
      desc: 'Three community cards are dealt face-up. Action starts with the first active player left of the dealer.',
      descZh: '三张公共牌正面朝上发出，从庄家左侧第一位活跃玩家开始行动。',
    },
    {
      phase: 'Turn', phaseZh: '转牌',
      icon: '🎯',
      color: 'bg-yellow-900/50 border-yellow-700',
      desc: 'A fourth community card is added (4 total). Same action order as the flop.',
      descZh: '发出第四张公共牌，行动顺序同翻牌圈。',
    },
    {
      phase: 'River', phaseZh: '河牌',
      icon: '🌊',
      color: 'bg-orange-900/50 border-orange-700',
      desc: 'The fifth and final community card is dealt. Last round of betting.',
      descZh: '发出第五张也是最后一张公共牌，最后一轮下注。',
    },
    {
      phase: 'Showdown', phaseZh: '摊牌',
      icon: '🏆',
      color: 'bg-purple-900/50 border-purple-700',
      desc: 'Remaining players reveal their hole cards. Best 5-card hand from the 7 available cards wins the pot.',
      descZh: '剩余玩家亮出底牌，从 7 张牌中组成最佳五张手牌，最强者赢得底池。',
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-gray-400 text-sm">{lang === 'zh' ? '每手牌经历 5 个阶段：' : 'Each hand proceeds through 5 phases:'}</p>
      <div className="flex items-center justify-center gap-1 text-xs text-gray-500 flex-wrap">
        {steps.map((s, i) => (
          <span key={s.phase} className="flex items-center gap-1">
            <span>{lang === 'zh' ? s.phaseZh : s.phase}</span>
            {i < steps.length - 1 && <span>→</span>}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.phase} className={`border rounded-lg p-3 ${s.color}`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{s.icon}</span>
              <span className="font-semibold text-white text-sm">{lang === 'zh' ? s.phaseZh : s.phase}</span>
            </div>
            <p className="text-xs text-gray-300">{lang === 'zh' ? s.descZh : s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlindsAndPosition() {
  const lang = useAuthStore((s) => s.language);
  return (
    <div className="space-y-4 text-sm">
      <div className="bg-gray-800/60 rounded-lg p-3">
        <h3 className="font-semibold text-white mb-2">{lang === 'zh' ? '庄家按钮' : 'Dealer Button'}</h3>
        <p className="text-gray-300 text-xs leading-relaxed">
          {lang === 'zh'
            ? <>庄家按钮 <span className="bg-white text-gray-900 font-bold px-1.5 rounded-full text-xs">D</span> 每手后向左移动一位。庄家在翻牌后最后行动 —— 信息最充分的有利位置。</>
            : <>The dealer button{' '}<span className="bg-white text-gray-900 font-bold px-1.5 rounded-full text-xs">D</span>{' '}moves one seat left after each hand. The dealer acts last postflop — the most advantageous position.</>
          }
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-1.5">SB</span>
            <span className="font-semibold text-white text-sm">{lang === 'zh' ? '小盲注' : 'Small Blind'}</span>
          </div>
          <p className="text-xs text-gray-300">{lang === 'zh' ? <>庄家左侧第一位，强制下注 <strong className="text-yellow-300">半个大盲</strong>。</> : <>First seat left of the dealer. Forced bet of <strong className="text-yellow-300">half the big blind</strong>.</>}</p>
          <p className="text-xs text-gray-400 mt-1">{lang === 'zh' ? '例：大盲 20，小盲下 10。' : 'Example: BB = 20, SB posts 10.'}</p>
        </div>
        <div className="bg-purple-900/40 border border-purple-700 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="bg-purple-500 text-white text-xs font-bold rounded-full px-1.5">BB</span>
            <span className="font-semibold text-white text-sm">{lang === 'zh' ? '大盲注' : 'Big Blind'}</span>
          </div>
          <p className="text-xs text-gray-300">{lang === 'zh' ? <>小盲左侧，强制下 <strong className="text-yellow-300">一个大盲</strong>，翻牌前最后行动。</> : <>Left of the SB. Forced bet of <strong className="text-yellow-300">one big blind</strong>. Acts last pre-flop.</>}</p>
          <p className="text-xs text-gray-400 mt-1">{lang === 'zh' ? '例：大盲 20，下 20。' : 'Example: BB = 20, posts 20.'}</p>
        </div>
      </div>
      <div className="bg-gray-800/60 rounded-lg p-3">
        <h3 className="font-semibold text-white mb-2">{lang === 'zh' ? '位置优势' : 'Positional Advantage'}</h3>
        <div className="space-y-1 text-xs text-gray-300">
          <p>🎯 <strong className="text-white">{lang === 'zh' ? '后位（靠近庄家）：' : 'Late position (near dealer):'}</strong> {lang === 'zh' ? '最后行动，掌握最多信息。' : 'Act last — see everyone else\'s action first. Maximum information.'}</p>
          <p>⚠️ <strong className="text-white">{lang === 'zh' ? '前位（大盲左侧）：' : 'Early position (left of BB):'}</strong> {lang === 'zh' ? '最先行动，信息最少，应收紧起手牌范围。' : 'Act first — least information, play tighter hand selection.'}</p>
          <p>💡 <strong className="text-white">{lang === 'zh' ? '单挑（2 人）：' : 'Heads-up (2 players):'}</strong> {lang === 'zh' ? '庄家 = 小盲；大盲翻牌后先行动。' : 'Dealer = small blind; big blind acts first postflop.'}</p>
        </div>
      </div>
    </div>
  );
}

function BettingActions() {
  const lang = useAuthStore((s) => s.language);
  const actions = [
    {
      name: 'Fold', nameZh: '弃牌',
      color: 'bg-red-800/60 border-red-700', badge: 'bg-red-700',
      when: 'Hand too weak', whenZh: '手牌太弱',
      desc: 'Discard your hand and forfeit any chips already bet. You are out of the current hand.',
      descZh: '放弃手牌，已下注筹码归于底池，退出本手。',
      tip: 'Example: 7-2 offsuit (worst starting hand) — fold and save chips.',
      tipZh: '例：7-2 不同花（最差起手牌）—— 弃牌保存筹码。',
    },
    {
      name: 'Check', nameZh: '过牌',
      color: 'bg-gray-700/60 border-gray-600', badge: 'bg-gray-600',
      when: 'No bet to call', whenZh: '无需跟注',
      desc: 'Pass action to the next player without betting. Only available when no one has bet this round.',
      descZh: '不下注直接过牌，仅在本轮无人下注时可用。',
      tip: 'Example: After the flop with no bet in front, check to see the turn card for free.',
      tipZh: '例：翻牌后无人下注，过牌免费看转牌。',
    },
    {
      name: 'Call', nameZh: '跟注',
      color: 'bg-blue-800/60 border-blue-700', badge: 'bg-blue-700',
      when: 'Hand has potential', whenZh: '手牌有价值',
      desc: 'Match the current highest bet to stay in the hand.',
      descZh: '跟进当前最高注额，留在本手。',
      tip: 'Example: Previous player bet 50 — you put in 50 to call.',
      tipZh: '例：上家下注 50，跟注 50 留局。',
    },
    {
      name: 'Raise', nameZh: '加注',
      color: 'bg-green-800/60 border-green-700', badge: 'bg-green-700',
      when: 'Strong hand, build pot', whenZh: '强牌，做大底池',
      desc: 'Increase the bet above the current amount, forcing others to call or fold. Minimum raise = current bet + last raise size.',
      descZh: '将注额提高至当前之上，迫使他人跟注或弃牌。最小加注 = 当前注额 + 上次加注幅度。',
      tip: 'Example: BB = 20, someone calls 20. You raise to 60 (min raise = 20+20=40, you choose 60).',
      tipZh: '例：大盲 20，有人跟 20，你可加到 60（最小加到 40）。',
    },
    {
      name: 'All-In', nameZh: '全押',
      color: 'bg-yellow-700/60 border-yellow-600', badge: 'bg-yellow-600',
      when: 'Short stack or big bluff', whenZh: '短筹码或大虚张',
      desc: 'Commit all remaining chips to the pot. If your stack is less than the call amount, you go all-in for less and can only win a proportional share (side pot rules apply).',
      descZh: '推入全部筹码。若你的筹码少于跟注额，则以较少筹码全押，只能赢取等比底池（边池规则适用）。',
      tip: 'Example: You have 80 chips, need to call 200. Go all-in for 80 and enter a side pot.',
      tipZh: '例：你有 80 筹码，需跟注 200，以 80 全押并进入边池。',
    },
  ];
  return (
    <div className="space-y-2">
      {actions.map((a) => (
        <div key={a.name} className={`border rounded-lg p-3 ${a.color}`}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-semibold text-white text-sm">{lang === 'zh' ? a.nameZh : a.name}</span>
            <span className={`text-xs ${a.badge} text-white px-2 py-0.5 rounded-full shrink-0`}>
              {lang === 'zh' ? a.whenZh : a.when}
            </span>
          </div>
          <p className="text-xs text-gray-300 mb-1">{lang === 'zh' ? a.descZh : a.desc}</p>
          <p className="text-xs text-yellow-200/70 italic">{lang === 'zh' ? a.tipZh : a.tip}</p>
        </div>
      ))}
    </div>
  );
}

function SidePots() {
  const lang = useAuthStore((s) => s.language);
  return (
    <div className="space-y-3 text-sm">
      <div className="bg-gray-800/60 rounded-lg p-3">
        <h3 className="font-semibold text-white mb-2">{lang === 'zh' ? '为什么会有边池' : 'Why Side Pots Exist'}</h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          {lang === 'zh'
            ? <>当某玩家以少于当前注额的筹码全押时，系统将底池分为<strong className="text-white">主池</strong>（全押玩家可赢取）和一个或多个<strong className="text-white">边池</strong>（仅剩余玩家争夺）。</>
            : <>When a player goes all-in for less than the current bet, the system splits the pot into a <strong className="text-white">main pot</strong> (which the all-in player can win) and one or more <strong className="text-white">side pots</strong> (which only the remaining players contest).</>
          }
        </p>
      </div>
      <div className="bg-gray-800/60 rounded-lg p-3">
        <h3 className="font-semibold text-white mb-2">{lang === 'zh' ? '三人示例' : 'Three-Player Example'}</h3>
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-blue-900/50 rounded p-2">
              <div className="font-semibold text-white">{lang === 'zh' ? '玩家 A' : 'Player A'}</div>
              <div className="text-gray-400">{lang === 'zh' ? '全押 100' : 'All-In 100'}</div>
            </div>
            <div className="bg-green-900/50 rounded p-2">
              <div className="font-semibold text-white">{lang === 'zh' ? '玩家 B' : 'Player B'}</div>
              <div className="text-gray-400">{lang === 'zh' ? '下注 300' : 'Bets 300'}</div>
            </div>
            <div className="bg-purple-900/50 rounded p-2">
              <div className="font-semibold text-white">{lang === 'zh' ? '玩家 C' : 'Player C'}</div>
              <div className="text-gray-400">{lang === 'zh' ? '下注 300' : 'Bets 300'}</div>
            </div>
          </div>
          <div className="bg-gray-700/50 rounded p-2 space-y-1">
            <p>🏦 <strong className="text-yellow-300">{lang === 'zh' ? '主池：300' : 'Main pot: 300'}</strong> (A×100 + B×100 + C×100) — {lang === 'zh' ? 'A、B、C 均可赢' : 'A, B, C all eligible'}</p>
            <p>💰 <strong className="text-blue-300">{lang === 'zh' ? '边池：400' : 'Side pot: 400'}</strong> (B×200 + C×200) — {lang === 'zh' ? '仅 B 和 C 可赢' : 'only B and C eligible'}</p>
          </div>
          <p className="text-gray-400">
            {lang === 'zh'
              ? 'A 若手牌最强：赢得主池（300）。B 或 C（手牌较强者）赢得边池（400）。'
              : 'If A has the best hand: A wins the main pot (300). B or C (whoever has the better hand) wins the side pot (400).'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function GuideModal({ onClose }: Props) {
  const lang = useAuthStore((s) => s.language);
  const [activeTab, setActiveTab] = useState<TabIndex>(0);

  const TABS = lang === 'zh' ? TABS_ZH : TABS_EN;

  const content: React.ReactElement[] = [
    <HandRankings />,
    <GameFlow />,
    <BlindsAndPosition />,
    <BettingActions />,
    <SidePots />,
  ];

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-lg font-bold text-white">{lang === 'zh' ? '图文教程' : 'How to Play'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="flex border-b border-gray-700 shrink-0 overflow-x-auto">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i as TabIndex)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                ${activeTab === i
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {content[activeTab]}
        </div>

        <div className="flex justify-between items-center px-5 py-3 border-t border-gray-700 shrink-0">
          <button
            onClick={() => setActiveTab((t) => Math.max(0, t - 1) as TabIndex)}
            disabled={activeTab === 0}
            className="text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            {lang === 'zh' ? '← 上一页' : '← Previous'}
          </button>
          <span className="text-xs text-gray-500">{activeTab + 1} / {TABS.length}</span>
          <button
            onClick={() => setActiveTab((t) => Math.min(TABS.length - 1, t + 1) as TabIndex)}
            disabled={activeTab === TABS.length - 1}
            className="text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            {lang === 'zh' ? '下一页 →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
