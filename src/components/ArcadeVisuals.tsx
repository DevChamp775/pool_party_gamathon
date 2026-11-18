import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Coins,
  Crown,
  Droplets,
  Lock,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { GameAnalytics, RoundSummary } from '../types/game.ts';

const AVATAR_PALETTES = [
  { bg: 'bg-amber-500/20', border: 'border-amber-400/60', text: 'text-amber-300', glyph: 'W' },
  { bg: 'bg-cyan-500/20', border: 'border-cyan-400/60', text: 'text-cyan-300', glyph: 'T' },
  { bg: 'bg-orange-500/20', border: 'border-orange-400/60', text: 'text-orange-300', glyph: 'K' },
  { bg: 'bg-rose-500/20', border: 'border-rose-400/60', text: 'text-rose-300', glyph: 'P' },
  { bg: 'bg-emerald-500/20', border: 'border-emerald-400/60', text: 'text-emerald-300', glyph: 'D' },
  { bg: 'bg-indigo-500/20', border: 'border-indigo-400/60', text: 'text-indigo-300', glyph: 'X' },
  { bg: 'bg-yellow-500/20', border: 'border-yellow-400/60', text: 'text-yellow-300', glyph: 'S' },
  { bg: 'bg-sky-500/20', border: 'border-sky-400/60', text: 'text-sky-300', glyph: 'V' },
];

