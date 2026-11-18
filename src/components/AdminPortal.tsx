import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Download,
  KeyRound,
  Lock,
  LogOut,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  Shield,
  Sliders,
  StopCircle,
  Unlock,
  Users,
} from 'lucide-react';
import {
  AnalyticsCharts,
  CountdownDisplay,
  PoolRevealVisual,
  SubmissionStatusBadge,
  TeamAvatar,
} from './ArcadeVisuals.tsx';
import { adminApi, publicApi } from '../utils/api.ts';
import type { AdminSessionState, GameConfig } from '../types/game.ts';

export type AdminRoute = '/admin/login' | '/admin' | '/admin/setup';

interface AdminPortalProps {
  route: AdminRoute;
  navigate: (to: string) => void;
  adminState: AdminSessionState | null;
  wsConnected: boolean;
  onAdminAuthenticated: (state: AdminSessionState) => void;
  onAdminLogout: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  route,
  navigate,
  adminState,
  wsConnected,
  onAdminAuthenticated,
  onAdminLogout,
}) => {
  if (!adminState || route === '/admin/login') {
    return (
      <AdminLoginView
        onSuccess={(state) => {
          onAdminAuthenticated(state);
          navigate('/admin');
        }}
        navigate={navigate}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#080E14]">
      {/* Dedicated Admin Top Bar (strictly separated from Player UI) */}
      <header className="border-b border-amber-500/30 bg-[#0B141E] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="font-pixel text-xs sm:text-sm text-white whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span>POOL PARTY</span>
            <span className="text-amber-400">ADMIN</span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === '/admin' ? 'text-amber-300' : ''
              }`}
            >
              Command Center
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/setup')}
              className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === '/admin/setup' ? 'text-amber-300' : ''
              }`}
            >
              Game Setup
            </button>
            <button
              type="button"
              onClick={() => navigate('/display')}
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Projector Display
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-slate-400"
            >
              Player Site
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-400">
              {wsConnected ? 'WS Connected' : 'Reconnecting'}
            </span>
            <button
              type="button"
              onClick={onAdminLogout}
              className="btn-arcade-secondary px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {route === '/admin/setup' ? (
          <AdminSetupView
            state={adminState}
            onUpdated={(next) => {
              onAdminAuthenticated(next);
              navigate('/admin');
            }}
          />
        ) : (
          <AdminDashboardView
            state={adminState}
            onUpdated={onAdminAuthenticated}
            navigate={navigate}
          />
        )}
      </main>
    </div>
  );
};

// ============================================================================
// 1. ADMIN LOGIN VIEW (ADMIN PASSWORD ONLY)
// ============================================================================
const AdminLoginView: React.FC<{
  onSuccess: (state: AdminSessionState) => void;
  navigate: (to: string) => void;
}> = ({ onSuccess, navigate }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await adminApi.login(password);
      onSuccess(res.state);
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md arcade-panel p-6 sm:p-8 space-y-6 border-amber-500/40">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Shield className="w-4 h-4" />
            <span>Organizer Access Only</span>
          </div>
          <h1 className="font-pixel text-xl sm:text-2xl text-white">ADMIN PORTAL</h1>
          <p className="text-sm text-slate-400">
            Enter the <strong className="text-slate-200">Admin Password</strong> to configure
            teams, manage Player XCodes, and control rounds.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Admin Password"
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono-num focus:outline-none focus:border-amber-400"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Default Admin Password: <code className="text-slate-300">FORGE-ADMIN-2026</code>
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-arcade-primary py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'Verifying...' : 'Unlock Admin Console'}</span>
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Looking to play as a team?</span>
          <button
            type="button"
            onClick={() => navigate('/join')}
            className="text-cyan-300 hover:underline font-semibold cursor-pointer"
          >
            Go to Player Login →
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. ADMIN GAME SETUP WIZARD (/admin/setup)
// ============================================================================
const RETRO_TEAM_PREFIXES = [
  'CYBER WOLVES',
  'NEON TITANS',
  'BIT KNIGHTS',
  'PIXEL PHOENIX',
  'DATA DRAGONS',
  'ARCADE VIPERS',
  'QUANTUM FOXES',
  'RETRO FALCONS',
  'VOXEL SHARKS',
  'BYTE RAIDERS',
  'VECTOR LIONS',
  'TURBO HAWKS',
];

