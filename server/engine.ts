import type {
  DistributionMode,
  GameAnalytics,
  GameConfig,
  MaxContributionMode,
  RemainderPolicy,
  RoundDistributionRow,
  TeamSummary,
  TieBreakerKey,
} from '../src/types/game.ts';

export const DEFAULT_GAME_CONFIG: GameConfig = {
  initialTokens: 100,
  totalRounds: 5,
  multiplierX100: 200,
  roundDurationSec: 90,
  revealDurationSec: 45,
  discussionDurationSec: 0,
  minContribution: 0,
  maxContributionMode: 'BALANCE',
  maxContributionValue: 100,
  missedPolicy: 'ZERO',
  distributionMode: 'EQUAL',
  hybridEqualAlphaPct: 50,
  remainderPolicy: 'ROTATING',
  revealMode: 'ADMIN',
  nextRoundMode: 'ADMIN',
  autoCloseAllSubmitted: true,
  targetDurationMin: 60,
  autoCatchUp: true,
  publicVisibility: 'NAMED',
  announceFinalRound: true,
  openPlayerJoin: true,
  tieBreakers: ['TOTAL_CONTRIBUTED', 'NET_GAIN', 'NAME'],
};

export interface MpcrCheck {
  mpcr: number;
  status: 'POINTLESS' | 'DILEMMA' | 'NO_DILEMMA';
  message: string;
}

export function computeMpcr(multiplierX100: number, teamCount: number): MpcrCheck {
  const m = multiplierX100 / 100;
  const n = Math.max(2, teamCount);
  const mpcr = Number((m / n).toFixed(3));
  if (m <= 1) {
    return {
      mpcr,
      status: 'POINTLESS',
      message: `M = ${m.toFixed(2)} <= 1: Pool does not grow. Contributing only loses tokens.`,
    };
  }
  if (m >= n) {
    return {
      mpcr,
      status: 'NO_DILEMMA',
      message: `M = ${m.toFixed(2)} >= ${n} teams: MPCR >= 1 removes the dilemma (contributing always pays back).`,
    };
  }
  return {
    mpcr,
    status: 'DILEMMA',
    message: `Genuine social dilemma: each 1 token donated returns ${mpcr.toFixed(2)} to you while adding ${(m - 1).toFixed(2)} net to the room.`,
  };
}

export function computeTimingEstimate(config: GameConfig) {
  const bufferSec = 15;
  const perRoundSec =
    config.roundDurationSec +
    config.revealDurationSec +
    config.discussionDurationSec +
    bufferSec;
  const totalMinutes = Math.round((perRoundSec * config.totalRounds) / 60);
  return {
    perRoundSec,
    totalMinutes,
    fitsInTarget: totalMinutes <= config.targetDurationMin,
  };
}

export function computeMaxAllowed(
  balance: number,
  mode: MaxContributionMode,
  value: number
): number {
  if (balance <= 0) return 0;
  if (mode === 'BALANCE') return balance;
  if (mode === 'FIXED') return Math.max(0, Math.min(balance, Math.floor(value)));
  const pct = Math.max(0, Math.min(100, value));
  return Math.max(0, Math.min(balance, Math.floor((balance * pct) / 100)));
}

export interface ContributionValidation {
  valid: boolean;
  amount: number;
  code?: string;
  message?: string;
}

export function validateContributionInput(
  rawAmount: unknown,
  balance: number,
  config: GameConfig
): ContributionValidation {
  if (typeof rawAmount === 'string') {
    const trimmed = rawAmount.trim();
    if (!/^\d{1,12}$/.test(trimmed)) {
      return {
        valid: false,
        amount: 0,
        code: 'INVALID_AMOUNT',
        message: 'Donation must be a whole non-negative integer.',
      };
    }
    rawAmount = Number(trimmed);
  }

  if (
    typeof rawAmount !== 'number' ||
    !Number.isFinite(rawAmount) ||
    !Number.isInteger(rawAmount)
  ) {
    return {
      valid: false,
      amount: 0,
      code: 'INVALID_AMOUNT',
      message: 'Donation must be a whole integer.',
    };
  }

  if (rawAmount < 0) {
    return {
      valid: false,
      amount: 0,
      code: 'NEGATIVE_AMOUNT',
      message: 'Donation cannot be negative.',
    };
  }

  const maxAllowed = computeMaxAllowed(
    balance,
    config.maxContributionMode,
    config.maxContributionValue
  );
  const effectiveMin = Math.min(config.minContribution, maxAllowed);

  if (rawAmount > balance) {
    return {
      valid: false,
      amount: rawAmount,
      code: 'EXCEEDS_BALANCE',
      message: `Cannot donate ${rawAmount}; your wallet balance is ${balance}.`,
    };
  }

  if (rawAmount > maxAllowed) {
    return {
      valid: false,
      amount: rawAmount,
      code: 'ABOVE_MAXIMUM',
      message: `Maximum allowed donation this round is ${maxAllowed}.`,
    };
  }

  if (rawAmount < effectiveMin) {
    return {
      valid: false,
      amount: rawAmount,
      code: 'BELOW_MINIMUM',
      message: `Minimum required donation is ${effectiveMin}.`,
    };
  }

  return { valid: true, amount: rawAmount };
}

