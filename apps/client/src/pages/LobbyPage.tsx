import { useState, useEffect } from 'react';
import { getSocket } from '../socket/socketClient.js';
import { useGameStore } from '../store/gameStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useMusicStore } from '../store/musicStore.js';
import { MusicPlayer } from '../components/Audio/MusicPlayer.js';
import { TutorialModal } from '../components/Tutorial/TutorialModal.js';
import { GuideModal } from '../components/Tutorial/GuideModal.js';
import { EVENTS } from '@texas-poker/shared';
import { useLang } from '../i18n/useLang.js';
import { apiBaseUrl } from '../config/env.js';

interface TableInfo {
  tableId: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
}

interface Props {
  onJoinTable: (tableId: string) => void;
}

const CHIP_PRESETS = [
  { label: 'Standard', chips: [2, 5, 10, 20, 50] },
  { label: 'High Stakes', chips: [5, 10, 25, 100, 500] },
  { label: 'Custom', chips: null },
] as const;

const glassPanel = {
  background: 'rgba(10, 18, 38, 0.72)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.07)',
  boxShadow: '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
};

const inputStyle = {
  background: 'rgba(21,32,64,0.6)',
  border: '1px solid rgba(100,116,139,0.3)',
};

export function LobbyPage({ onJoinTable }: Props) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [newTableName, setNewTableName] = useState('');
  const [loading, setLoading] = useState(false);
  const [buyIn, setBuyIn] = useState('1000');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [chipPreset, setChipPreset] = useState<'Standard' | 'High Stakes' | 'Custom'>('Standard');
  const [customChips, setCustomChips] = useState('2, 5, 10, 20, 50');
  const [maxHands, setMaxHands] = useState('0');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const playerName = useAuthStore((s) => s.playerName);
  const { setLanguage, language } = useAuthStore();
  const error = useGameStore((s) => s.error);
  const { isMuted, toggleMute } = useMusicStore();
  const strings = useLang();
  const t = strings.lobby;
  const tGame = strings.game;
  const phaseLabel = (phase: string) => (t.phase as Record<string, string>)[phase] ?? phase.replace(/_/g, ' ');

  const getChipDenominations = (): number[] => {
    if (chipPreset === 'Custom') {
      return customChips
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)
        .slice(0, 8)
        .sort((a, b) => a - b);
    }
    return [...(CHIP_PRESETS.find((p) => p.label === chipPreset)?.chips ?? [2, 5, 10, 20, 50])];
  };

  const fetchTables = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/tables`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { tables: TableInfo[] };
      setTables(data.tables);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setFetchError(t.error(msg));
    }
  };

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 3000);
    return () => clearInterval(interval);
  }, []);

  const createTable = async () => {
    if (!newTableName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTableName.trim(),
          chipDenominations: getChipDenominations(),
          maxHands: (() => { const v = parseInt(maxHands, 10); return v > 0 ? Math.min(v, 100) : 0; })(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        setFetchError(errData.error ?? `Failed to create table: HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const data = await res.json() as { tableId: string };
      setLoading(false);
      setNewTableName('');
      joinTable(data.tableId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setFetchError(`Failed to create table: ${msg}`);
      setLoading(false);
    }
  };

  const joinTable = (tableId: string) => {
    const socket = getSocket();
    const doJoin = () => {
      socket.emit(EVENTS.GAME_JOIN_TABLE, {
        tableId,
        playerName: playerName ?? 'Player',
        buyIn: (() => { const v = parseInt(buyIn, 10); return v > 0 ? Math.min(v, 100000) : 1000; })(),
      });
      onJoinTable(tableId);
    };
    if (socket.connected) {
      doJoin();
    } else {
      const timeoutId = setTimeout(() => {
        socket.off('connect', handleConnect);
        setFetchError(t.timeout);
      }, 5000);
      const handleConnect = () => {
        clearTimeout(timeoutId);
        doJoin();
      };
      socket.once('connect', handleConnect);
      socket.connect();
    }
  };

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse 90% 70% at 50% 20%, #0f1e42 0%, #060b18 70%)',
      }}
    >
      {/* Suit watermarks */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
        {(['♠', '♥', '♦', '♣'] as const).map((s, i) => (
          <span
            key={i}
            className="absolute font-bold"
            style={{
              fontSize: '18rem',
              color: 'rgba(255,255,255,0.018)',
              top: ['5%', '45%', '15%', '60%'][i],
              left: ['2%', '62%', '70%', '12%'][i],
              transform: 'rotate(-12deg)',
            }}
          >
            {s}
          </span>
        ))}
      </div>

      <MusicPlayer />
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 min-h-screen flex flex-col">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-4xl font-bold gold-text tracking-tight">♠ Texas Hold'em</h1>
            <p className="text-slate-500 text-xs uppercase tracking-[0.18em] mt-1">
              Professional Poker
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(true)}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ ...glassPanel, color: '#e2e8f0' }}
            >
              {tGame.ruleBtn}
            </button>
            <button
              onClick={() => setShowTutorial(true)}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ ...glassPanel, color: '#e2e8f0' }}
            >
              {tGame.tutorialBtn}
            </button>
            <div
              className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-xl"
              style={glassPanel}
            >
              <span className="text-slate-400 text-xs">{t.welcome}</span>
              <span className="text-white text-sm font-semibold">{playerName}</span>
            </div>
          </div>
        </div>

        {/* ── Error bar ───────────────────────────────────────────────────── */}
        {(error || fetchError) && (
          <div className="bg-red-900/35 border border-red-700/50 text-red-300 rounded-xl p-3 mb-5 text-sm flex justify-between items-start animate-fade-in-up">
            <span>{error ?? fetchError}</span>
            <button onClick={() => setFetchError(null)} className="ml-3 text-red-400 hover:text-white">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-5 flex-1">
        {/* ── CREATE ROOM ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl p-5 animate-fade-in-up xl:col-span-7" style={glassPanel}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🎰</span>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
              {t.createRoom}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input
              type="text"
              placeholder={t.roomNamePlaceholder}
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createTable()}
              className="flex-1 min-w-[220px] text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-all"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(212,160,23,0.5)')}
              onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(100,116,139,0.3)')}
            />
            <div className="flex items-center gap-1.5 text-sm text-slate-400 shrink-0">
              <span className="text-xs">{t.buyIn}</span>
              <input
                type="number"
                value={buyIn}
                onChange={(e) => setBuyIn(e.target.value)}
                onBlur={() => { const v = parseInt(buyIn, 10); setBuyIn(String(v > 0 ? Math.min(v, 100000) : 1000)); }}
                max={100000}
                className="w-20 text-white rounded-xl px-2 py-2.5 text-sm focus:outline-none"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(212,160,23,0.5)')}
              />
            </div>
            <button
              onClick={createTable}
              disabled={loading || !newTableName.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold shrink-0 transition-all active:scale-95 disabled:opacity-40 md:min-w-[110px]"
              style={{
                background: 'linear-gradient(180deg,#f5c842 0%,#b8860b 100%)',
                color: '#060b18',
                boxShadow: '0 2px 10px rgba(212,160,23,0.3)',
              }}
            >
              {loading ? t.creating : t.create}
            </button>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
          >
            <span>{showAdvanced ? '▾' : '▸'}</span>
            {t.advancedChip}
          </button>

          {showAdvanced && (
            <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 whitespace-nowrap">{t.maxHands}</span>
                <input
                  type="number" min={0} value={maxHands}
                  onChange={(e) => setMaxHands(e.target.value)}
                  onBlur={() => { const v = parseInt(maxHands, 10); setMaxHands(String(v > 0 ? Math.min(v, 100) : 0)); }}
                  max={100}
                  className="w-20 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(212,160,23,0.5)')}
                />
                <span className="text-xs text-slate-500">
                  {(parseInt(maxHands, 10) || 0) === 0 ? t.unlimited : t.handsLabel(parseInt(maxHands, 10))}
                </span>
              </div>

              <div className="flex gap-2">
                {CHIP_PRESETS.map((p) => {
                  const isActive = chipPreset === p.label;
                  return (
                    <button
                      key={p.label}
                      onClick={() => setChipPreset(p.label as typeof chipPreset)}
                      className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all active:scale-95"
                      style={isActive
                        ? { background: 'linear-gradient(180deg,#f5c842 0%,#b8860b 100%)', borderColor: '#d4a017', color: '#060b18' }
                        : { background: 'rgba(21,32,64,0.5)', borderColor: 'rgba(100,116,139,0.3)', color: '#94a3b8' }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {chipPreset !== 'Custom' ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500">{t.denominations}</span>
                  {getChipDenominations().map((d) => (
                    <span key={d} className="text-xs text-slate-300 px-2 py-0.5 rounded-full font-mono"
                      style={{ background: 'rgba(30,47,92,0.7)' }}>
                      {d}
                    </span>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    {t.customDenoms}
                  </label>
                  <input
                    type="text" value={customChips}
                    onChange={(e) => setCustomChips(e.target.value)}
                    placeholder={t.customPlaceholder}
                    className="w-full text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(212,160,23,0.5)')}
                    onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(100,116,139,0.3)')}
                  />
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {getChipDenominations().map((d) => (
                      <span key={d} className="text-xs text-slate-300 px-2 py-0.5 rounded-full font-mono"
                        style={{ background: 'rgba(30,47,92,0.7)' }}>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── ACTIVE TABLES ───────────────────────────────────────────────── */}
        <section className="rounded-2xl p-5 animate-fade-in-up xl:col-span-5 xl:min-h-[420px]" style={glassPanel}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎮</span>
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
                {t.activeTables}
              </h2>
            </div>
            <button
              onClick={fetchTables}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              {t.refresh}
            </button>
          </div>

          {tables.length === 0 ? (
            <div className="text-center text-slate-600 py-8 text-sm">
              {t.noTables}
            </div>
          ) : (
            <div className="space-y-2">
              {tables.map((table) => {
                const full = table.playerCount >= table.maxPlayers;
                return (
                  <div
                    key={table.tableId}
                    className="btn-press flex items-center justify-between rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,160,23,0.3)';
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.055)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onClick={() => !full && joinTable(table.tableId)}
                  >
                    <div>
                      <div className="font-semibold text-slate-100 text-sm">{table.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {t.playerCount(table.playerCount, table.maxPlayers, phaseLabel(table.phase))}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); joinTable(table.tableId); }}
                      disabled={full}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 text-white"
                      style={{
                        background: full
                          ? 'rgba(30,47,92,0.4)'
                          : 'linear-gradient(180deg,#059669 0%,#064e3b 100%)',
                        boxShadow: full ? 'none' : '0 2px 6px rgba(0,0,0,0.4)',
                      }}
                    >
                      {full ? t.full : t.join}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 3-tile bottom row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 animate-fade-in-up xl:col-span-12">

          {/* HOW TO PLAY */}
          <div
            className="btn-press rounded-2xl p-5 flex flex-col items-start"
            style={glassPanel}
            onClick={() => setShowGuide(true)}
          >
            <div className="text-2xl mb-3">📖</div>
            <div className="text-sm font-semibold text-slate-200 mb-1">{t.howToPlay}</div>
            <div className="text-xs text-slate-500 leading-relaxed">
              {t.howToPlayDesc}
            </div>
          </div>

          {/* ACCOUNT (placeholder) */}
          <div
            className="rounded-2xl p-5 flex flex-col items-start relative overflow-hidden"
            style={{
              ...glassPanel,
              opacity: 0.6,
              cursor: 'default',
            }}
          >
            <div className="text-2xl mb-3">👤</div>
            <div className="text-sm font-semibold text-slate-300 mb-1">{t.account}</div>
            <div className="text-xs text-slate-500 leading-relaxed">
              {t.accountDesc}
            </div>
            <span
              className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(212,160,23,0.15)', color: 'rgba(212,160,23,0.7)', border: '1px solid rgba(212,160,23,0.2)' }}
            >
              {t.soon}
            </span>
          </div>

          {/* SETTINGS */}
          <div
            className="btn-press rounded-2xl p-5 flex flex-col items-start"
            style={glassPanel}
            onClick={() => setShowSettings((v) => !v)}
          >
            <div className="text-2xl mb-3">⚙️</div>
            <div className="text-sm font-semibold text-slate-200 mb-1">{t.settings}</div>
            <div className="text-xs text-slate-500 leading-relaxed">
              {t.settingsDesc}
            </div>
          </div>
        </div>

        {/* Settings inline panel */}
        {showSettings && (
          <div
            className="rounded-2xl p-4 animate-fade-in-up space-y-3 xl:col-span-12"
            style={glassPanel}
          >
            {/* Music toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 font-medium">{t.music}</span>
              <button
                onClick={toggleMute}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all active:scale-95"
                style={{
                  background: isMuted ? 'rgba(30,47,92,0.6)' : 'rgba(5,150,105,0.25)',
                  border: `1px solid ${isMuted ? 'rgba(100,116,139,0.3)' : 'rgba(5,150,105,0.4)'}`,
                  color: isMuted ? '#94a3b8' : '#34d399',
                }}
              >
                <span>{isMuted ? '🔇' : '🎵'}</span>
                <span>{isMuted ? t.musicOff : t.musicOn}</span>
              </button>
            </div>

            {/* Language toggle */}
            <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              <span className="text-sm text-slate-300 font-medium">{t.language}</span>
              <div className="flex gap-1">
                {(['en', 'zh'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-95"
                    style={language === lang
                      ? { background: 'linear-gradient(180deg,#f5c842 0%,#b8860b 100%)', color: '#060b18' }
                      : { background: 'rgba(30,47,92,0.6)', border: '1px solid rgba(100,116,139,0.3)', color: '#94a3b8' }}
                  >
                    {lang === 'en' ? 'EN' : '中文'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-700 text-xs mt-6">
          {t.footer}
        </p>
      </div>
    </div>
  );
}
