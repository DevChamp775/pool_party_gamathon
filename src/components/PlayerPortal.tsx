import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Coins,
  Download,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import {
  AnalyticsCharts,
  ArcadePoolHeroArt,
  CountdownDisplay,
  PoolRevealVisual,
  TeamAvatar,
  WinnerCrownIcon,
} from './ArcadeVisuals.tsx';
import { playerApi, publicApi } from '../utils/api.ts';
import { arcadeSfx } from '../utils/sound.ts';
import type { PlayerSessionState, PublicGameState, TeamSummary } from '../types/game.ts';

export type PlayerRoute = '/' | '/join' | '/play' | '/leaderboard' | '/results' | '/display';

interface PlayerPortalProps {
  route: PlayerRoute;
  navigate: (to: string) => void;
  playerState: PlayerSessionState | null;
  publicState: PublicGameState | null;
  wsConnected: boolean;
  onPlayerAuthenticated: (state: PlayerSessionState) => void;
  onPlayerLogout: () => void;
}

export const PlayerPortal: React.FC<PlayerPortalProps> = ({
  route,
  navigate,
  playerState,
  publicState,
  wsConnected,
  onPlayerAuthenticated,
  onPlayerLogout,
}) => {
  const [muted, setMuted] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    arcadeSfx.setMuted(next);
  };

  // Display mode uses a dedicated minimal projector shell
  if (route === '/display') {
    return (
      <PublicDisplayView
        state={publicState}
        wsConnected={wsConnected}
        navigate={navigate}
      />
    );
  }

  const state = playerState || publicState;
  const multLabel = state
    ? `×${(state.config.multiplierX100 / 100).toFixed(state.config.multiplierX100 % 100 === 0 ? 0 : 2)}`
    : '×2';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="border-b border-slate-800/90 bg-[#091017]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="font-pixel text-sm sm:text-base tracking-wide text-white whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <span>POOL</span>
            <span className="pixel-gold-text">PARTY</span>
          </button>

          {/* Zone 2: Clean single-line text nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => navigate('/')}
              className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === '/' ? 'text-amber-300' : ''
              }`}
            >
              Overview
            </button>
            {playerState && (
              <button
                type="button"
                onClick={() => navigate('/play')}
                className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  route === '/play' ? 'text-amber-300' : ''
                }`}
              >
                Arena
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/leaderboard')}
              className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === '/leaderboard' ? 'text-amber-300' : ''
              }`}
            >
              Leaderboard
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
              onClick={() => navigate('/admin/login')}
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-slate-400"
            >
              Admin Portal
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute arcade sound' : 'Mute arcade sound'}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {playerState ? (
              <button
                type="button"
                onClick={() => navigate('/play')}
                className="btn-arcade-primary px-4 py-2 rounded-xl text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer"
              >
                Play Arena
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/join')}
                className="btn-arcade-primary px-4 py-2 rounded-xl text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer"
              >
                Join Game
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile compact nav strip */}
      <div className="md:hidden border-b border-slate-800/80 bg-slate-950/70 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto text-xs font-medium text-slate-300">
        <button type="button" onClick={() => navigate('/')} className="whitespace-nowrap shrink-0">
          Overview
        </button>
        {playerState && (
          <button type="button" onClick={() => navigate('/play')} className="whitespace-nowrap shrink-0 text-amber-300">
            Arena
          </button>
        )}
        <button type="button" onClick={() => navigate('/leaderboard')} className="whitespace-nowrap shrink-0">
          Leaderboard
        </button>
        <button type="button" onClick={() => navigate('/display')} className="whitespace-nowrap shrink-0">
          Display
        </button>
        <button type="button" onClick={() => navigate('/admin/login')} className="whitespace-nowrap shrink-0 text-slate-400">
          Admin
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        {route === '/' && (
          <LandingView
            state={state}
            multLabel={multLabel}
            isLoggedIn={Boolean(playerState)}
            navigate={navigate}
          />
        )}
        {route === '/join' && (
          <PlayerJoinView
            publicState={publicState}
            onSuccess={(nextState) => {
              onPlayerAuthenticated(nextState);
              navigate('/play');
            }}
            navigate={navigate}
          />
        )}
        {route === '/play' && (
          <PlayerArenaView
            state={playerState}
            wsConnected={wsConnected}
            navigate={navigate}
            onStateUpdate={onPlayerAuthenticated}
            onLogout={onPlayerLogout}
          />
        )}
        {route === '/leaderboard' && (
          <LeaderboardView
            state={state}
            myTeamId={playerState?.myTeam.id}
            navigate={navigate}
          />
        )}
        {route === '/results' && (
          <FinalResultsView state={state} myTeamId={playerState?.myTeam.id} navigate={navigate} />
        )}
      </main>

      <footer className="border-t border-slate-800/70 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Dayananda Sagar Academy of Technology and Management · Dept. of CSE (Data Science) · Pixel Forge
          </span>
          <span>POOL PARTY · Public Goods Strategy Game</span>
        </div>
      </footer>
    </div>
  );
};