export const TeamAvatar: React.FC<{ avatarId: number; name: string; size?: 'sm' | 'md' | 'lg' }> = ({
  avatarId,
  name,
  size = 'md',
}) => {
  const palette = AVATAR_PALETTES[(Math.max(1, avatarId) - 1) % AVATAR_PALETTES.length];
  const initial = name.trim().charAt(0).toUpperCase() || palette.glyph;
  const dims =
    size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs';
  return (
    <div
      className={`${dims} ${palette.bg} ${palette.border} ${palette.text} border rounded-lg flex items-center justify-center font-pixel shrink-0 select-none`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
};

export const ArcadePoolHeroArt: React.FC<{ multiplier: number }> = ({ multiplier }) => {
  return (
    <div className="relative w-full max-w-md mx-auto select-none">
      <svg
        viewBox="0 0 420 340"
        className="w-full h-auto drop-shadow-[0_14px_34px_rgba(255,140,26,0.22)]"
        role="img"
        aria-label="Pixel Forge Arcade Cabinet and Glowing Token Pool"
      >
        <defs>
          <linearGradient id="arcadeGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD60A" />
            <stop offset="55%" stopColor="#FF8C1A" />
            <stop offset="100%" stopColor="#F24423" />
          </linearGradient>
          <linearGradient id="poolWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0891B2" stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id="stageGlow" cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor="#FF9A1F" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#091017" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Radial stage burst */}
        <circle cx="210" cy="175" r="165" fill="url(#stageGlow)" />

        {/* Retro starburst rays */}
        <g stroke="#FF9A1F" strokeOpacity="0.22" strokeWidth="3">
          <line x1="210" y1="160" x2="40" y2="40" />
          <line x1="210" y1="160" x2="380" y2="40" />
          <line x1="210" y1="160" x2="25" y2="180" />
          <line x1="210" y1="160" x2="395" y2="180" />
          <line x1="210" y1="160" x2="70" y2="305" />
          <line x1="210" y1="160" x2="350" y2="305" />
        </g>

        {/* Floating pixel blocks & coins */}
        <rect x="46" y="72" width="12" height="12" fill="#FFD60A" opacity="0.85" />
        <rect x="356" y="64" width="14" height="14" fill="#F24423" opacity="0.8" />
        <rect x="64" y="232" width="10" height="10" fill="#22D3EE" opacity="0.85" />
        <rect x="348" y="228" width="12" height="12" fill="#FFD60A" opacity="0.85" />
        <circle cx="94" cy="112" r="14" fill="#FF8C1A" opacity="0.85" />
        <circle cx="332" cy="120" r="18" fill="#FFD60A" opacity="0.75" />

        {/* Arcade Cabinet Backplate */}
        <rect x="92" y="28" width="236" height="214" rx="14" fill="#132130" stroke="#F59E0B" strokeWidth="4" />
        {/* Marquee Header */}
        <rect x="104" y="38" width="212" height="32" rx="6" fill="url(#arcadeGold)" />
        <text
          x="210"
          y="60"
          textAnchor="middle"
          fill="#091017"
          fontFamily="Press Start 2P, monospace"
          fontSize="12"
          fontWeight="bold"
        >
          POOL PARTY
        </text>

        {/* Screen Frame */}
        <rect x="110" y="80" width="200" height="118" rx="8" fill="#070E15" stroke="#2A4158" strokeWidth="3" />

        {/* Pixel Pool Water inside Arcade Screen */}
        <rect x="116" y="132" width="188" height="60" rx="4" fill="url(#poolWater)" />
        <rect x="116" y="132" width="188" height="6" fill="#67E8F9" opacity="0.8" />

        {/* Pixel Invader / Coin Drop inside screen */}
        <g fill="#FFD60A">
          <rect x="196" y="92" width="28" height="6" />
          <rect x="190" y="98" width="40" height="6" />
          <rect x="184" y="104" width="12" height="6" />
          <rect x="202" y="104" width="16" height="6" />
          <rect x="224" y="104" width="12" height="6" />
          <rect x="190" y="110" width="40" height="6" />
        </g>

        {/* Falling Gold Token Coins */}
        <circle cx="154" cy="116" r="9" fill="#FFD60A" stroke="#B45309" strokeWidth="2" />
        <circle cx="210" cy="146" r="10" fill="#FFD60A" stroke="#B45309" strokeWidth="2" />
        <circle cx="266" cy="118" r="9" fill="#FFD60A" stroke="#B45309" strokeWidth="2" />

        {/* Multiplier Stamp */}
        <rect x="172" y="152" width="76" height="28" rx="6" fill="#091017" stroke="#FFD60A" strokeWidth="2.5" />
        <text
          x="210"
          y="171"
          textAnchor="middle"
          fill="#FFD60A"
          fontFamily="Press Start 2P, monospace"
          fontSize="12"
        >
          ×{multiplier.toFixed(multiplier % 1 === 0 ? 0 : 2)}
        </text>

        {/* Arcade Control Deck */}
        <polygon points="74,242 346,242 366,296 54,296" fill="#18293B" stroke="#F59E0B" strokeWidth="4" />
        {/* Left & Right Joysticks */}
        <rect x="108" y="256" width="24" height="8" rx="4" fill="#091017" />
        <line x1="120" y1="260" x2="120" y2="236" stroke="#CBD5E1" strokeWidth="4" />
        <circle cx="120" cy="233" r="10" fill="#F24423" stroke="#FFD60A" strokeWidth="2" />

        <rect x="288" y="256" width="24" height="8" rx="4" fill="#091017" />
        <line x1="300" y1="260" x2="300" y2="236" stroke="#CBD5E1" strokeWidth="4" />
        <circle cx="300" cy="233" r="10" fill="#F24423" stroke="#FFD60A" strokeWidth="2" />

        {/* Arcade Action Buttons */}
        <circle cx="176" cy="264" r="8" fill="#FFD60A" />
        <circle cx="200" cy="258" r="8" fill="#22D3EE" />
        <circle cx="224" cy="264" r="8" fill="#22C55E" />
        <circle cx="248" cy="258" r="8" fill="#F24423" />

        {/* Coin Slots */}
        <rect x="150" y="302" width="120" height="24" rx="4" fill="#0F1924" stroke="#2A4158" strokeWidth="2" />
        <rect x="176" y="308" width="16" height="12" rx="2" fill="#F24423" stroke="#FFD60A" strokeWidth="1.5" />
        <rect x="228" y="308" width="16" height="12" rx="2" fill="#F24423" stroke="#FFD60A" strokeWidth="1.5" />
      </svg>
    </div>
  );
};

export const CountdownDisplay: React.FC<{
  deadlineAt: number | null;
  serverTime: number;
  paused?: boolean;
  label?: string;
}> = ({ deadlineAt, serverTime, paused, label = 'TIME REMAINING' }) => {
  const [offsetMs] = useState(() => serverTime - Date.now());
  const [remainingSec, setRemainingSec] = useState<number>(() =>
    deadlineAt ? Math.max(0, Math.ceil((deadlineAt - serverTime) / 1000)) : 0
  );

  useEffect(() => {
    if (!deadlineAt) {
      setRemainingSec(0);
      return;
    }
    const update = () => {
      const approxServerNow = Date.now() + offsetMs;
      setRemainingSec(Math.max(0, Math.ceil((deadlineAt - approxServerNow) / 1000)));
    };
    update();
    if (paused) return;
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [deadlineAt, offsetMs, paused]);

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const urgencyClass =
    remainingSec <= 10
      ? 'text-red-400 border-red-500/60 bg-red-950/30'
      : remainingSec <= 20
      ? 'text-amber-300 border-amber-500/60 bg-amber-950/30'
      : 'text-cyan-300 border-cyan-500/40 bg-slate-900/70';

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-xl border ${urgencyClass}`}>
      <Clock className="w-4 h-4 shrink-0" />
      <div className="flex items-baseline gap-2.5">
        <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase whitespace-nowrap">
          {paused ? 'PAUSED' : label}
        </span>
        <span className="font-pixel text-sm sm:text-base tabular-nums">{formatted}</span>
      </div>
    </div>
  );
};

export const PoolRevealVisual: React.FC<{
  round: RoundSummary;
  multiplierX100: number;
  highlightTeamId?: number;
}> = ({ round, multiplierX100, highlightTeamId }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setStep(3);
      return;
    }
    setStep(1);
    const t1 = setTimeout(() => setStep(2), 700);
    const t2 = setTimeout(() => setStep(3), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [round.id]);

  const poolTotal = round.poolTotal ?? 0;
  const rewardTotal = round.rewardTotal ?? 0;
  const mult = (multiplierX100 / 100).toFixed(multiplierX100 % 100 === 0 ? 0 : 2);
  const distributions = round.distributions ?? [];

  const maxDonor = useMemo(() => {
    if (distributions.length === 0) return null;
    return [...distributions].sort((a, b) => b.contributionAmount - a.contributionAmount)[0];
  }, [distributions]);

  return (
    <div className="space-y-6">
      {/* Pool Multiplication Tank */}
      <div className="arcade-pool-tank p-5 sm:p-6 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold tracking-wider uppercase">
              <Droplets className="w-4 h-4" />
              <span>Round {round.roundNo} Shared Pool</span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-4">
              <div>
                <div className="text-xs text-slate-400">Total Donated Pool</div>
                <div className="font-pixel text-xl sm:text-2xl text-white tabular-nums mt-1">
                  {poolTotal} <span className="text-xs text-cyan-300 font-sans">tokens</span>
                </div>
              </div>
              <div className="font-pixel text-lg sm:text-xl text-amber-400">×{mult}</div>
              <div>
                <div className="text-xs text-slate-400">Multiplied Reward</div>
                <div
                  className={`font-pixel text-xl sm:text-2xl tabular-nums mt-1 transition-opacity duration-300 ${
                    step >= 2 ? 'text-amber-300 opacity-100' : 'text-slate-600 opacity-40'
                  }`}
                >
                  {rewardTotal} <span className="text-xs text-amber-200 font-sans">tokens</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {step < 3 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-arcade-secondary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap"
              >
                Skip Reveal
              </button>
            )}
            <div className="text-right">
              <div className="text-xs text-slate-400">Base Share Each</div>
              <div className="font-mono-num text-lg font-bold text-emerald-400 tabular-nums">
                +{round.baseShare ?? 0}
                {(round.remainderTokens ?? 0) > 0 && (
                  <span className="text-xs text-amber-300 ml-1">
                    (+1 to {round.remainderTokens})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary metrics strip */}
        <div className="mt-4 pt-4 border-t border-cyan-500/20 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300">
          <span>
            Cooperation Rate:{' '}
            <strong className="text-cyan-300 font-mono-num">{round.cooperationPct ?? 0}%</strong>
          </span>
          {maxDonor && (
            <span>
              Top Contributor:{' '}
              <strong className="text-amber-300">
                {maxDonor.teamName} ({maxDonor.contributionAmount})
              </strong>
            </span>
          )}
          {(round.dustX100 ?? 0) > 0 && (
            <span className="text-slate-400">
              Rounding dust: {((round.dustX100 ?? 0) / 100).toFixed(2)} token discarded
            </span>
          )}
        </div>
      </div>

      {/* Round Settlement Breakdown Table */}
      <div className="arcade-panel overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-700/70 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Round {round.roundNo} Settlement Ledger</span>
          </h3>
          <span className="text-xs text-slate-400">
            {distributions.length} players settled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4 font-semibold">Player / Team</th>
                <th className="py-3 px-4 font-semibold text-right">Prev Balance</th>
                <th className="py-3 px-4 font-semibold text-right">Donated</th>
                <th className="py-3 px-4 font-semibold text-right">Reward Share</th>
                <th className="py-3 px-4 font-semibold text-right">New Balance</th>
                <th className="py-3 px-4 font-semibold text-right">Round Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {distributions.map((row) => {
                const isMine = highlightTeamId === row.teamId;
                return (
                  <tr
                    key={row.teamId}
                    className={
                      isMine
                        ? 'bg-amber-500/10'
                        : 'hover:bg-slate-800/40 transition-colors'
                    }
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <TeamAvatar avatarId={row.avatarId} name={row.teamName} size="sm" />
                        <span className="font-semibold text-white">
                          {row.teamName}
                          {isMine && (
                            <span className="ml-2 text-xs text-amber-300 font-normal">(You)</span>
                          )}
                        </span>
                        {row.isAuto && (
                          <span className="text-[11px] text-slate-400">(auto)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-300">
                      {row.previousBalance}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-cyan-300 font-semibold">
                      -{row.contributionAmount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-amber-300 font-semibold">
                      +{row.totalReward}
                      {row.remainderBonus > 0 && (
                        <Sparkles className="w-3.5 h-3.5 inline ml-1 text-amber-400" aria-label="Remainder bonus +1" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-white">
                      {row.newBalance}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold">
                      {row.netGain > 0 ? (
                        <span className="text-emerald-400 inline-flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />+{row.netGain}
                        </span>
                      ) : row.netGain < 0 ? (
                        <span className="text-rose-400 inline-flex items-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5" />
                          {row.netGain}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
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

const LINE_COLORS = ['#FFD60A', '#22D3EE', '#FF7A12', '#22C55E', '#F43F5E', '#A78BFA', '#38BDF8', '#FB7185'];

export const AnalyticsCharts: React.FC<{ analytics: GameAnalytics }> = ({ analytics }) => {
  if (analytics.roundCoopSeries.length === 0) {
    return (
      <div className="arcade-panel p-6 text-center text-sm text-slate-400">
        Charts will populate after Round 1 is settled.
      </div>
    );
  }

  const maxBal = Math.max(
    10,
    ...analytics.teamBalanceSeries.flatMap((t) => t.balances.map((b) => b.balance))
  );
  const maxRoundCount = Math.max(
    1,
    ...analytics.teamBalanceSeries.map((t) => t.balances.length - 1)
  );

  const W = 540;
  const H = 220;
  const padL = 42;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxPool = Math.max(
    10,
    ...analytics.roundCoopSeries.map((r) => Math.max(r.poolTotal, r.rewardTotal))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Wallet Trajectory Line Chart */}
      <div className="arcade-panel p-5">
        <h3 className="text-sm font-bold text-white mb-1">Token Balance Trajectories</h3>
        <p className="text-xs text-slate-400 mb-4">
          How each player&apos;s wallet evolved from initial grant across rounds.
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = padT + plotH * (1 - f);
            const val = Math.round(maxBal * f);
            return (
              <g key={f}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1E3348" strokeWidth="1" />
                <text x={padL - 6} y={y + 4} textAnchor="end" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono">
                  {val}
                </text>
              </g>
            );
          })}
          {analytics.teamBalanceSeries.slice(0, 8).map((team, idx) => {
            const color = LINE_COLORS[idx % LINE_COLORS.length];
            const pts = team.balances
              .map((b) => {
                const x = padL + (b.roundNo / maxRoundCount) * plotW;
                const y = padT + plotH * (1 - b.balance / maxBal);
                return `${x},${y}`;
              })
              .join(' ');
            return (
              <g key={team.teamId}>
                <polyline fill="none" stroke={color} strokeWidth="2.4" points={pts} />
                {team.balances.map((b) => {
                  const x = padL + (b.roundNo / maxRoundCount) * plotW;
                  const y = padT + plotH * (1 - b.balance / maxBal);
                  return <circle key={b.roundNo} cx={x} cy={y} r="3.2" fill={color} />;
                })}
              </g>
            );
          })}
          {Array.from({ length: maxRoundCount + 1 }, (_, r) => {
            const x = padL + (r / maxRoundCount) * plotW;
            return (
              <text key={r} x={x} y={H - 6} textAnchor="middle" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono">
                R{r}
              </text>
            );
          })}
        </svg>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {analytics.teamBalanceSeries.slice(0, 8).map((team, idx) => (
            <div key={team.teamId} className="flex items-center gap-1.5 text-slate-300">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block"
                style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
              />
              <span>{team.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pool Growth & Cooperation Bar Chart */}
      <div className="arcade-panel p-5">
        <h3 className="text-sm font-bold text-white mb-1">Pool Growth &amp; Cooperation by Round</h3>
        <p className="text-xs text-slate-400 mb-4">
          Total donated tokens (cyan) vs multiplied pool payout (gold).
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = padT + plotH * (1 - f);
            const val = Math.round(maxPool * f);
            return (
              <g key={f}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1E3348" strokeWidth="1" />
                <text x={padL - 6} y={y + 4} textAnchor="end" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono">
                  {val}
                </text>
              </g>
            );
          })}
          {analytics.roundCoopSeries.map((r, idx) => {
            const count = analytics.roundCoopSeries.length;
            const groupW = plotW / count;
            const barW = Math.min(24, groupW * 0.34);
            const cx = padL + groupW * idx + groupW / 2;
            const hPool = (r.poolTotal / maxPool) * plotH;
            const hRew = (r.rewardTotal / maxPool) * plotH;
            return (
              <g key={r.roundNo}>
                <rect
                  x={cx - barW - 2}
                  y={padT + plotH - hPool}
                  width={barW}
                  height={hPool}
                  rx="3"
                  fill="#22D3EE"
                />
                <rect
                  x={cx + 2}
                  y={padT + plotH - hRew}
                  width={barW}
                  height={hRew}
                  rx="3"
                  fill="#FFD60A"
                />
                <text
                  x={cx}
                  y={H - 6}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                >
                  R{r.roundNo} ({r.cooperationPct}%)
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-3 flex items-center gap-6 text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block" />
            Donated Pool
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
            Multiplied Payout
          </span>
        </div>
      </div>
    </div>
  );
};

export const SubmissionStatusBadge: React.FC<{ submitted: boolean; isAuto?: boolean }> = ({
  submitted,
  isAuto,
}) => {
  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>{isAuto ? 'Auto-Locked' : 'Locked'}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300">
      <Lock className="w-3.5 h-3.5 opacity-70" />
      <span>Deciding</span>
    </span>
  );
};

export const WinnerCrownIcon = Crown;