const AdminSetupView: React.FC<{
  state: AdminSessionState;
  onUpdated: (next: AdminSessionState) => void;
}> = ({ state, onUpdated }) => {
  const isLobby = state.status === 'LOBBY';
  const [title, setTitle] = useState(state.title);
  const [playerXcode, setPlayerXcode] = useState(state.playerXcode);
  const [newAdminXcode, setNewAdminXcode] = useState('');
  const [teamNames, setTeamNames] = useState<string[]>(state.leaderboard.map((t) => t.name));
  const [pasteBox, setPasteBox] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [config, setConfig] = useState<GameConfig>(state.config);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCountChange = (count: number) => {
    const safe = Math.max(2, Math.min(40, count));
    setTeamNames((prev) => {
      if (safe <= prev.length) return prev.slice(0, safe);
      const next = [...prev];
      while (next.length < safe) {
        const idx = next.length;
        next.push(RETRO_TEAM_PREFIXES[idx] || `SQUAD ${idx + 1}`);
      }
      return next;
    });
  };

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of teamNames) {
      const k = n.trim().toLowerCase();
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [k, c] of counts) {
      if (c > 1) dups.add(k);
    }
    return dups;
  }, [teamNames]);

  const mpcrCheck = useMemo(() => {
    const m = config.multiplierX100 / 100;
    const n = Math.max(2, teamNames.length);
    const mpcr = m / n;
    if (m <= 1) {
      return {
        status: 'WARN',
        mpcr,
        text: `M = ${m.toFixed(2)} <= 1: Pool never grows. Contributing only loses tokens.`,
      };
    }
    if (m >= n) {
      return {
        status: 'WARN',
        mpcr,
        text: `M = ${m.toFixed(2)} >= ${n} teams: MPCR = ${mpcr.toFixed(2)} >= 1 removes the dilemma.`,
      };
    }
    return {
      status: 'GOOD',
      mpcr,
      text: `Real Social Dilemma (MPCR = ${mpcr.toFixed(2)}): Contributing costs 1 token individually while returning ${m.toFixed(2)} to the group.`,
    };
  }, [config.multiplierX100, teamNames.length]);

  const timingEstimate = useMemo(() => {
    const perRound =
      config.roundDurationSec + config.revealDurationSec + config.discussionDurationSec + 15;
    const totalMin = Math.round((perRound * config.totalRounds) / 60);
    return { totalMin, fits: totalMin <= config.targetDurationMin };
  }, [config]);

  const handleApplyPaste = () => {
    const lines = pasteBox
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40);
    if (lines.length >= 2) {
      setTeamNames(lines);
      setShowPaste(false);
    }
  };

  const handleSave = async (andStart: boolean) => {
    setError('');
    if (duplicateNames.size > 0) {
      setError('Remove duplicate team names before saving.');
      return;
    }
    setSaving(true);
    try {
      const res = await adminApi.configure({
        title,
        playerXcode,
        newAdminXcode: newAdminXcode.trim() ? newAdminXcode.trim() : undefined,
        teamNames,
        config,
      });
      if (andStart) {
        const started = await adminApi.startGame();
        onUpdated(started.state);
      } else {
        onUpdated(res.state);
      }
    } catch (err: any) {
      setError(err.message || 'Could not save setup.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-pixel text-xl text-white">GAME SETUP &amp; ACCESS</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure teams, token rules, game-theory multiplier, Player XCode, and Admin Password.
          </p>
        </div>
        {!isLobby && (
          <div className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs text-amber-200">
            Game is already {state.status}. Reset session in Command Center to edit teams or rules.
          </div>
        )}
      </div>

      {/* Access Credentials & Session Title */}
      <section className="arcade-panel p-6 space-y-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-400" />
          <span>Access Credentials</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Session Title
            </label>
            <input
              type="text"
              disabled={!isLobby}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-cyan-300 mb-1.5">
              Player XCode (Shared with Players)
            </label>
            <input
              type="text"
              disabled={!isLobby}
              value={playerXcode}
              onChange={(e) => setPlayerXcode(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/50 text-sm text-cyan-200 font-mono-num uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-amber-300 mb-1.5">
              Change Admin Password (Optional)
            </label>
            <input
              type="password"
              disabled={!isLobby}
              value={newAdminXcode}
              onChange={(e) => setNewAdminXcode(e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-sm text-white font-mono-num"
            />
          </div>
        </div>
      </section>

      {/* Dynamic Team Roster */}
      <section className="arcade-panel p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-300" />
              <span>Dynamic Team Roster ({teamNames.length} Teams)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter 2–40 teams. Players can also self-register during Lobby if Open Join is enabled.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-300">Count:</label>
            <input
              type="number"
              min={2}
              max={40}
              disabled={!isLobby}
              value={teamNames.length}
              onChange={(e) => handleCountChange(Number(e.target.value))}
              className="w-20 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono-num text-white"
            />
            <button
              type="button"
              disabled={!isLobby}
              onClick={() => setShowPaste((v) => !v)}
              className="btn-arcade-secondary px-3 py-1.5 rounded-lg text-xs cursor-pointer"
            >
              Paste List
            </button>
          </div>
        </div>

        {showPaste && isLobby && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-700 space-y-3">
            <textarea
              rows={3}
              value={pasteBox}
              onChange={(e) => setPasteBox(e.target.value)}
              placeholder="Paste team names separated by commas or new lines..."
              className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white"
            />
            <button
              type="button"
              onClick={handleApplyPaste}
              className="btn-arcade-primary px-4 py-2 rounded-lg text-xs cursor-pointer"
            >
              Apply Team List
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {teamNames.map((name, idx) => {
            const isDup = duplicateNames.has(name.trim().toLowerCase());
            return (
              <div key={idx}>
                <input
                  type="text"
                  disabled={!isLobby}
                  maxLength={30}
                  value={name}
                  onChange={(e) => {
                    const copy = [...teamNames];
                    copy[idx] = e.target.value;
                    setTeamNames(copy);
                  }}
                  className={`w-full px-3 py-2 rounded-xl bg-slate-950 border text-sm text-white ${
                    isDup ? 'border-red-500' : 'border-slate-700'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Rules, Multiplier & Game-Theory Check */}
      <section className="arcade-panel p-6 space-y-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>Tokens, Multiplier &amp; Distribution Rules</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Initial Tokens</label>
            <input
              type="number"
              min={1}
              max={1000000}
              disabled={!isLobby}
              value={config.initialTokens}
              onChange={(e) => setConfig({ ...config, initialTokens: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono-num text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Rounds</label>
            <input
              type="number"
              min={1}
              max={50}
              disabled={!isLobby}
              value={config.totalRounds}
              onChange={(e) => setConfig({ ...config, totalRounds: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono-num text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Pool Multiplier (M)</label>
            <input
              type="number"
              min={0.5}
              max={10}
              step={0.05}
              disabled={!isLobby}
              value={(config.multiplierX100 / 100).toFixed(2)}
              onChange={(e) =>
                setConfig({
                  ...config,
                  multiplierX100: Math.round(Number(e.target.value) * 100),
                })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono-num text-amber-300"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Round Timer (sec)</label>
            <input
              type="number"
              min={15}
              max={900}
              disabled={!isLobby}
              value={config.roundDurationSec}
              onChange={(e) => setConfig({ ...config, roundDurationSec: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono-num text-white"
            />
          </div>
        </div>

        {/* Live MPCR & Timing Check */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className={`p-4 rounded-xl border text-xs sm:text-sm ${
              mpcrCheck.status === 'GOOD'
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/30 border-amber-500/50 text-amber-200'
            }`}
          >
            <div className="font-bold mb-1">Game-Theory Check (MPCR = M / N)</div>
            <div>{mpcrCheck.text}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs sm:text-sm text-slate-300">
            <div className="font-bold text-white mb-1">60-Minute Schedule Estimate</div>
            <div>
              Estimated total duration: <strong className="text-cyan-300">~{timingEstimate.totalMin} min</strong>{' '}
              (target {config.targetDurationMin} min) —{' '}
              {timingEstimate.fits ? 'Fits comfortably' : 'Consider shortening timers'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Distribution Mode</label>
            <select
              disabled={!isLobby}
              value={config.distributionMode}
              onChange={(e) =>
                setConfig({ ...config, distributionMode: e.target.value as GameConfig['distributionMode'] })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            >
              <option value="EQUAL">Mode A: Equal Split (Default)</option>
              <option value="WEIGHTED">Mode B: Contribution-Weighted</option>
              <option value="HYBRID">Mode C: Hybrid (50/50)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Remainder Policy</label>
            <select
              disabled={!isLobby}
              value={config.remainderPolicy}
              onChange={(e) =>
                setConfig({ ...config, remainderPolicy: e.target.value as GameConfig['remainderPolicy'] })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            >
              <option value="ROTATING">Rotating by Seed (Fair)</option>
              <option value="TO_LOWEST_BALANCE">To Lowest Balance</option>
              <option value="CARRY_OVER">Carry Over to Next Round</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Missed Submission</label>
            <select
              disabled={!isLobby}
              value={config.missedPolicy}
              onChange={(e) =>
                setConfig({ ...config, missedPolicy: e.target.value as GameConfig['missedPolicy'] })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            >
              <option value="ZERO">Default 0 Tokens</option>
              <option value="SAME_AS_LAST">Same as Last Round</option>
              <option value="MINIMUM">Minimum Contribution</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Reveal &amp; Next Mode</label>
            <select
              disabled={!isLobby}
              value={config.revealMode}
              onChange={(e) =>
                setConfig({
                  ...config,
                  revealMode: e.target.value as GameConfig['revealMode'],
                  nextRoundMode: e.target.value as GameConfig['nextRoundMode'],
                })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            >
              <option value="ADMIN">Admin Manual Reveal &amp; Next</option>
              <option value="AUTO">Automatic Reveal &amp; Next</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 pt-2 text-sm text-slate-300">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              disabled={!isLobby}
              checked={config.autoCloseAllSubmitted}
              onChange={(e) => setConfig({ ...config, autoCloseAllSubmitted: e.target.checked })}
              className="accent-amber-400"
            />
            <span>Auto-close round when all teams lock in</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              disabled={!isLobby}
              checked={config.openPlayerJoin}
              onChange={(e) => setConfig({ ...config, openPlayerJoin: e.target.checked })}
              className="accent-amber-400"
            />
            <span>Allow players to self-register new teams in Lobby</span>
          </label>
        </div>
      </section>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/50 text-sm text-red-200">
          {error}
        </div>
      )}

      {isLobby && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(false)}
            className="btn-arcade-secondary px-6 py-3.5 rounded-xl text-sm cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Lobby Configuration'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(true)}
            className="btn-arcade-primary px-6 py-3.5 rounded-xl text-sm inline-flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Save &amp; Start Game (Round 1)</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. ADMIN COMMAND CENTER (/admin)
// ============================================================================
const AdminDashboardView: React.FC<{
  state: AdminSessionState;
  onUpdated: (next: AdminSessionState) => void;
  navigate: (to: string) => void;
}> = ({ state, onUpdated, navigate }) => {
  const [tab, setTab] = useState<'CONTROL' | 'XCODES' | 'LEDGER' | 'ANALYTICS'>('CONTROL');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [qr, setQr] = useState<{ joinUrl: string; dataUrl: string } | null>(null);

  // Wallet Adjustment Modal State
  const [adjustTeamId, setAdjustTeamId] = useState<number | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<string>('10');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustConfirm, setAdjustConfirm] = useState('');

  // Danger Zone Reset State
  const [showReset, setShowReset] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetAdminXcode, setResetAdminXcode] = useState('');

  useEffect(() => {
    publicApi.getQrCode().then(setQr).catch(() => {});
  }, [state.sessionCode]);

  const runAction = async (fn: () => Promise<{ state: AdminSessionState }>) => {
    setBusy(true);
    setErrMsg('');
    try {
      const res = await fn();
      onUpdated(res.state);
    } catch (err: any) {
      setErrMsg(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const copyText = (key: string, val: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  };

  const r = state.currentRound;

  return (
    <div className="space-y-6">
      {/* Top Admin Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="arcade-panel p-4">
          <div className="text-xs text-slate-400">Game Status</div>
          <div className="font-pixel text-sm sm:text-base text-amber-300 mt-1.5">
            {state.status}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Round {state.currentRoundNo} / {state.config.totalRounds}
          </div>
        </div>
        <div className="arcade-panel p-4">
          <div className="text-xs text-slate-400">Player XCode</div>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className="font-pixel text-sm sm:text-base text-cyan-300">
              {state.playerXcode}
            </span>
            <button
              type="button"
              onClick={() => copyText('px', state.playerXcode)}
              className="text-xs text-slate-300 hover:text-white cursor-pointer"
              title="Copy Player XCode"
            >
              {copiedKey === 'px' ? 'Copied' : <ClipboardCopy className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-xs text-slate-400 mt-1">Share with players to join</div>
        </div>
        <div className="arcade-panel p-4">
          <div className="text-xs text-slate-400">Connected Sockets</div>
          <div className="font-mono-num text-lg font-bold text-white mt-1 tabular-nums">
            {state.connectedClients.teams} players · {state.connectedClients.displays} displays
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {state.connectedClients.admins} admin session(s)
          </div>
        </div>
        <div className="arcade-panel p-4">
          <div className="text-xs text-slate-400">Schedule Guard</div>
          <div
            className={`text-base font-bold mt-1 ${
              state.scheduleGuard.status === 'BEHIND' ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {state.scheduleGuard.status === 'BEHIND'
              ? `Behind by ${state.scheduleGuard.behindByMin} min`
              : 'On Track'}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono-num">
            {state.scheduleGuard.elapsedMin}m elapsed / {state.scheduleGuard.plannedTotalMin}m target
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
          {[
            { id: 'CONTROL', label: 'Control Center' },
            { id: 'XCODES', label: 'Teams & XCodes' },
            { id: 'LEDGER', label: 'Ledger & Audit' },
            { id: 'ANALYTICS', label: 'Analytics' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                tab === item.id ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/setup')}
            className="btn-arcade-secondary px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Setup</span>
          </button>
          <a
            href="/api/public/export.csv"
            className="btn-arcade-secondary px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </a>
        </div>
      </div>

      {errMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 text-xs text-red-200">
          {errMsg}
        </div>
      )}

      {/* TAB 1: CONTROL CENTER */}
      {tab === 'CONTROL' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Round Action Bar */}
            <div className="arcade-panel p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Live Stage Control
                  </div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {state.status === 'LOBBY' && 'Ready to Launch Game'}
                    {state.status === 'ENDED' && 'Session Ended'}
                    {(state.status === 'IN_PROGRESS' || state.status === 'PAUSED') && r && (
                      <>
                        Round {r.roundNo} of {state.config.totalRounds} · {r.status} (
                        {r.submittedCount}/{r.totalTeams} locked)
                      </>
                    )}
                  </div>
                </div>

                {r && (r.status === 'OPEN' || r.status === 'DISCUSSION') && (
                  <CountdownDisplay
                    deadlineAt={r.deadlineAt}
                    serverTime={state.serverTime}
                    paused={state.status === 'PAUSED'}
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {state.status === 'LOBBY' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(() => adminApi.startGame())}
                    className="btn-arcade-primary px-5 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Game &amp; Open Round 1</span>
                  </button>
                )}

                {state.status !== 'LOBBY' && state.status !== 'ENDED' && (
                  <>
                    {r?.status === 'OPEN' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => adminApi.closeRound())}
                        className="btn-arcade-secondary px-4 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Lock className="w-4 h-4 text-amber-300" />
                        <span>Close Round Now</span>
                      </button>
                    )}

                    {(r?.status === 'OPEN' || r?.status === 'CLOSED') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => adminApi.revealRound())}
                        className="btn-arcade-primary px-5 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Unlock className="w-4 h-4" />
                        <span>Reveal &amp; Settle Pool</span>
                      </button>
                    )}

                    {r?.status === 'SETTLED' && state.currentRoundNo < state.config.totalRounds && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => adminApi.nextRound())}
                        className="btn-arcade-primary px-5 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Round {state.currentRoundNo + 1}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(() => adminApi.togglePause())}
                      className="btn-arcade-secondary px-4 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Pause className="w-4 h-4" />
                      <span>{state.status === 'PAUSED' ? 'Resume' : 'Pause'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(() => adminApi.endGame())}
                      className="btn-arcade-secondary px-4 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 text-rose-300 cursor-pointer"
                    >
                      <StopCircle className="w-4 h-4" />
                      <span>End Game</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Live Player Submission Table (amounts hidden until reveal!) */}
            <div className="arcade-panel overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">
                  Player Status &amp; Wallets (Amounts Hidden Pre-Reveal)
                </h2>
                <span className="text-xs text-slate-400">{state.leaderboard.length} teams</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-900/70 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">Team</th>
                      <th className="py-2.5 px-4">Presence</th>
                      <th className="py-2.5 px-4">Round Status</th>
                      <th className="py-2.5 px-4 text-right">Balance</th>
                      <th className="py-2.5 px-4 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {state.leaderboard.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <TeamAvatar avatarId={t.avatarId} name={t.name} size="sm" />
                            <span className="font-semibold text-white">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-xs">
                          <span className={t.isOnline ? 'text-emerald-400' : 'text-slate-500'}>
                            {t.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {state.status === 'LOBBY' ? (
                            <span className="text-xs text-slate-400">Ready</span>
                          ) : (
                            <SubmissionStatusBadge
                              submitted={t.hasSubmittedCurrent}
                              isAuto={t.isAutoCurrent}
                            />
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-num font-bold text-amber-300">
                          {t.balance}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono-num ${
                            t.netGain >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {t.netGain >= 0 ? `+${t.netGain}` : t.netGain}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {r && r.status === 'SETTLED' && (
              <PoolRevealVisual round={r} multiplierX100={state.config.multiplierX100} />
            )}
          </div>

          {/* Right Rail: Join QR + Danger Zone */}
          <div className="lg:col-span-4 space-y-6">
            {qr && (
              <div className="arcade-panel p-5 text-center space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  Player Join QR &amp; XCode
                </div>
                <img
                  src={qr.dataUrl}
                  alt="Player Join QR"
                  className="w-40 h-40 mx-auto rounded-xl border border-amber-400/50"
                />
                <div className="font-pixel text-sm text-amber-300">{state.playerXcode}</div>
                <div className="text-xs text-slate-400 break-all">{qr.joinUrl}</div>
              </div>
            )}

            <div className="arcade-panel p-5 border-red-500/30 space-y-4">
              <div className="flex items-center gap-2 text-rose-400 text-sm font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Danger Zone</span>
              </div>
              <p className="text-xs text-slate-400">
                Resetting creates a fresh Lobby session preserving the team list and clears current
                balances.
              </p>
              {!showReset ? (
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="btn-arcade-secondary w-full py-2.5 rounded-xl text-xs text-rose-300 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Game Session</span>
                </button>
              ) : (
                <div className="space-y-3 pt-2">
                  <input
                    type="text"
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                    placeholder="Type RESET to confirm"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-red-500/50 text-xs text-white"
                  />
                  <input
                    type="password"
                    value={resetAdminXcode}
                    onChange={(e) => setResetAdminXcode(e.target.value)}
                    placeholder="Re-enter Admin Password"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-red-500/50 text-xs text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        await runAction(() =>
                          adminApi.resetSession(resetConfirm, resetAdminXcode)
                        );
                        setShowReset(false);
                        setResetConfirm('');
                        setResetAdminXcode('');
                      }}
                      className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReset(false)}
                      className="btn-arcade-secondary px-3 py-2 rounded-lg text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEAMS & XCODES */}
      {tab === 'XCODES' && (
        <div className="space-y-6">
          <div className="arcade-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Individual Team XCodes &amp; Wallet Controls</h2>
              <span className="text-xs text-slate-400">Rotating a Team XCode disconnects old devices</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900/70 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">Team XCode</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {state.leaderboard.map((t) => (
                    <tr key={t.id}>
                      <td className="py-3 px-4 font-semibold text-white">{t.name}</td>
                      <td className="py-3 px-4 font-mono-num text-cyan-300">
                        {t.joinCode || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-amber-300">
                        {t.balance}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => runAction(() => adminApi.rotateTeamXcode(t.id))}
                          className="btn-arcade-secondary px-2.5 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Rotate XCode</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustTeamId(t.id)}
                          className="btn-arcade-secondary px-2.5 py-1.5 rounded-lg text-xs cursor-pointer"
                        >
                          Adjust Wallet
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {adjustTeamId !== null && (
            <div className="arcade-panel p-6 border-amber-400/50 space-y-4 max-w-lg">
              <h3 className="text-sm font-bold text-white">
                Audited Wallet Adjustment —{' '}
                {state.leaderboard.find((x) => x.id === adjustTeamId)?.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="Delta (e.g. 25 or -10)"
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono-num text-white"
                />
                <input
                  type="text"
                  value={adjustConfirm}
                  onChange={(e) => setAdjustConfirm(e.target.value)}
                  placeholder="Type ADJUST"
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                />
              </div>
              <input
                type="text"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Reason for audit log"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await runAction(() =>
                      adminApi.adjustWallet(
                        adjustTeamId,
                        Number(adjustDelta),
                        adjustNote,
                        adjustConfirm
                      )
                    );
                    setAdjustTeamId(null);
                    setAdjustConfirm('');
                    setAdjustNote('');
                  }}
                  className="btn-arcade-primary px-4 py-2 rounded-lg text-xs cursor-pointer"
                >
                  Apply Adjustment
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustTeamId(null)}
                  className="btn-arcade-secondary px-4 py-2 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LEDGER & AUDIT */}
      {tab === 'LEDGER' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="arcade-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 font-bold text-sm text-white">
              Immutable Token Ledger (Recent 250)
            </div>
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/70 text-slate-400 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Team</th>
                    <th className="py-2.5 px-3">Kind</th>
                    <th className="py-2.5 px-3 text-right">Delta</th>
                    <th className="py-2.5 px-3 text-right">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono-num">
                  {state.ledger.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2 px-3 font-sans text-white">{tx.teamName}</td>
                      <td className="py-2 px-3 text-slate-300">{tx.kind}</td>
                      <td
                        className={`py-2 px-3 text-right font-bold ${
                          tx.amount >= 0 ? 'text-emerald-400' : 'text-cyan-300'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                      </td>
                      <td className="py-2 px-3 text-right text-white">{tx.balanceAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="arcade-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 font-bold text-sm text-white">
              Admin &amp; System Audit Log
            </div>
            <div className="max-h-[480px] overflow-auto divide-y divide-slate-800/80 text-xs">
              {state.auditLogs.map((a) => (
                <div key={a.id} className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-amber-300">{a.action}</span>
                    <span className="text-slate-400 ml-2">by {a.actor}</span>
                    <div className="text-slate-400 mt-0.5 break-all font-mono-num">{a.details}</div>
                  </div>
                  <span className="text-slate-500 shrink-0 font-mono-num">
                    {new Date(a.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ANALYTICS */}
      {tab === 'ANALYTICS' && state.analytics && (
        <AnalyticsCharts analytics={state.analytics} />
      )}
    </div>
  );
};