export interface SettlementInputTeam {
  teamId: number;
  teamName: string;
  avatarId: number;
  seedOrder: number;
  balanceBefore: number;
  contribution: number;
  isAuto: boolean;
}

export interface SettlementResult {
  poolTotal: number;
  carryIn: number;
  carryOut: number;
  rewardTotal: number;
  baseShare: number;
  remainderTokens: number;
  dustX100: number;
  cooperationPct: number;
  rows: RoundDistributionRow[];
}

function distributeRemainderIndices(
  teams: SettlementInputTeam[],
  remainder: number,
  roundNo: number,
  policy: RemainderPolicy,
  isFinalRound: boolean
): Set<number> {
  const recipients = new Set<number>();
  if (remainder <= 0 || teams.length === 0) return recipients;

  const n = teams.length;
  const effectivePolicy: RemainderPolicy =
    policy === 'CARRY_OVER' && isFinalRound ? 'ROTATING' : policy;

  if (effectivePolicy === 'TO_LOWEST_BALANCE') {
    const startOffset = (roundNo - 1) % n;
    const sorted = [...teams].sort((a, b) => {
      const postA = a.balanceBefore - a.contribution;
      const postB = b.balanceBefore - b.contribution;
      if (postA !== postB) return postA - postB;
      const rotA = (a.seedOrder - startOffset + n) % n;
      const rotB = (b.seedOrder - startOffset + n) % n;
      return rotA - rotB;
    });
    for (let i = 0; i < Math.min(remainder, n); i++) {
      recipients.add(sorted[i].teamId);
    }
    return recipients;
  }

  // Default: ROTATING by seedOrder
  const bySeed = [...teams].sort((a, b) => a.seedOrder - b.seedOrder);
  const startIdx = (roundNo - 1) % n;
  for (let i = 0; i < Math.min(remainder, n); i++) {
    const target = bySeed[(startIdx + i) % n];
    recipients.add(target.teamId);
  }
  return recipients;
}

function distributeEqualPool(
  teams: SettlementInputTeam[],
  amountToDistribute: number,
  roundNo: number,
  policy: RemainderPolicy,
  isFinalRound: boolean
): { baseShare: number; remainder: number; carryOut: number; shares: Map<number, { base: number; bonus: number }> } {
  const n = teams.length;
  const shares = new Map<number, { base: number; bonus: number }>();
  if (n === 0) return { baseShare: 0, remainder: 0, carryOut: 0, shares };

  const baseShare = Math.floor(amountToDistribute / n);
  const remainder = amountToDistribute % n;

  if (policy === 'CARRY_OVER' && !isFinalRound) {
    for (const t of teams) {
      shares.set(t.teamId, { base: baseShare, bonus: 0 });
    }
    return { baseShare, remainder, carryOut: remainder, shares };
  }

  const bonusSet = distributeRemainderIndices(teams, remainder, roundNo, policy, isFinalRound);
  for (const t of teams) {
    shares.set(t.teamId, {
      base: baseShare,
      bonus: bonusSet.has(t.teamId) ? 1 : 0,
    });
  }
  return { baseShare, remainder, carryOut: 0, shares };
}

