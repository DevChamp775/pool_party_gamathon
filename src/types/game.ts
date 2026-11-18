export type GameSessionStatus = 'LOBBY' | 'IN_PROGRESS' | 'PAUSED' | 'ENDED';
export type RoundStatus = 'PENDING' | 'DISCUSSION' | 'OPEN' | 'CLOSED' | 'SETTLED';
export type MissedPolicy = 'ZERO' | 'SAME_AS_LAST' | 'MINIMUM';
export type MaxContributionMode = 'BALANCE' | 'FIXED' | 'PERCENT';
export type DistributionMode = 'EQUAL' | 'WEIGHTED' | 'HYBRID';
export type RemainderPolicy = 'ROTATING' | 'TO_LOWEST_BALANCE' | 'CARRY_OVER';
export type ProgressionMode = 'ADMIN' | 'AUTO';
export type PublicContributionVisibility = 'NAMED' | 'ANONYMOUS';
export type TieBreakerKey = 'TOTAL_CONTRIBUTED' | 'NET_GAIN' | 'NAME';
export type TransactionKind = 'INITIAL_GRANT' | 'CONTRIBUTION' | 'REWARD' | 'ADJUSTMENT';

export interface GameConfig {
  initialTokens: number;
  totalRounds: number;
  multiplierX100: number; // e.g., 200 = 2.00x
  roundDurationSec: number;
  revealDurationSec: number;
  discussionDurationSec: number;
  minContribution: number;
  maxContributionMode: MaxContributionMode;
  maxContributionValue: number; // ignored if BALANCE
  missedPolicy: MissedPolicy;
  distributionMode: DistributionMode;
  hybridEqualAlphaPct: number; // 0..100
  remainderPolicy: RemainderPolicy;
  revealMode: ProgressionMode;
  nextRoundMode: ProgressionMode;
  autoCloseAllSubmitted: boolean;
  targetDurationMin: number;
  autoCatchUp: boolean;
  publicVisibility: PublicContributionVisibility;
  announceFinalRound: boolean;
  openPlayerJoin: boolean;
  tieBreakers: TieBreakerKey[];
}

export interface TeamSummary {
  id: number;
  name: string;
  joinCode?: string;
  seedOrder: number;
  avatarId: number;
  balance: number;
  initialBalance: number;
  totalContributed: number;
  totalRewards: number;
  netGain: number;
  rank: number;
  previousRank: number | null;
  isOnline: boolean;
  hasSubmittedCurrent: boolean;
  isAutoCurrent: boolean;
}

export interface RoundDistributionRow {
  teamId: number;
  teamName: string;
  avatarId: number;
  previousBalance: number;
  contributionAmount: number;
  baseShare: number;
  remainderBonus: number;
  totalReward: number;
  newBalance: number;
  netGain: number;
  isAuto: boolean;
}

export interface RoundSummary {
  id: number;
  roundNo: number;
  status: RoundStatus;
  openedAt: number | null;
  deadlineAt: number | null;
  closedAt: number | null;
  settledAt: number | null;
  poolTotal: number | null;
  carryIn: number;
  carryOut: number;
  rewardTotal: number | null;
  baseShare: number | null;
  remainderTokens: number | null;
  dustX100: number | null;
  cooperationPct: number | null;
  submittedCount: number;
  totalTeams: number;
  distributions?: RoundDistributionRow[];
}

export interface LedgerEntry {
  id: number;
  teamId: number;
  teamName: string;
  roundId: number | null;
  roundNo: number | null;
  kind: TransactionKind;
  amount: number;
  balanceAfter: number;
  note: string;
  createdAt: number;
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  details: string;
  createdAt: number;
}

export interface GameAnalytics {
  groupCooperationIndex: number;
  mostCooperativeTeam: { teamId: number; name: string; avgCoopRate: number } | null;
  biggestFreeRider: { teamId: number; name: string; netGain: number; totalContributed: number } | null;
  mostProfitableRound: { roundNo: number; rewardTotal: number; poolTotal: number } | null;
  roundCoopSeries: Array<{ roundNo: number; poolTotal: number; rewardTotal: number; cooperationPct: number }>;
  teamBalanceSeries: Array<{
    teamId: number;
    name: string;
    balances: Array<{ roundNo: number; balance: number; contribution: number }>;
  }>;
}

export interface PublicGameState {
  sessionId: number;
  sessionCode: string;
  title: string;
  status: GameSessionStatus;
  currentRoundNo: number;
  config: GameConfig;
  serverTime: number;
  startedAt: number | null;
  endedAt: number | null;
  currentRound: RoundSummary | null;
  roundsHistory: RoundSummary[];
  leaderboard: TeamSummary[];
  analytics: GameAnalytics | null;
}

export interface PlayerSessionState extends PublicGameState {
  role: 'team';
  myTeam: TeamSummary;
  myMaxAllowed: number;
  myCurrentContribution: {
    amount: number;
    isAuto: boolean;
    submittedAt: number;
  } | null;
  myHistory: Array<{
    roundNo: number;
    previousBalance: number;
    contributionAmount: number;
    totalReward: number;
    newBalance: number;
    netGain: number;
    isAuto: boolean;
  }>;
  myLedger: LedgerEntry[];
}

export interface AdminSessionState extends PublicGameState {
  role: 'admin';
  playerXcode: string;
  connectedClients: {
    total: number;
    teams: number;
    displays: number;
    admins: number;
  };
  scheduleGuard: {
    elapsedMin: number;
    plannedTotalMin: number;
    projectedEndMin: number;
    behindByMin: number;
    status: 'ON_TRACK' | 'BEHIND' | 'AHEAD';
  };
  ledger: LedgerEntry[];
  auditLogs: AuditEntry[];
}
