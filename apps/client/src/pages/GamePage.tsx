import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useAuthStore } from '../store/authStore.js';
import { PokerTable } from '../components/Table/PokerTable.js';
import { ActionPanel } from '../components/Actions/ActionPanel.js';
import { VoicePanel } from '../components/Voice/VoicePanel.js';
import { TutorialModal } from '../components/Tutorial/TutorialModal.js';
import { GuideModal } from '../components/Tutorial/GuideModal.js';
import { MusicPlayer } from '../components/Audio/MusicPlayer.js';
import { SessionLeaderboard } from '../components/Game/SessionLeaderboard.js';
import { HandHistoryPanel } from '../components/Game/HandHistoryPanel.js';
import { BotThoughtPanel } from '../components/Game/BotThoughtPanel.js';
import { AddBotModal, type BotStyle } from '../components/Game/AddBotModal.js';
import { QuickChatMenu } from '../components/Game/QuickChatMenu.js';
import { useMusicStore } from '../store/musicStore.js';
import { getSocket } from '../socket/socketClient.js';
import { EVENTS } from '@texas-poker/shared';
import type { Card } from '@texas-poker/shared';
import { useLang } from '../i18n/useLang.js';

interface Props {
  tableId: string;
  onLeave: () => void;
}

function useDeadlineCountdown(deadlineMs: number | null | undefined): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!deadlineMs) { setRemaining(null); return; }
    const tick = () => {
      const r = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadlineMs]);
  return remaining;
}

const headerBtnStyle = {
  background: 'rgba(21,32,64,0.6)',
  border: '1px solid rgba(100,116,139,0.3)',
};