function distributeWeightedPool(
  teams: SettlementInputTeam[],
  amountToDistribute: number,
  poolTotal: number,
  roundNo: number
): Map<number, { base: number; bonus: number }> {
  const shares = new Map<number, { base: number; bonus: number }>();
  if (teams.length === 0) return shares;
  if (poolTotal <= 0 || amountToDistribute <= 0) {
    for (const t of teams) shares.set(t.teamId, { base: 0, bonus: 0 });
    return shares;
  }

  const n = teams.length;
  const startOffset = (roundNo - 1) % n;
  const items = teams.map((t) => {
    const exactNumerator = amountToDistribute * t.contribution;
    const floorVal = Math.floor(exactNumerator / poolTotal);
    const remNumerator = exactNumerator % poolTotal;
    return { team: t, floorVal, remNumerator };
  });

  const allocated = items.reduce((acc, x) => acc + x.floorVal, 0);
  const leftover = amountToDistribute - allocated;

  const sortedForRemainder = [...items].sort((a, b) => {
    if (b.remNumerator !== a.remNumerator) return b.remNumerator - a.remNumerator;
    const rotA = (a.team.seedOrder - startOffset + n) % n;
    const rotB = (b.team.seedOrder - startOffset + n) % n;
    return rotA - rotB;
  });

  const bonusIds = new Set<number>();
  for (let i = 0; i < Math.min(leftover, n); i++) {
    bonusIds.add(sortedForRemainder[i].team.teamId);
  }

  for (const item of items) {
    shares.set(item.team.teamId, {
      base: item.floorVal,
      bonus: bonusIds.has(item.team.teamId) ? 1 : 0,
    });
  }
  return shares;
}

export function settlePoolMath(params: {
  teams: SettlementInputTeam[];
  roundNo: number;
  carryIn: number;
  config: GameConfig;
}): SettlementResult {
  const { teams, roundNo, carryIn, config } = params;
  const isFinalRound = roundNo >= config.totalRounds;
  const n = teams.length;

  const poolTotal = teams.reduce((sum, t) => sum + t.contribution, 0);
  const totalBefore = teams.reduce((sum, t) => sum + t.balanceBefore, 0);
  const cooperationPct =
    totalBefore > 0 ? Number(((poolTotal / totalBefore) * 100).toFixed(1)) : 0;

  const rawScaled = poolTotal * config.multiplierX100;
  const multipliedReward = Math.floor(rawScaled / 100);
  const dustX100 = rawScaled % 100;
  const rewardTotal = multipliedReward + carryIn;

  let baseShare = 0;
  let remainderTokens = 0;
  let carryOut = 0;
  const combinedShares = new Map<number, { base: number; bonus: number }>();

  const mode: DistributionMode = config.distributionMode;

  if (mode === 'EQUAL') {
    const eq = distributeEqualPool(
      teams,
      rewardTotal,
      roundNo,
      config.remainderPolicy,
      isFinalRound
    );
    baseShare = eq.baseShare;
    remainderTokens = eq.remainder;
    carryOut = eq.carryOut;
    for (const [id, val] of eq.shares) combinedShares.set(id, val);
  } else if (mode === 'WEIGHTED') {
    const weighted = distributeWeightedPool(teams, rewardTotal, poolTotal, roundNo);
    baseShare = n > 0 ? Math.floor(rewardTotal / n) : 0;
    for (const [id, val] of weighted) combinedShares.set(id, val);
  } else {
    // HYBRID
    const equalPart = Math.floor((rewardTotal * config.hybridEqualAlphaPct) / 100);
    const weightedPart = rewardTotal - equalPart;
    const eq = distributeEqualPool(
      teams,
      equalPart,
      roundNo,
      config.remainderPolicy,
      isFinalRound
    );
    const wt = distributeWeightedPool(teams, weightedPart, poolTotal, roundNo);
    baseShare = eq.baseShare;
    remainderTokens = eq.remainder;
    carryOut = eq.carryOut;
    for (const t of teams) {
      const e = eq.shares.get(t.teamId) ?? { base: 0, bonus: 0 };
      const w = wt.get(t.teamId) ?? { base: 0, bonus: 0 };
      combinedShares.set(t.teamId, {
        base: e.base + w.base,
        bonus: e.bonus + w.bonus,
      });
    }
  }

  const rows: RoundDistributionRow[] = teams.map((t) => {
    const share = combinedShares.get(t.teamId) ?? { base: 0, bonus: 0 };
    const totalReward = share.base + share.bonus;
    const newBalance = t.balanceBefore - t.contribution + totalReward;
    const netGain = totalReward - t.contribution;
    return {
      teamId: t.teamId,
      teamName: t.teamName,
      avatarId: t.avatarId,
      previousBalance: t.balanceBefore,
      contributionAmount: t.contribution,
      baseShare: share.base,
      remainderBonus: share.bonus,
      totalReward,
      newBalance,
      netGain,
      isAuto: t.isAuto,
    };
  });

  // Token conservation invariant check
  const distributedSum = rows.reduce((s, r) => s + r.totalReward, 0);
  if (distributedSum + carryOut !== rewardTotal) {
    throw new Error(
      `Conservation invariant failed: distributed(${distributedSum}) + carryOut(${carryOut}) !== rewardTotal(${rewardTotal})`
    );
  }

  return {
    poolTotal,
    carryIn,
    carryOut,
    rewardTotal,
    baseShare,
    remainderTokens,
    dustX100,
    cooperationPct,
    rows,
  };
}