// ============================================================================
// 1. LANDING VIEW
// ============================================================================
const LandingView: React.FC<{
  state: PublicGameState | null;
  multLabel: string;
  isLoggedIn: boolean;
  navigate: (to: string) => void;
}> = ({ state, multLabel, isLoggedIn, navigate }) => {
  const statusText = useMemo(() => {
    if (!state) return 'Connecting to game server';
    if (state.status === 'LOBBY') return `Lobby Open · Session ${state.sessionCode}`;
    if (state.status === 'PAUSED') return `Paused · Round ${state.currentRoundNo} of ${state.config.totalRounds}`;
    if (state.status === 'ENDED') return 'Session Complete · Final Results Ready';
    const rStatus = state.currentRound?.status ?? 'OPEN';
    return `Live · Round ${state.currentRoundNo} of ${state.config.totalRounds} · ${rStatus}`;
  }, [state]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-16">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          <div className="text-xs sm:text-sm font-semibold tracking-wider text-amber-400 uppercase">
            DSATM · Dept. of CSE - Data Science · Pixel Forge
          </div>

          <div className="space-y-3">
            <h1 className="font-pixel text-3xl sm:text-5xl leading-tight text-white">
              POOL <span className="pixel-gold-text">PARTY</span>
            </h1>
            <p className="text-lg sm:text-xl font-bold tracking-wide text-amber-300">
              IMAGINE. COOPERATE. OUTPLAY.
            </p>
            <p className="text-slate-300 text-base sm:text-lg max-w-xl leading-relaxed">
              Every team starts with equal tokens. Secretly donate into the shared pool each round—the
              pool multiplies by <strong className="text-amber-300">{multLabel}</strong> and splits
              equally among everyone, even teams that donated zero.
            </p>
          </div>

          <div className="text-sm text-cyan-300 font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{statusText}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => navigate(isLoggedIn ? '/play' : '/join')}
              className="btn-arcade-primary px-6 py-3.5 rounded-xl text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <span>{isLoggedIn ? 'Enter Live Arena' : 'Join as Player'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#rules-section"
              className="btn-arcade-secondary px-6 py-3.5 rounded-xl text-sm inline-flex items-center gap-2"
            >
              <span>How to Play</span>
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 flex items-center justify-center">
          <ArcadePoolHeroArt multiplier={(state?.config.multiplierX100 ?? 200) / 100} />
        </div>
      </section>

      {/* 4-column Live Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="arcade-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rounds</div>
          <div className="font-pixel text-xl sm:text-2xl text-white mt-2 tabular-nums">
            {state?.config.totalRounds ?? 5}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {state?.config.roundDurationSec ?? 90}s per round
          </div>
        </div>
        <div className="arcade-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Teams</div>
          <div className="font-pixel text-xl sm:text-2xl text-cyan-300 mt-2 tabular-nums">
            {state?.leaderboard.length ?? 5}
          </div>
          <div className="text-xs text-slate-400 mt-1">Dynamic roster</div>
        </div>
        <div className="arcade-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Starting Tokens
          </div>
          <div className="font-pixel text-xl sm:text-2xl text-amber-300 mt-2 tabular-nums">
            {state?.config.initialTokens ?? 100}
          </div>
          <div className="text-xs text-slate-400 mt-1">Equal initial wallet</div>
        </div>
        <div className="arcade-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pool Multiplier
          </div>
          <div className="font-pixel text-xl sm:text-2xl text-orange-400 mt-2 tabular-nums">
            {multLabel}
          </div>
          <div className="text-xs text-slate-400 mt-1">Public goods growth</div>
        </div>
      </section>

      {/* Rules + Event Poster Split */}
      <section id="rules-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 arcade-panel p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-pixel text-lg sm:text-xl text-amber-300">THE SOCIAL DILEMMA</h2>
            <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
              Cooperating grows the entire room&apos;s wealth, but holding back while others donate
              nets a higher individual payout. After the final round, the wealthiest team wins—while
              the room sees its collective Cooperation Index.
            </p>
          </div>

          <div className="space-y-3 text-sm text-slate-300">
            <h3 className="font-bold text-white">Worked Example (4 Teams · ×2 Multiplier · 100 Tokens Each)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border border-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Team</th>
                    <th className="py-2.5 px-3 text-right">Donated</th>
                    <th className="py-2.5 px-3 text-right">Pool Share (120 / 4)</th>
                    <th className="py-2.5 px-3 text-right">New Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono-num">
                  <tr>
                    <td className="py-2 px-3 font-sans font-semibold text-white">Team A</td>
                    <td className="py-2 px-3 text-right text-cyan-300">20</td>
                    <td className="py-2 px-3 text-right text-amber-300">+30</td>
                    <td className="py-2 px-3 text-right font-bold text-white">110</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-semibold text-white">Team B</td>
                    <td className="py-2 px-3 text-right text-cyan-300">30</td>
                    <td className="py-2 px-3 text-right text-amber-300">+30</td>
                    <td className="py-2 px-3 text-right font-bold text-white">100</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-semibold text-white">Team C</td>
                    <td className="py-2 px-3 text-right text-cyan-300">10</td>
                    <td className="py-2 px-3 text-right text-amber-300">+30</td>
                    <td className="py-2 px-3 text-right font-bold text-white">120</td>
                  </tr>
                  <tr className="bg-amber-500/10">
                    <td className="py-2 px-3 font-sans font-semibold text-amber-300">Team D (Free-rider)</td>
                    <td className="py-2 px-3 text-right text-slate-400">0</td>
                    <td className="py-2 px-3 text-right text-amber-300">+30</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-400">130</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400">
              Total donated = 60 · Multiplied ×2 = 120 · Everyone gets 30. Yet if all four teams
              donate 0, everyone stays stuck at 100 instead of 200!
            </p>
          </div>
        </div>

        <div className="lg:col-span-5 arcade-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Pixel Forge Event Poster</h3>
            <span className="text-xs text-amber-300">DSATM · CSE-DS</span>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950">
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-11-17_at_10.42.04_AM_cd5111e3.jpeg"
              alt="Pixel Forge 2 Days Inter College Game Development Challenge Poster at DSATM"
              referrerPolicy="no-referrer"
              className="w-full h-auto object-cover max-h-[420px]"
            />
          </div>
          <p className="text-xs text-slate-400">
            Organized by Department of CSE - Data Science, Dayananda Sagar Academy of Technology and Management.
          </p>
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// 2. PLAYER JOIN PORTAL (PLAYER XCODE OR TEAM XCODE)
// ============================================================================
const PlayerJoinView: React.FC<{
  publicState: PublicGameState | null;
  onSuccess: (state: PlayerSessionState) => void;
  navigate: (to: string) => void;
}> = ({ publicState, onSuccess, navigate }) => {
  const [tab, setTab] = useState<'PLAYER_XCODE' | 'TEAM_XCODE'>('PLAYER_XCODE');
  const [playerXcode, setPlayerXcode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamXcode, setTeamXcode] = useState('');
  const [lobbyTeams, setLobbyTeams] = useState<
    Array<{ id: number; name: string; avatarId: number; isOnline: boolean }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    publicApi
      .getLobbyTeams()
      .then((res) => setLobbyTeams(res.teams))
      .catch(() => {});
  }, [publicState?.leaderboard.length]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res =
        tab === 'TEAM_XCODE'
          ? await playerApi.joinWithTeamXcode(teamXcode)
          : await playerApi.joinWithPlayerXcode(playerXcode, teamName);
      arcadeSfx.playCoinLock();
      onSuccess(res.state);
    } catch (err: any) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="arcade-panel p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            Player Portal Login
          </div>
          <h1 className="font-pixel text-xl sm:text-2xl text-white">ENTER THE ARENA</h1>
          <p className="text-sm text-slate-400">
            Use the <strong className="text-slate-200">Player XCode</strong> shared by the host, or
            reconnect using your personal <strong className="text-slate-200">Team XCode</strong>.
          </p>
        </div>

        {/* Segmented Tab */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setTab('PLAYER_XCODE');
              setError('');
            }}
            className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'PLAYER_XCODE'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Player XCode
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('TEAM_XCODE');
              setError('');
            }}
            className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'TEAM_XCODE'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Team XCode
          </button>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          {tab === 'PLAYER_XCODE' ? (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Player XCode
                </label>
                <input
                  type="text"
                  value={playerXcode}
                  onChange={(e) => setPlayerXcode(e.target.value.toUpperCase())}
                  placeholder="e.g. PLAY-2026"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono-num uppercase focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Team / Player Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Pick a roster slot below or type a new name"
                  maxLength={30}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {lobbyTeams.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">Active Squad Roster (tap to select):</div>
                  <div className="flex flex-wrap gap-2">
                    {lobbyTeams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTeamName(t.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          teamName.toLowerCase() === t.name.toLowerCase()
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Personal Team XCode
              </label>
              <input
                type="text"
                value={teamXcode}
                onChange={(e) => setTeamXcode(e.target.value.toUpperCase())}
                placeholder="e.g. CYBE-7K2"
                required
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono-num uppercase focus:outline-none focus:border-amber-400"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Your Team XCode is shown on your dashboard after joining or issued by the Admin.
              </p>
            </div>
          )}

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
            <span>{loading ? 'Connecting...' : 'Enter Player Arena'}</span>
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Are you the event organizer?</span>
          <button
            type="button"
            onClick={() => navigate('/admin/login')}
            className="text-amber-300 hover:underline font-semibold cursor-pointer"
          >
            Go to Admin Portal →
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. PLAYER LIVE ARENA & WALLET DASHBOARD
// ============================================================================
const PlayerArenaView: React.FC<{
  state: PlayerSessionState | null;
  wsConnected: boolean;
  navigate: (to: string) => void;
  onStateUpdate: (s: PlayerSessionState) => void;
  onLogout: () => void;
}> = ({ state, wsConnected, navigate, onStateUpdate, onLogout }) => {
  const [subTab, setSubTab] = useState<'ARENA' | 'WALLET'>('ARENA');
  const [amountInput, setAmountInput] = useState<string>('0');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (state) {
      const clamped = Math.min(Number(amountInput) || 0, state.myMaxAllowed);
      if (String(clamped) !== amountInput && amountInput !== '') {
        setAmountInput(String(clamped));
      }
    }
  }, [state?.myMaxAllowed, state?.currentRoundNo]);

  useEffect(() => {
    setConfirmOpen(false);
    setSubmitError('');
  }, [state?.currentRoundNo, state?.currentRound?.status]);

  if (!state) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="arcade-panel p-8 space-y-4">
          <h2 className="font-pixel text-lg text-white">PLAYER SIGN-IN REQUIRED</h2>
          <p className="text-sm text-slate-400">
            Join the session using your Player XCode or Team XCode to view your wallet and donate tokens.
          </p>
          <button
            type="button"
            onClick={() => navigate('/join')}
            className="btn-arcade-primary px-6 py-3 rounded-xl text-sm cursor-pointer"
          >
            Go to Player Login
          </button>
        </div>
      </div>
    );
  }

  const { myTeam, myMaxAllowed, myCurrentContribution, currentRound, config } = state;
  const numericAmount = Math.max(0, Math.min(myMaxAllowed, Math.floor(Number(amountInput) || 0)));
  const effectiveMin = Math.min(config.minContribution, myMaxAllowed);

  const mult = config.multiplierX100 / 100;
  const hypotheticalEach = Math.floor((numericAmount * state.leaderboard.length * mult) / Math.max(1, state.leaderboard.length));

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await playerApi.contribute(numericAmount);
      arcadeSfx.playCoinLock();
      setConfirmOpen(false);
      onStateUpdate(res.state);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to lock donation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Player Identity & Connection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TeamAvatar avatarId={myTeam.avatarId} name={myTeam.name} size="lg" />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-bold text-white">{myTeam.name}</h1>
              {myTeam.joinCode && (
                <span className="text-xs font-mono-num text-cyan-300">
                  Team XCode: {myTeam.joinCode}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>Session {state.sessionCode}</span>
              <span>·</span>
              <span className={wsConnected ? 'text-emerald-400' : 'text-amber-400'}>
                {wsConnected ? 'Live Sync Active' : 'Reconnecting...'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setSubTab('ARENA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                subTab === 'ARENA' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
              }`}
            >
              Game Arena
            </button>
            <button
              type="button"
              onClick={() => setSubTab('WALLET')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                subTab === 'WALLET' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
              }`}
            >
              Wallet &amp; Ledger
            </button>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="btn-arcade-secondary px-3 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Wallet Strip (Always visible) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="arcade-panel p-4">
          <div className="text-xs text-slate-400">Current Balance</div>
          <div className="font-pixel text-lg sm:text-xl text-amber-300 mt-1.5 tabular-nums">
            {myTeam.balance}
          </div>
        </div>
        <div className="arcade-panel p-4">
          <div className="text-xs text-slate-400">Total Donated</div>
          <div className="font-mono-num text-lg font-bold text-cyan-300 mt-1 tabular-nums">
            {myTeam.totalContributed}
          </div>
        </div>
        <div className="arcade-panel p-4">
          <div className="text-xs text-slate-400">Total Rewards</div>
          <div className="font-mono-num text-lg font-bold text-white mt-1 tabular-nums">
            {myTeam.totalRewards}
          </div>
        </div>
        <div className="arcade-panel p-4">
          <div className="text-xs text-slate-400">Net Gain / Loss</div>
          <div
            className={`font-mono-num text-lg font-bold mt-1 tabular-nums ${
              myTeam.netGain > 0
                ? 'text-emerald-400'
                : myTeam.netGain < 0
                ? 'text-rose-400'
                : 'text-slate-300'
            }`}
          >
            {myTeam.netGain >= 0 ? `+${myTeam.netGain}` : myTeam.netGain}
          </div>
        </div>
        <div className="arcade-panel p-4 col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-400">Current Rank</div>
          <div className="font-pixel text-lg text-white mt-1.5 tabular-nums">
            #{myTeam.rank}
            <span className="text-xs font-sans text-slate-400 ml-1">
              / {state.leaderboard.length}
            </span>
          </div>
        </div>
      </div>

      {subTab === 'WALLET' ? (
        <div className="space-y-6">
          {/* Round-by-round history */}
          <div className="arcade-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                <span>Round-by-Round Performance</span>
              </h2>
              <span className="text-xs text-slate-400">
                Initial Grant: {myTeam.initialBalance} tokens
              </span>
            </div>
            {state.myHistory.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                Your round history will appear once Round 1 is settled.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-900/70 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">Round</th>
                      <th className="py-2.5 px-4 text-right">Prev Balance</th>
                      <th className="py-2.5 px-4 text-right">Donated</th>
                      <th className="py-2.5 px-4 text-right">Pool Reward</th>
                      <th className="py-2.5 px-4 text-right">New Balance</th>
                      <th className="py-2.5 px-4 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono-num">
                    {state.myHistory.map((h) => (
                      <tr key={h.roundNo}>
                        <td className="py-2.5 px-4 font-sans font-semibold text-white">
                          Round {h.roundNo} {h.isAuto && <span className="text-xs text-slate-400">(auto)</span>}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-300">{h.previousBalance}</td>
                        <td className="py-2.5 px-4 text-right text-cyan-300">-{h.contributionAmount}</td>
                        <td className="py-2.5 px-4 text-right text-amber-300">+{h.totalReward}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-white">{h.newBalance}</td>
                        <td
                          className={`py-2.5 px-4 text-right font-bold ${
                            h.netGain >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {h.netGain >= 0 ? `+${h.netGain}` : h.netGain}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Immutable Ledger */}
          <div className="arcade-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">Immutable Token Ledger</h2>
            </div>
            {state.myLedger.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                Ledger entries are created when the game starts.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left">
                  <thead className="bg-slate-900/70 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Note</th>
                      <th className="py-2.5 px-4 text-right">Delta</th>
                      <th className="py-2.5 px-4 text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {state.myLedger.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2.5 px-4 font-mono-num text-xs text-slate-300">{tx.kind}</td>
                        <td className="py-2.5 px-4 text-slate-300">{tx.note}</td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono-num font-bold ${
                            tx.amount >= 0 ? 'text-emerald-400' : 'text-cyan-300'
                          }`}
                        >
                          {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-num text-white">
                          {tx.balanceAfter}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ARENA VIEW */
        <div className="space-y-6">
          {state.status === 'LOBBY' && (
            <div className="arcade-panel p-6 sm:p-8 text-center space-y-5">
              <div className="font-pixel text-lg sm:text-xl text-amber-300">
                WAITING FOR ADMIN TO START
              </div>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                You are locked in as <strong>{myTeam.name}</strong>. Keep this screen open—Round 1
                will begin automatically as soon as the organizer launches the game.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {state.leaderboard.map((t) => (
                  <div
                    key={t.id}
                    className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-xs"
                  >
                    <TeamAvatar avatarId={t.avatarId} name={t.name} size="sm" />
                    <span className="font-semibold text-white">{t.name}</span>
                    <span className={t.isOnline ? 'text-emerald-400' : 'text-slate-500'}>
                      {t.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.status === 'ENDED' && (
            <div className="arcade-panel p-6 sm:p-8 text-center space-y-4">
              <WinnerCrownIcon className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="font-pixel text-xl text-amber-300">GAME OVER · FINAL RESULTS READY</h2>
              <p className="text-sm text-slate-300">
                You finished Rank #{myTeam.rank} with {myTeam.balance} tokens.
              </p>
              <button
                type="button"
                onClick={() => navigate('/results')}
                className="btn-arcade-primary px-6 py-3 rounded-xl text-sm cursor-pointer"
              >
                View Podium &amp; Analytics
              </button>
            </div>
          )}

          {(state.status === 'IN_PROGRESS' || state.status === 'PAUSED') && currentRound && (
            <div className="space-y-6">
              {/* Round Status Header */}
              <div className="arcade-panel p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    {config.announceFinalRound && state.currentRoundNo === config.totalRounds
                      ? 'FINAL ROUND'
                      : `ROUND ${state.currentRoundNo} OF ${config.totalRounds}`}
                  </div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {currentRound.status === 'DISCUSSION' && 'Table Discussion Phase'}
                    {currentRound.status === 'OPEN' && 'Secret Pool Donation Open'}
                    {currentRound.status === 'CLOSED' && 'Donations Closed · Awaiting Reveal'}
                    {currentRound.status === 'SETTLED' && 'Round Revealed & Settled'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Submissions</div>
                    <div className="font-mono-num text-sm font-bold text-cyan-300">
                      {currentRound.submittedCount} / {currentRound.totalTeams} locked
                    </div>
                  </div>
                  {(currentRound.status === 'OPEN' || currentRound.status === 'DISCUSSION') && (
                    <CountdownDisplay
                      deadlineAt={currentRound.deadlineAt}
                      serverTime={state.serverTime}
                      paused={state.status === 'PAUSED'}
                    />
                  )}
                </div>
              </div>

              {/* DISCUSSION STATE */}
              {currentRound.status === 'DISCUSSION' && (
                <div className="arcade-pool-tank p-6 sm:p-8 text-center space-y-3">
                  <h2 className="font-pixel text-base sm:text-lg text-cyan-300">
                    TALK BEFORE YOU DECIDE
                  </h2>
                  <p className="text-sm text-slate-300 max-w-lg mx-auto">
                    Discuss strategy with the room before the secret donation window opens. Once the
                    timer flips to OPEN, decisions are silent and private.
                  </p>
                </div>
              )}

              {/* OPEN STATE — SECRET DONATION CONSOLE */}
              {currentRound.status === 'OPEN' && (
                <div className="arcade-panel p-6 sm:p-8 space-y-6">
                  {myCurrentContribution ? (
                    <div className="text-center space-y-4 py-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/50 flex items-center justify-center mx-auto text-emerald-400">
                        <Lock className="w-6 h-6" />
                      </div>
                      <h2 className="font-pixel text-lg sm:text-xl text-emerald-400">
                        DONATION LOCKED
                      </h2>
                      <p className="text-slate-300 text-sm sm:text-base">
                        You secretly locked{' '}
                        <strong className="font-pixel text-amber-300 text-base">
                          {myCurrentContribution.amount}
                        </strong>{' '}
                        tokens into the Round {currentRound.roundNo} pool.
                      </p>
                      <div className="text-xs text-slate-400">
                        Other players&apos; donations remain hidden until the Admin reveals the pool (
                        {currentRound.submittedCount} of {currentRound.totalTeams} locked).
                      </div>
                    </div>
                  ) : myMaxAllowed <= 0 ? (
                    <div className="text-center space-y-3 py-4">
                      <h2 className="font-pixel text-base text-amber-300">ZERO TOKENS AVAILABLE</h2>
                      <p className="text-sm text-slate-300">
                        You currently have 0 tokens to donate, so your contribution will be 0—and
                        you will still receive your equal share of the multiplied pool!
                      </p>
                      <button
                        type="button"
                        onClick={handleConfirmSubmit}
                        disabled={submitting || state.status === 'PAUSED'}
                        className="btn-arcade-primary px-6 py-3 rounded-xl text-sm cursor-pointer"
                      >
                        Lock 0 Tokens
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h2 className="text-base sm:text-lg font-bold text-white">
                            Choose Your Secret Pool Donation
                          </h2>
                          <p className="text-xs text-slate-400">
                            Allowed range: {effectiveMin} to {myMaxAllowed} tokens (integers only).
                          </p>
                        </div>
                        <div className="text-xs font-mono-num text-amber-300">
                          Pool Multiplier: ×{mult.toFixed(mult % 1 === 0 ? 0 : 2)}
                        </div>
                      </div>

                      {/* Big Numeric Input */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                        <div className="md:col-span-5">
                          <label className="sr-only" htmlFor="donation-input">
                            Token Donation Amount
                          </label>
                          <input
                            id="donation-input"
                            type="number"
                            inputMode="numeric"
                            min={effectiveMin}
                            max={myMaxAllowed}
                            step={1}
                            value={amountInput}
                            disabled={state.status === 'PAUSED' || confirmOpen}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d]/g, '');
                              setAmountInput(raw);
                            }}
                            className="w-full px-5 py-4 rounded-2xl bg-slate-950 border-2 border-cyan-500/50 text-center font-pixel text-2xl sm:text-3xl text-amber-300 focus:outline-none focus:border-amber-400 tabular-nums"
                          />
                        </div>

                        <div className="md:col-span-7 space-y-4">
                          <input
                            type="range"
                            min={effectiveMin}
                            max={myMaxAllowed}
                            step={1}
                            value={numericAmount}
                            disabled={state.status === 'PAUSED' || confirmOpen}
                            onChange={(e) => setAmountInput(e.target.value)}
                            className="w-full accent-amber-400 h-2.5 bg-slate-800 rounded-lg cursor-pointer"
                          />

                          {/* Quick Fraction Buttons */}
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: '0', val: effectiveMin },
                              { label: '25%', val: Math.max(effectiveMin, Math.floor(myMaxAllowed * 0.25)) },
                              { label: '50%', val: Math.max(effectiveMin, Math.floor(myMaxAllowed * 0.5)) },
                              { label: 'Max', val: myMaxAllowed },
                            ].map((chip) => (
                              <button
                                key={chip.label}
                                type="button"
                                disabled={state.status === 'PAUSED' || confirmOpen}
                                onClick={() => setAmountInput(String(chip.val))}
                                className="btn-arcade-secondary py-2.5 rounded-xl text-xs sm:text-sm font-mono-num cursor-pointer"
                              >
                                {chip.label} ({chip.val})
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Private What-If Preview */}
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-300">
                        <span>
                          If every team donates <strong className="text-white">{numericAmount}</strong>,
                          each receives{' '}
                          <strong className="text-emerald-400 font-mono-num">+{hypotheticalEach}</strong>{' '}
                          (net{' '}
                          <strong className="text-emerald-400 font-mono-num">
                            {hypotheticalEach - numericAmount >= 0
                              ? `+${hypotheticalEach - numericAmount}`
                              : hypotheticalEach - numericAmount}
                          </strong>
                          ).
                        </span>
                        <span className="text-slate-400">
                          Remaining kept: <strong className="text-amber-300 font-mono-num">{myTeam.balance - numericAmount}</strong>
                        </span>
                      </div>

                      {submitError && (
                        <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-xs text-red-200">
                          {submitError}
                        </div>
                      )}

                      {!confirmOpen ? (
                        <button
                          type="button"
                          disabled={
                            state.status === 'PAUSED' ||
                            numericAmount < effectiveMin ||
                            numericAmount > myMaxAllowed
                          }
                          onClick={() => setConfirmOpen(true)}
                          className="w-full btn-arcade-primary py-4 rounded-xl text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Lock className="w-4 h-4" />
                          <span>Lock Donation ({numericAmount} Tokens)</span>
                        </button>
                      ) : (
                        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-400/60 space-y-4">
                          <div className="text-sm sm:text-base font-semibold text-white">
                            Confirm locking{' '}
                            <span className="text-amber-300 font-pixel">{numericAmount}</span> tokens
                            into Round {currentRound.roundNo}? Once locked, it cannot be changed.
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={handleConfirmSubmit}
                              className="btn-arcade-primary px-6 py-3 rounded-xl text-sm flex-1 cursor-pointer"
                            >
                              {submitting ? 'Locking...' : 'Confirm & Lock In'}
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => setConfirmOpen(false)}
                              className="btn-arcade-secondary px-5 py-3 rounded-xl text-sm cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CLOSED STATE */}
              {currentRound.status === 'CLOSED' && (
                <div className="arcade-panel p-8 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-cyan-300 mx-auto" />
                  <h2 className="font-pixel text-lg text-white">DONATIONS CLOSED</h2>
                  <p className="text-sm text-slate-300">
                    All {currentRound.submittedCount} submissions are sealed. Waiting for the Admin
                    to trigger the pool reveal!
                  </p>
                </div>
              )}

              {/* SETTLED STATE (REVEAL + RESULTS) */}
              {currentRound.status === 'SETTLED' && (
                <PoolRevealVisual
                  round={currentRound}
                  multiplierX100={config.multiplierX100}
                  highlightTeamId={myTeam.id}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. LIVE LEADERBOARD VIEW
// ============================================================================
const LeaderboardView: React.FC<{
  state: PublicGameState | null;
  myTeamId?: number;
  navigate: (to: string) => void;
}> = ({ state, myTeamId, navigate }) => {
  if (!state) {
    return <div className="p-12 text-center text-slate-400">Loading leaderboard...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-pixel text-xl sm:text-2xl text-white">LIVE LEADERBOARD</h1>
          <p className="text-sm text-slate-400 mt-1">
            Session {state.sessionCode} · Round {state.currentRoundNo} of {state.config.totalRounds}
          </p>
        </div>
        {state.status === 'ENDED' && (
          <button
            type="button"
            onClick={() => navigate('/results')}
            className="btn-arcade-primary px-4 py-2.5 rounded-xl text-xs sm:text-sm cursor-pointer"
          >
            Final Podium &amp; Analytics
          </button>
        )}
      </div>

      <div className="arcade-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3.5 px-4">Rank</th>
                <th className="py-3.5 px-4">Player / Team</th>
                <th className="py-3.5 px-4 text-right">Balance</th>
                <th className="py-3.5 px-4 text-right">Donated</th>
                <th className="py-3.5 px-4 text-right">Rewards</th>
                <th className="py-3.5 px-4 text-right">Net Gain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {state.leaderboard.map((t) => {
                const isMine = t.id === myTeamId;
                const movedUp = t.previousRank !== null && t.rank < t.previousRank;
                const movedDown = t.previousRank !== null && t.rank > t.previousRank;
                return (
                  <tr
                    key={t.id}
                    className={
                      isMine
                        ? 'bg-amber-500/15'
                        : t.rank <= 3
                        ? 'bg-slate-900/40'
                        : 'hover:bg-slate-800/40'
                    }
                  >
                    <td className="py-3.5 px-4 font-pixel text-xs">
                      <span className={t.rank === 1 ? 'text-amber-300' : 'text-slate-200'}>
                        #{t.rank}
                      </span>
                      {movedUp && <ArrowUpRight className="w-3.5 h-3.5 inline ml-1 text-emerald-400" />}
                      {movedDown && <ArrowDownRight className="w-3.5 h-3.5 inline ml-1 text-rose-400" />}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <TeamAvatar avatarId={t.avatarId} name={t.name} size="sm" />
                        <span className="font-semibold text-white">
                          {t.name}
                          {isMine && <span className="ml-2 text-xs text-amber-300">(You)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-pixel text-xs sm:text-sm text-amber-300 tabular-nums">
                      {t.balance}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num text-cyan-300">
                      {t.totalContributed}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num text-slate-200">
                      {t.totalRewards}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono-num font-bold ${
                        t.netGain >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {t.netGain >= 0 ? `+${t.netGain}` : t.netGain}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. FINAL RESULTS & ANALYTICS VIEW
// ============================================================================
const FinalResultsView: React.FC<{
  state: PublicGameState | null;
  myTeamId?: number;
  navigate: (to: string) => void;
}> = ({ state, myTeamId }) => {
  useEffect(() => {
    if (!state || state.status !== 'ENDED') return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      arcadeSfx.playFanfare();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD60A', '#FF8C1A', '#22D3EE', '#F24423'],
      });
    }
  }, [state?.status]);

  if (!state) return null;

  const top3 = state.leaderboard.slice(0, 3);
  const winner = top3[0];
  const analytics = state.analytics;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Winner Banner */}
      {winner && (
        <section className="arcade-panel p-6 sm:p-10 text-center space-y-4">
          <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
          <div className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
            Session {state.sessionCode} Champion
          </div>
          <h1 className="font-pixel text-2xl sm:text-4xl pixel-gold-text">{winner.name}</h1>
          <p className="text-slate-300 text-sm sm:text-base">
            Final Wallet: <strong className="text-amber-300 font-pixel">{winner.balance}</strong> tokens
            · Net Gain: <strong className="text-emerald-400 font-mono-num">+{winner.netGain}</strong>
          </p>
          <div className="pt-2">
            <a
              href="/api/public/export.csv"
              className="btn-arcade-secondary px-5 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Full Ledger CSV</span>
            </a>
          </div>
        </section>
      )}

      {/* Top 3 Podium */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((t) => (
          <div
            key={t.id}
            className={`arcade-panel p-6 text-center space-y-3 ${
              t.rank === 1 ? 'border-amber-400/70' : ''
            } ${t.id === myTeamId ? 'bg-amber-500/10' : ''}`}
          >
            <div className="font-pixel text-lg text-amber-300">RANK #{t.rank}</div>
            <div className="flex justify-center">
              <TeamAvatar avatarId={t.avatarId} name={t.name} size="lg" />
            </div>
            <div className="text-lg font-bold text-white">{t.name}</div>
            <div className="font-pixel text-xl text-amber-300 tabular-nums">{t.balance}</div>
            <div className="text-xs text-slate-400 font-mono-num">
              Donated {t.totalContributed} · Rewards {t.totalRewards}
            </div>
          </div>
        ))}
      </section>

      {/* Awards & Group Cooperation Index */}
      {analytics && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="arcade-panel p-5">
            <div className="text-xs uppercase text-slate-400 font-semibold">
              Group Cooperation Index
            </div>
            <div className="font-pixel text-2xl text-cyan-300 mt-2 tabular-nums">
              {analytics.groupCooperationIndex}%
            </div>
            <div className="text-xs text-slate-400 mt-1">Mean wallet share donated</div>
          </div>
          <div className="arcade-panel p-5">
            <div className="text-xs uppercase text-slate-400 font-semibold flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>Most Cooperative</span>
            </div>
            <div className="text-lg font-bold text-white mt-2">
              {analytics.mostCooperativeTeam?.name ?? '—'}
            </div>
            <div className="text-xs text-emerald-400 mt-1 font-mono-num">
              {analytics.mostCooperativeTeam
                ? `${analytics.mostCooperativeTeam.avgCoopRate}% avg rate`
                : 'No data'}
            </div>
          </div>
          <div className="arcade-panel p-5">
            <div className="text-xs uppercase text-slate-400 font-semibold">Biggest Free-Rider</div>
            <div className="text-lg font-bold text-white mt-2">
              {analytics.biggestFreeRider?.name ?? '—'}
            </div>
            <div className="text-xs text-amber-300 mt-1 font-mono-num">
              {analytics.biggestFreeRider
                ? `Net +${analytics.biggestFreeRider.netGain} (donated ${analytics.biggestFreeRider.totalContributed})`
                : 'No data'}
            </div>
          </div>
          <div className="arcade-panel p-5">
            <div className="text-xs uppercase text-slate-400 font-semibold">Best Pool Round</div>
            <div className="text-lg font-bold text-white mt-2">
              {analytics.mostProfitableRound
                ? `Round ${analytics.mostProfitableRound.roundNo}`
                : '—'}
            </div>
            <div className="text-xs text-cyan-300 mt-1 font-mono-num">
              {analytics.mostProfitableRound
                ? `${analytics.mostProfitableRound.rewardTotal} payout`
                : 'No data'}
            </div>
          </div>
        </section>
      )}

      {analytics && <AnalyticsCharts analytics={analytics} />}
    </div>
  );
};

// ============================================================================
// 6. PROJECTOR / AUDIENCE PUBLIC DISPLAY (/display)
// ============================================================================
const PublicDisplayView: React.FC<{
  state: PublicGameState | null;
  wsConnected: boolean;
  navigate: (to: string) => void;
}> = ({ state, wsConnected, navigate }) => {
  const [qr, setQr] = useState<{ joinUrl: string; dataUrl: string } | null>(null);

  useEffect(() => {
    publicApi.getQrCode().then(setQr).catch(() => {});
  }, []);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Connecting Projector Display...
      </div>
    );
  }

  const r = state.currentRound;
  const mult = (state.config.multiplierX100 / 100).toFixed(
    state.config.multiplierX100 % 100 === 0 ? 0 : 2
  );

  return (
    <div className="min-h-screen p-6 sm:p-10 flex flex-col gap-6 max-w-[1440px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-4">
          <Monitor className="w-6 h-6 text-amber-400" />
          <div>
            <h1 className="font-pixel text-xl sm:text-2xl text-white">
              POOL <span className="pixel-gold-text">PARTY</span> · ×{mult}
            </h1>
            <div className="text-xs text-slate-400">
              DSATM Pixel Forge · Session {state.sessionCode} ·{' '}
              {wsConnected ? 'Live Projector Feed' : 'Reconnecting'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {r && (r.status === 'OPEN' || r.status === 'DISCUSSION') && (
            <CountdownDisplay
              deadlineAt={r.deadlineAt}
              serverTime={state.serverTime}
              paused={state.status === 'PAUSED'}
            />
          )}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-arcade-secondary px-4 py-2 rounded-xl text-xs cursor-pointer"
          >
            Exit Display
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Main Stage */}
        <div className="lg:col-span-8 space-y-6">
          {state.status === 'LOBBY' && (
            <div className="arcade-panel p-8 text-center space-y-6">
              <h2 className="font-pixel text-2xl text-amber-300">LOBBY OPEN · JOIN NOW</h2>
              <p className="text-slate-300">
                Scan the QR code or open <strong>/join</strong> on your phone and enter the Player XCode
                announced by the host.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {state.leaderboard.map((t) => (
                  <div
                    key={t.id}
                    className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-2"
                  >
                    <TeamAvatar avatarId={t.avatarId} name={t.name} size="sm" />
                    <span className="font-semibold text-white">{t.name}</span>
                    <span className={`text-xs ${t.isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {t.isOnline ? 'Ready' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.status !== 'LOBBY' && r && r.status !== 'SETTLED' && (
            <div className="arcade-pool-tank p-8 sm:p-10 text-center space-y-6">
              <div className="text-sm font-semibold uppercase tracking-widest text-cyan-300">
                Round {r.roundNo} of {state.config.totalRounds} · {r.status}
              </div>
              <div className="font-pixel text-3xl sm:text-5xl text-white tabular-nums">
                {r.submittedCount} / {r.totalTeams}
              </div>
              <div className="text-base text-slate-300">Players Locked In (Amounts Secret Until Reveal)</div>
              <div className="max-w-md mx-auto h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-300"
                  style={{
                    width: `${r.totalTeams > 0 ? (r.submittedCount / r.totalTeams) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {r && r.status === 'SETTLED' && (
            <PoolRevealVisual round={r} multiplierX100={state.config.multiplierX100} />
          )}
        </div>

        {/* Side Leaderboard + QR */}
        <div className="lg:col-span-4 space-y-6">
          <div className="arcade-panel p-5 space-y-4">
            <h2 className="font-pixel text-sm text-amber-300 flex items-center gap-2">
              <Coins className="w-4 h-4" />
              <span>STANDINGS</span>
            </h2>
            <div className="divide-y divide-slate-800">
              {state.leaderboard.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-pixel text-xs text-slate-400 w-6">#{t.rank}</span>
                    <TeamAvatar avatarId={t.avatarId} name={t.name} size="sm" />
                    <span className="font-semibold text-white truncate">{t.name}</span>
                  </div>
                  <span className="font-pixel text-sm text-amber-300 tabular-nums">{t.balance}</span>
                </div>
              ))}
            </div>
          </div>

          {qr && (
            <div className="arcade-panel p-5 text-center space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Scan to Join Player Portal
              </div>
              <img
                src={qr.dataUrl}
                alt="QR Code to join POOL PARTY player portal"
                className="w-36 h-36 mx-auto rounded-xl border border-amber-400/50"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