export function GamePage({ tableId, onLeave }: Props) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBotThoughts, setShowBotThoughts] = useState(false);
  const [botThoughtFilter, setBotThoughtFilter] = useState<string | undefined>(undefined);
  const [showAddBot, setShowAddBot] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const gameState = useGameStore((s) => s.gameState);
  const lastHandResult = useGameStore((s) => s.lastHandResult);
  const sessionResult = useGameStore((s) => s.sessionResult);
  const error = useGameStore((s) => s.error);
  const myId = useAuthStore((s) => s.playerId);
  const { isMuted, toggleMute } = useMusicStore();
  const socket = getSocket();
  const t = useLang().game;

  // Emit GAME_LEAVE_TABLE on real unmount. The ref persists across StrictMode's
  // simulated unmount/remount cycle — only a genuine navigation sets it to false.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Defer so StrictMode's remount can flip mountedRef back to true first.
      const ref = mountedRef;
      setTimeout(() => {
        if (!ref.current) {
          socket.emit(EVENTS.GAME_LEAVE_TABLE, { tableId });
        }
      }, 100);
    };
  }, [tableId, socket]);

  // Bug 8: 10s connection timeout
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (gameState) {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      return;
    }
    connectTimeoutRef.current = setTimeout(() => {
      useGameStore.getState().setError(t.connectTimeout);
    }, 10_000);
    return () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    };
  }, [gameState]);

  const confirmCountdown = useDeadlineCountdown(gameState?.confirmDeadlineMs);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white"
        style={{ background: '#060b18' }}>
        {error ? (
          <div className="text-center space-y-4 animate-fade-in-up">
            <div className="text-red-400 text-lg">{error}</div>
            <button
              onClick={() => { socket.emit(EVENTS.GAME_LEAVE_TABLE, { tableId }); onLeave(); }}
              className="px-6 py-2 rounded-lg text-white transition-colors"
              style={{ background: 'rgba(21,32,64,0.7)', border: '1px solid rgba(100,116,139,0.3)' }}
            >
              {t.backToLobby}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div
              className="animate-spin text-5xl mb-4"
              style={{ filter: 'drop-shadow(0 0 10px rgba(212,160,23,0.6))', color: '#f5c842' }}
            >
              ♠
            </div>
            <div className="text-slate-400">{t.connecting}</div>
          </div>
        )}
      </div>
    );
  }

  const myPlayer = gameState.players.find((p) => p.id === myId);
  const isMyTurn = myPlayer && myPlayer.seatIndex === gameState.currentPlayerSeatIndex && !myPlayer.isBot;
  const isHost = gameState.hostPlayerId === myId;
  const sessionStarted = gameState.sessionStarted;
  const phase = gameState.phase;
  const isPaused = gameState.isPaused ?? false;

  const showActionPanel = isMyTurn && phase !== 'waiting' && phase !== 'hand_complete' && !isPaused;
  const showStartSession = !sessionStarted && (phase === 'waiting' || phase === 'hand_complete') && isHost;
  const showWaitingForHost = !sessionStarted && (phase === 'waiting' || phase === 'hand_complete') && !isHost;
  const showConfirmButton = sessionStarted && phase === 'hand_complete' && myPlayer && !myPlayer.isBot && !myPlayer.isReady;
  const showWaitingForConfirm = sessionStarted && phase === 'hand_complete' && (!myPlayer || myPlayer.isReady);
  const enoughPlayers = gameState.players.filter((p) => p.chipStack > 0 && !p.isBot).length >= 1
    && gameState.players.filter((p) => p.chipStack > 0).length >= 2;

  const handleLeave = () => {
    socket.emit(EVENTS.GAME_LEAVE_TABLE, { tableId });
    useGameStore.getState().clearGameState();
    onLeave();
  };
  const handleConfirmResult = () => { socket.emit(EVENTS.GAME_CONFIRM_RESULT, { tableId }); };
  const handlePause  = () => { socket.emit(EVENTS.GAME_PAUSE,  { tableId }); };
  const handleResume = () => { socket.emit(EVENTS.GAME_RESUME, { tableId }); };

  const formatCard = (c: Card) => {
    const suitSymbol = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[c.suit];
    const isRed = c.suit === 'hearts' || c.suit === 'diamonds';
    return <span key={`${c.rank}${c.suit}`} className={isRed ? 'text-rose-500' : 'text-slate-800'}>{c.rank}{suitSymbol}</span>;
  };

  const humanPlayers = gameState.players.filter((p) => !p.isBot && p.chipStack > 0);
  const confirmedCount = humanPlayers.filter((p) => p.isReady).length;

  return (
    <div className="h-screen overflow-hidden text-white flex flex-col" style={{ background: '#060b18' }}>
      <MusicPlayer />
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
      {showHistory && (
        <HandHistoryPanel history={gameState.handHistory ?? []} onClose={() => setShowHistory(false)} />
      )}
      {showBotThoughts && (
        <BotThoughtPanel
          filterBotName={botThoughtFilter}
          onClose={() => { setShowBotThoughts(false); setBotThoughtFilter(undefined); }}
        />
      )}
      {showAddBot && gameState && (
        <AddBotModal
          currentBotCount={gameState.players.filter((p) => p.isBot).length}
          onAdd={(name, style: BotStyle) => {
            socket.emit(EVENTS.GAME_ADD_BOT, { tableId, botName: name, difficulty: style });
          }}
          onClose={() => setShowAddBot(false)}
        />
      )}
      {showChat && (
        <QuickChatMenu
          onSend={(content, contentType) => {
            socket.emit(EVENTS.GAME_CHAT, { tableId, content, contentType });
          }}
          onClose={() => setShowChat(false)}
        />
      )}
      {sessionResult && (
        <SessionLeaderboard
          result={sessionResult}
          onClose={() => useGameStore.getState().setSessionResult(null)}
          onLeave={handleLeave}
        />
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-1.5 shrink-0"
        style={{
          background: 'linear-gradient(180deg, #0c1528 0%, #080f1e 100%)',
          borderBottom: '1px solid rgba(100,116,139,0.2)',
        }}
      >
        <div className="text-xs text-slate-400 tracking-wide flex items-center gap-2">
          <span>
            Hand <span className="text-slate-200 font-semibold">#{gameState.handNumber}</span>
            {gameState.config.maxHands > 0 && (
              <span className="text-slate-600"> / {gameState.config.maxHands}</span>
            )}
          </span>
          <span className="text-slate-600">·</span>
          <span className="capitalize text-gold-300 font-semibold">{gameState.phase.replace('_', ' ')}</span>
          {isHost && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
              style={{ background: 'rgba(212,160,23,0.15)', color: '#f5c842', border: '1px solid rgba(212,160,23,0.3)' }}>
              {t.host}
            </span>
          )}
          {isPaused && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse"
              style={{ background: 'rgba(234,88,12,0.15)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.3)' }}>
              {t.paused}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {myId && <VoicePanel tableId={tableId} playerId={myId} />}

          {/* Pause / Resume — host only during active hand */}
          {isHost && sessionStarted && ['pre_flop','flop','turn','river'].includes(phase) && (
            isPaused ? (
              <button onClick={handleResume}
                className="text-xs px-2.5 py-1 rounded text-white transition-all"
                style={{ background: 'rgba(5,150,105,0.25)', border: '1px solid rgba(5,150,105,0.4)' }}>
                {t.resume}
              </button>
            ) : (
              <button onClick={handlePause}
                className="text-xs px-2.5 py-1 rounded text-white transition-all"
                style={{ background: 'rgba(234,88,12,0.2)', border: '1px solid rgba(234,88,12,0.35)' }}>
                {t.pause}
              </button>
            )
          )}

          {/* Share link button */}
          <button
            onClick={() => {
              const url = `${window.location.origin}/#room/${tableId}`;
              navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="text-sm px-3 py-1 text-slate-300 rounded-md transition-colors hover:text-white"
            style={headerBtnStyle}
            title={t.copyLink}>
            {copied ? t.copied : t.share}
          </button>

          {/* Chat button */}
          <button
            onClick={() => setShowChat((v) => !v)}
            className="text-sm px-3 py-1 rounded-md transition-colors"
            style={showChat
              ? { background: 'rgba(30,63,124,0.7)', border: '1px solid rgba(100,130,200,0.5)', color: '#93c5fd' }
              : { ...headerBtnStyle, color: '#94a3b8' }}
            title={t.quickChat}
          >
            {t.chatBtn}
          </button>

          {[
            { label: t.historyBtn, action: () => setShowHistory(true) },
            { label: t.allThoughts, action: () => { setBotThoughtFilter(undefined); setShowBotThoughts(true); } },
          ].map(({ label, action }) => (
            <button key={label} onClick={action}
              className="text-sm px-3 py-1 text-slate-300 rounded-md transition-colors hover:text-white"
              style={headerBtnStyle}>
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="text-sm px-3 py-1 text-slate-300 rounded-md transition-colors hover:text-white"
            style={headerBtnStyle}
          >
            {t.ruleBtn}
          </button>
          <button
            type="button"
            onClick={() => setShowTutorial(true)}
            className="text-sm px-3 py-1 text-slate-300 rounded-md transition-colors hover:text-white"
            style={headerBtnStyle}
          >
            {t.tutorialBtn}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="text-sm px-3 py-1 text-slate-300 rounded-md transition-colors hover:text-white"
            style={headerBtnStyle}
          >
            {isMuted ? '🔇' : '🎵'}
          </button>

          {/* Add Bot button — shows modal */}
          {(() => {
            const botCount = gameState.players.filter((p) => p.isBot).length;
            const atLimit = botCount >= 3;
            return (
              <button
                onClick={() => !atLimit && setShowAddBot(true)}
                disabled={atLimit}
                className="text-sm px-3 py-1 text-white rounded-md transition-colors disabled:opacity-40"
                style={{ background: 'rgba(109,40,217,0.3)', border: '1px solid rgba(109,40,217,0.4)' }}
                title={atLimit ? t.botLimitTooltip : t.addBot(0)}
              >
                {t.addBot(botCount)}
              </button>
            );
          })()}
          <button onClick={handleLeave}
            className="text-sm px-3 py-1 text-slate-300 rounded-md transition-colors hover:text-white"
            style={headerBtnStyle}>
            {t.leave}
          </button>
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="text-red-300 text-sm py-2 px-4 flex justify-between items-center"
          style={{ background: 'rgba(127,29,29,0.4)', borderBottom: '1px solid rgba(153,27,27,0.5)' }}>
          <span>{error}</span>
          <button onClick={() => useGameStore.getState().setError(null)}
            className="ml-4 text-red-400 hover:text-white leading-none">✕</button>
        </div>
      )}

      {/* Pause banner */}
      {isPaused && (
        <div className="text-center py-3 font-semibold text-sm"
          style={{ background: 'rgba(124,45,18,0.5)', borderBottom: '1px solid rgba(194,65,12,0.4)', color: '#fdba74' }}>
          {t.gamePaused}
        </div>
      )}

      {/* Last hand result */}
      {lastHandResult && phase === 'hand_complete' && (
        <div className="px-4 py-3 animate-fade-in-up"
          style={{ background: 'linear-gradient(180deg,rgba(12,21,40,0.97) 0%,rgba(6,11,24,0.97) 100%)', borderBottom: '1px solid rgba(212,160,23,0.2)' }}>
          <div className="text-center text-gold-300 font-bold text-sm mb-2">
            {lastHandResult.winners.map((w) => {
              const p = gameState.players.find((pl) => pl.id === w.playerId);
              return (
                <span key={w.playerId} className="mr-3">
                  🏆 {p?.name ?? w.playerId} +{w.amount}
                  {w.handRank && <span className="text-gold-400/60 font-normal ml-1">({w.handRank.name.replace(/_/g, ' ')})</span>}
                </span>
              );
            })}
          </div>
          {lastHandResult.handRanks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {lastHandResult.handRanks.map(({ playerId, handRank, holeCards }) => {
                const p = gameState.players.find((pl) => pl.id === playerId);
                const isWinner = lastHandResult.winners.some((w) => w.playerId === playerId);
                return (
                  <div key={playerId}
                    className="text-center text-xs rounded-lg px-3 py-2"
                    style={isWinner
                      ? { background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.4)' }
                      : { background: 'rgba(21,32,64,0.6)', border: '1px solid rgba(100,116,139,0.25)' }}>
                    <div className="font-semibold text-slate-100 mb-1">{p?.name ?? playerId}</div>
                    <div className="text-base font-mono tracking-wider space-x-1">
                      {holeCards.map((c) => formatCard(c))}
                    </div>
                    <div className="text-slate-400 mt-1 capitalize">{handRank.name.replace(/_/g, ' ')}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main table */}
      <div className="w-full flex-1 min-h-0 p-2 overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(21,32,64,0.5) 0%, transparent 100%)' }}>
        <PokerTable
          gameState={gameState}
          onViewBotThoughts={(botName) => {
            setBotThoughtFilter(botName);
            setShowBotThoughts(true);
          }}
        />
      </div>

      {/* Bottom controls */}
      <div className="px-4 py-2 shrink-0 overflow-x-auto" style={{ background: 'rgba(6,11,24,0.85)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(100,116,139,0.18)' }}>
        {showActionPanel && myPlayer ? (
          <ActionPanel player={myPlayer} gameState={gameState} />
        ) : showStartSession ? (
          <div className="flex justify-center">
            <button
              onClick={() => socket.emit(EVENTS.GAME_SESSION_START, { tableId })}
              disabled={!enoughPlayers}
              className="px-8 py-3 rounded-xl font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-40 text-navy-950"
              style={{ background: 'linear-gradient(180deg,#f5c842 0%,#b8860b 100%)',
                       boxShadow: '0 4px 20px rgba(212,160,23,0.4)' }}
            >
              {enoughPlayers ? t.startSession : t.needPlayers}
            </button>
          </div>
        ) : showWaitingForHost ? (
          <div className="text-center text-slate-500 text-sm py-2">
            {t.waitingHost}
          </div>
        ) : showConfirmButton ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleConfirmResult}
              className="px-8 py-3 rounded-xl font-bold text-lg text-white transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(180deg,#059669 0%,#064e3b 100%)',
                       boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
            >
              {t.confirmResult}
            </button>
            <div className="text-xs text-slate-500">
              {t.confirmed(confirmedCount, humanPlayers.length)}
              {confirmCountdown != null && confirmCountdown > 0 && (
                <span className="ml-2 text-gold-600/80">{t.autoConfirm(confirmCountdown)}</span>
              )}
            </div>
          </div>
        ) : showWaitingForConfirm ? (
          <div className="text-center py-2">
            <div className="text-slate-400 text-sm">
              {t.waitingConfirm(confirmedCount, humanPlayers.length)}
            </div>
            {confirmCountdown != null && confirmCountdown > 0 && (
              <div className="text-xs text-gold-600/60 mt-1">{t.autoConfirm(confirmCountdown)}</div>
            )}
            <div className="flex justify-center gap-1.5 mt-2">
              {humanPlayers.map((p) => (
                <span key={p.id}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={p.isReady
                    ? { background: 'rgba(4,120,87,0.3)', color: '#6ee7b7' }
                    : { background: 'rgba(21,32,64,0.5)', color: '#64748b' }}>
                  {p.name} {p.isReady ? '✓' : '…'}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500 text-sm py-2">
            {gameState.players.find(p => p.seatIndex === gameState.currentPlayerSeatIndex)?.name
              ? t.waitingTurn(gameState.players.find(p => p.seatIndex === gameState.currentPlayerSeatIndex)!.name)
              : t.waiting}
          </div>
        )}
      </div>
    </div>
  );
}