export function rankTeams(
  teams: Omit<TeamSummary, 'rank'>[],
  tieBreakers: TieBreakerKey[]
): TeamSummary[] {
  const sorted = [...teams].sort((a, b) => {
    if (b.balance !== a.balance) return b.balance - a.balance;
    for (const tb of tieBreakers) {
      if (tb === 'TOTAL_CONTRIBUTED' && b.totalContributed !== a.totalContributed) {
        return b.totalContributed - a.totalContributed;
      }
      if (tb === 'NET_GAIN' && b.netGain !== a.netGain) {
        return b.netGain - a.netGain;
      }
      if (tb === 'NAME') {
        const cmp = a.name.localeCompare(b.name);
        if (cmp !== 0) return cmp;
      }
    }
    return a.id - b.id;
  });

  return sorted.map((t, idx) => ({
    ...t,
    rank: idx + 1,
  }));
}

export function computeGameAnalytics(
  teams: TeamSummary[],
  settledRounds: Array<{
    roundNo: number;
    poolTotal: number;
    rewardTotal: number;
    cooperationPct: number;
    distributions: RoundDistributionRow[];
  }>
): GameAnalytics {
  if (settledRounds.length === 0 || teams.length === 0) {
    return {
      groupCooperationIndex: 0,
      mostCooperativeTeam: null,
      biggestFreeRider: null,
      mostProfitableRound: null,
      roundCoopSeries: [],
      teamBalanceSeries: teams.map((t) => ({
        teamId: t.id,
        name: t.name,
        balances: [{ roundNo: 0, balance: t.initialBalance, contribution: 0 }],
      })),
    };
  }

  const avgCoop =
    settledRounds.reduce((s, r) => s + r.cooperationPct, 0) / settledRounds.length;

  const teamRates = new Map<number, { sumRate: number; count: number; name: string }>();
  for (const t of teams) {
    teamRates.set(t.id, { sumRate: 0, count: 0, name: t.name });
  }

  for (const r of settledRounds) {
    for (const d of r.distributions) {
      if (!d.isAuto && d.previousBalance > 0) {
        const rec = teamRates.get(d.teamId);
        if (rec) {
          rec.sumRate += d.contributionAmount / d.previousBalance;
          rec.count += 1;
        }
      }
    }
  }

  let mostCooperativeTeam: GameAnalytics['mostCooperativeTeam'] = null;
  for (const [teamId, rec] of teamRates) {
    if (rec.count > 0) {
      const rate = Number(((rec.sumRate / rec.count) * 100).toFixed(1));
      if (!mostCooperativeTeam || rate > mostCooperativeTeam.avgCoopRate) {
        mostCooperativeTeam = { teamId, name: rec.name, avgCoopRate: rate };
      }
    }
  }

  const sortedByFreeRide = [...teams].sort((a, b) => {
    if (b.netGain !== a.netGain) return b.netGain - a.netGain;
    return a.totalContributed - b.totalContributed;
  });
  const topFree = sortedByFreeRide[0];
  const biggestFreeRider = topFree
    ? {
        teamId: topFree.id,
        name: topFree.name,
        netGain: topFree.netGain,
        totalContributed: topFree.totalContributed,
      }
    : null;

  const topRound = [...settledRounds].sort((a, b) => b.rewardTotal - a.rewardTotal)[0];
  const mostProfitableRound = topRound
    ? {
        roundNo: topRound.roundNo,
        rewardTotal: topRound.rewardTotal,
        poolTotal: topRound.poolTotal,
      }
    : null;

  const teamBalanceSeries = teams.map((t) => {
    const balances: Array<{ roundNo: number; balance: number; contribution: number }> = [
      { roundNo: 0, balance: t.initialBalance, contribution: 0 },
    ];
    for (const r of settledRounds) {
      const row = r.distributions.find((d) => d.teamId === t.id);
      if (row) {
        balances.push({
          roundNo: r.roundNo,
          balance: row.newBalance,
          contribution: row.contributionAmount,
        });
      }
    }
    return { teamId: t.id, name: t.name, balances };
  });

  return {
    groupCooperationIndex: Number(avgCoop.toFixed(1)),
    mostCooperativeTeam,
    biggestFreeRider,
    mostProfitableRound,
    roundCoopSeries: settledRounds.map((r) => ({
      roundNo: r.roundNo,
      poolTotal: r.poolTotal,
      rewardTotal: r.rewardTotal,
      cooperationPct: r.cooperationPct,
    })),
    teamBalanceSeries,
  };
}
