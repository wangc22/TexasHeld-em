import { useState } from 'react';
import { connectSocket } from '../socket/socketClient.js';
import { useAuthStore } from '../store/authStore.js';
import { useLang } from '../i18n/useLang.js';
import { apiBaseUrl } from '../config/env.js';

interface Props {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();
  const t = useLang().login;

  const handleLogin = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiBaseUrl}/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) throw new Error('Login failed');

      const data = await res.json() as { playerId: string; name: string; token: string };
      setAuth(data.playerId, data.name, data.token);
      connectSocket(data.token);
      onLogin();
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 40%, #152040 0%, #060b18 100%)' }}
    >
      {/* Suit watermarks */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
        {(['♠', '♥', '♦', '♣'] as const).map((s, i) => (
          <span
            key={i}
            className="absolute font-bold"
            style={{
              fontSize: '10rem',
              color: 'rgba(255,255,255,0.03)',
              top:  ['8%',  '52%', '18%', '62%'][i],
              left: ['4%',  '68%', '78%', '18%'][i],
              transform: 'rotate(-15deg)',
            }}
          >
            {s}
          </span>
        ))}
      </div>

      {/* Glass card */}
      <div
        className="relative z-10 rounded-2xl p-8 w-full max-w-sm animate-fade-in-up"
        style={{
          background: 'rgba(12,21,40,0.82)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(212,160,23,0.2)',
          boxShadow: '0 0 0 1px rgba(212,160,23,0.08), 0 32px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="text-6xl mb-3 select-none"
            style={{ filter: 'drop-shadow(0 0 14px rgba(212,160,23,0.65))' }}
          >
            ♠
          </div>
          <h1 className="text-2xl font-bold gold-text tracking-wide">Texas Hold'em</h1>
          <p className="text-slate-500 text-xs uppercase tracking-[0.2em] mt-2">{t.subtitle}</p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder={t.placeholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            maxLength={30}
            className="w-full text-white placeholder-slate-500 rounded-xl px-4 py-3
              focus:outline-none transition-all duration-200 text-sm"
            style={{
              background: 'rgba(21,32,64,0.7)',
              border: '1px solid rgba(100,116,139,0.4)',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'rgba(212,160,23,0.55)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212,160,23,0.1)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'rgba(100,116,139,0.4)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            autoFocus
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading || !name.trim()}
            className="w-full py-3 rounded-xl font-bold text-lg transition-all duration-200
              disabled:opacity-40 active:scale-[0.98] text-navy-950"
            style={{
              background: loading || !name.trim()
                ? 'linear-gradient(180deg, #b8860b 0%, #8b6508 100%)'
                : 'linear-gradient(180deg, #f5c842 0%, #b8860b 100%)',
              boxShadow: '0 2px 14px rgba(212,160,23,0.4)',
            }}
            onMouseEnter={e => {
              if (!loading && name.trim()) e.currentTarget.style.background = 'linear-gradient(180deg,#fde68a 0%,#d4a017 100%)';
            }}
            onMouseLeave={e => {
              if (!loading && name.trim()) e.currentTarget.style.background = 'linear-gradient(180deg,#f5c842 0%,#b8860b 100%)';
            }}
          >
            {loading ? t.connecting : t.playNow}
          </button>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6 tracking-wide">
          {t.guestMode}
        </p>
      </div>
    </div>
  );
}
