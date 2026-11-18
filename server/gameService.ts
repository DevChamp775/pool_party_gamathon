import { db, runInTransaction } from './db.ts';
import {
  DEFAULT_GAME_CONFIG,
  computeGameAnalytics,
  computeMaxAllowed,
  rankTeams,
  settlePoolMath,
  validateContributionInput,
} from './engine.ts';
import { DEFAULT_ADMIN_XCODE, generateShortCode, hashXcode } from './auth.ts';
import type {
  AdminSessionState,
  AuditEntry,
  GameConfig,
  GameSessionStatus,
  LedgerEntry,
  PlayerSessionState,
  PublicGameState,
  RoundDistributionRow,
  RoundStatus,
  RoundSummary,
  TeamSummary,
} from '../src/types/game.ts';

export type WsBroadcaster = (sessionId: number, event: string, extra?: Record<string, unknown>) => void;
export type WsClientCounter = (sessionId: number) => {
  total: number;
  teams: number;
  displays: number;
  admins: number;
};

let broadcaster: WsBroadcaster = () => {};
let clientCounter: WsClientCounter = () => ({ total: 0, teams: 0, displays: 0, admins: 0 });

export function registerWsHooks(bc: WsBroadcaster, cc: WsClientCounter): void {
  broadcaster = bc;
  clientCounter = cc;
}

interface SessionRow {
  id: number;
  session_code: string;
  title: string;
  status: GameSessionStatus;
  player_xcode: string;
  admin_xcode_hash: string;
  config_json: string;
  current_round_no: number;
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
}

interface TeamRow {
  id: number;
  session_id: number;
  name: string;
  join_code: string;
  seed_order: number;
  avatar_id: number;
  token_version: number;
  is_online: number;
  balance: number;
  initial_balance: number;
  total_contributed: number;
  total_rewards: number;
}

interface RoundRow {
  id: number;
  session_id: number;
  round_no: number;
  status: RoundStatus;
  opened_at: number | null;
  deadline_at: number | null;
  closed_at: number | null;
  settled_at: number | null;
  pool_total: number | null;
  carry_in: number;
  carry_out: number;
  reward_total: number | null;
  base_share: number | null;
  remainder_tokens: number | null;
  dust_x100: number | null;
  cooperation_pct: number | null;
}

const DEFAULT_SQUADS = [
  'CYBER WOLVES',
  'NEON TITANS',
  'BIT KNIGHTS',
  'PIXEL PHOENIX',
  'DATA DRAGONS',
];

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function ensureActiveSession(): SessionRow {
  const existing = db
    .prepare('SELECT * FROM sessions ORDER BY id DESC LIMIT 1')
    .get() as SessionRow | undefined;
  if (existing) return existing;

  const now = Date.now();
  const sessionCode = 'PIXEL-2026';
  const playerXcode = 'PLAY-2026';
  const adminHash = hashXcode(DEFAULT_ADMIN_XCODE);

  return runInTransaction(() => {
    const res = db
      .prepare(
        `INSERT INTO sessions (session_code, title, status, player_xcode, admin_xcode_hash, config_json, current_round_no, created_at)
         VALUES (?, ?, 'LOBBY', ?, ?, ?, 0, ?)`
      )
      .run(
        sessionCode,
        'POOL PARTY — Pixel Forge',
        playerXcode,
        adminHash,
        JSON.stringify(DEFAULT_GAME_CONFIG),
        now
      );
    const sessionId = Number(res.lastInsertRowid);

    const seeds = shuffleArray([0, 1, 2, 3, 4]);
    DEFAULT_SQUADS.forEach((name, idx) => {
      const joinCode = generateShortCode(name.slice(0, 4).replace(/[^A-Z]/g, 'P'), 3);
      const tRes = db
        .prepare(
          `INSERT INTO teams (session_id, name, name_lower, join_code, seed_order, avatar_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(sessionId, name, name.toLowerCase(), joinCode, seeds[idx], (idx % 8) + 1, now);
      const teamId = Number(tRes.lastInsertRowid);
      db.prepare(
        `INSERT INTO team_wallets (team_id, balance, initial_balance, total_contributed, total_rewards)
         VALUES (?, 0, 0, 0, 0)`
      ).run(teamId);
    });

    logAudit(sessionId, 'SYSTEM', 'SESSION_CREATED', { sessionCode, playerXcode });
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  });
}

export function getActiveSession(): SessionRow {
  return ensureActiveSession();
}

export function parseConfig(session: SessionRow): GameConfig {
  try {
    return { ...DEFAULT_GAME_CONFIG, ...JSON.parse(session.config_json) };
  } catch {
    return { ...DEFAULT_GAME_CONFIG };
  }
}

function logAudit(
  sessionId: number,
  actor: 'ADMIN' | 'SYSTEM',
  action: string,
  details: Record<string, unknown>
): void {
  db.prepare(
    `INSERT INTO audit_logs (session_id, actor, action, details_json, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, actor, action, JSON.stringify(details), Date.now());
}

function getTeamRows(sessionId: number): TeamRow[] {
  return db
    .prepare(
      `SELECT t.*, w.balance, w.initial_balance, w.total_contributed, w.total_rewards
       FROM teams t
       JOIN team_wallets w ON w.team_id = t.id
       WHERE t.session_id = ?
       ORDER BY t.seed_order ASC, t.id ASC`
    )
    .all(sessionId) as unknown as TeamRow[];
}

function getDistributionsForRound(roundId: number): RoundDistributionRow[] {
  return db
    .prepare(
      `SELECT rd.team_id AS teamId, t.name AS teamName, t.avatar_id AS avatarId,
              rd.previous_balance AS previousBalance, rd.contribution_amount AS contributionAmount,
              rd.base_share AS baseShare, rd.remainder_bonus AS remainderBonus,
              rd.total_reward AS totalReward, rd.new_balance AS newBalance, rd.net_gain AS netGain,
              COALESCE(c.is_auto, 0) AS isAuto
       FROM reward_distributions rd
       JOIN teams t ON t.id = rd.team_id
       LEFT JOIN contributions c ON c.round_id = rd.round_id AND c.team_id = rd.team_id
       WHERE rd.round_id = ?
       ORDER BY rd.new_balance DESC, rd.contribution_amount DESC, t.name ASC`
    )
    .all(roundId)
    .map((r: any) => ({ ...r, isAuto: Boolean(r.isAuto) }));
}

function buildRoundSummary(
  round: RoundRow,
  totalTeams: number,
  includeDistributions: boolean,
  publicVisibility: 'NAMED' | 'ANONYMOUS'
): RoundSummary {
  const countRow = db
    .prepare('SELECT COUNT(*) AS cnt FROM contributions WHERE round_id = ?')
    .get(round.id) as { cnt: number };

  let distributions: RoundDistributionRow[] | undefined;
  if (includeDistributions && round.status === 'SETTLED') {
    const raw = getDistributionsForRound(round.id);
    distributions =
      publicVisibility === 'ANONYMOUS'
        ? raw.map((d, idx) => ({ ...d, teamName: `Player #${idx + 1}` }))
        : raw;
  }

  return {
    id: round.id,
    roundNo: round.round_no,
    status: round.status,
    openedAt: round.opened_at,
    deadlineAt: round.deadline_at,
    closedAt: round.closed_at,
    settledAt: round.settled_at,
    poolTotal: round.status === 'SETTLED' ? round.pool_total : null,
    carryIn: round.carry_in,
    carryOut: round.carry_out,
    rewardTotal: round.status === 'SETTLED' ? round.reward_total : null,
    baseShare: round.status === 'SETTLED' ? round.base_share : null,
    remainderTokens: round.status === 'SETTLED' ? round.remainder_tokens : null,
    dustX100: round.status === 'SETTLED' ? round.dust_x100 : null,
    cooperationPct: round.status === 'SETTLED' ? round.cooperation_pct : null,
    submittedCount: countRow.cnt,
    totalTeams,
    distributions,
  };
}

function buildRankedTeams(
  session: SessionRow,
  config: GameConfig,
  currentRound: RoundRow | undefined,
  includeJoinCode: boolean
): TeamSummary[] {
  const teamRows = getTeamRows(session.id);

  // Submission status ONLY (never amounts!)
  const submittedMap = new Map<number, boolean>();
  if (currentRound) {
    const subs = db
      .prepare('SELECT team_id, is_auto FROM contributions WHERE round_id = ?')
      .all(currentRound.id) as Array<{ team_id: number; is_auto: number }>;
    for (const s of subs) {
      submittedMap.set(s.team_id, Boolean(s.is_auto));
    }
  }

  // Previous round rank for movement arrows
  const prevRankMap = new Map<number, number>();
  const lastSettled = db
    .prepare(
      `SELECT id FROM game_rounds WHERE session_id = ? AND status = 'SETTLED' ORDER BY round_no DESC LIMIT 1 OFFSET 1`
    )
    .get(session.id) as { id: number } | undefined;
  if (lastSettled) {
    const prevRows = db
      .prepare(
        `SELECT team_id FROM reward_distributions WHERE round_id = ? ORDER BY new_balance DESC, team_id ASC`
      )
      .all(lastSettled.id) as Array<{ team_id: number }>;
    prevRows.forEach((r, idx) => prevRankMap.set(r.team_id, idx + 1));
  }

  const unranked = teamRows.map((t) => ({
    id: t.id,
    name: t.name,
    ...(includeJoinCode ? { joinCode: t.join_code } : {}),
    seedOrder: t.seed_order,
    avatarId: t.avatar_id,
    balance: t.balance,
    initialBalance: t.initial_balance,
    totalContributed: t.total_contributed,
    totalRewards: t.total_rewards,
    netGain: t.balance - t.initial_balance,
    previousRank: prevRankMap.get(t.id) ?? null,
    isOnline: Boolean(t.is_online),
    hasSubmittedCurrent: submittedMap.has(t.id),
    isAutoCurrent: submittedMap.get(t.id) ?? false,
  }));

  return rankTeams(unranked, config.tieBreakers);
}

export function getPublicGameState(sessionId?: number): PublicGameState {
  const session = sessionId
    ? (db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRow | undefined) ??
      ensureActiveSession()
    : ensureActiveSession();
  const config = parseConfig(session);

  const rounds = db
    .prepare('SELECT * FROM game_rounds WHERE session_id = ? ORDER BY round_no ASC')
    .all(session.id) as unknown as RoundRow[];

  const currentRoundRow = rounds.find((r) => r.round_no === session.current_round_no);
  const leaderboard = buildRankedTeams(session, config, currentRoundRow, false);

  const currentRound = currentRoundRow
    ? buildRoundSummary(currentRoundRow, leaderboard.length, true, config.publicVisibility)
    : null;

  const settledRoundsRows = rounds.filter((r) => r.status === 'SETTLED');
  const roundsHistory = settledRoundsRows.map((r) =>
    buildRoundSummary(r, leaderboard.length, true, config.publicVisibility)
  );

  const analytics = computeGameAnalytics(
    leaderboard,
    roundsHistory.map((r) => ({
      roundNo: r.roundNo,
      poolTotal: r.poolTotal ?? 0,
      rewardTotal: r.rewardTotal ?? 0,
      cooperationPct: r.cooperationPct ?? 0,
      distributions: r.distributions ?? [],
    }))
  );

  return {
    sessionId: session.id,
    sessionCode: session.session_code,
    title: session.title,
    status: session.status,
    currentRoundNo: session.current_round_no,
    config,
    serverTime: Date.now(),
    startedAt: session.started_at,
    endedAt: session.ended_at,
    currentRound,
    roundsHistory,
    leaderboard,
    analytics,
  };
}

export function getPlayerSessionState(sessionId: number, teamId: number): PlayerSessionState {
  const base = getPublicGameState(sessionId);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  const config = parseConfig(session);

  const myTeam = base.leaderboard.find((t) => t.id === teamId);
  if (!myTeam) {
    throw new Error('Team not found in session');
  }

  // Own join code is allowed for the player who owns that team
  const teamRow = db.prepare('SELECT join_code FROM teams WHERE id = ?').get(teamId) as {
    join_code: string;
  };
  const myTeamWithCode: TeamSummary = { ...myTeam, joinCode: teamRow.join_code };

  let myCurrentContribution: PlayerSessionState['myCurrentContribution'] = null;
  if (base.currentRound) {
    const c = db
      .prepare('SELECT amount, is_auto, submitted_at FROM contributions WHERE round_id = ? AND team_id = ?')
      .get(base.currentRound.id, teamId) as
      | { amount: number; is_auto: number; submitted_at: number }
      | undefined;
    if (c) {
      myCurrentContribution = {
        amount: c.amount,
        isAuto: Boolean(c.is_auto),
        submittedAt: c.submitted_at,
      };
    }
  }

  const myHistory = db
    .prepare(
      `SELECT gr.round_no AS roundNo, rd.previous_balance AS previousBalance,
              rd.contribution_amount AS contributionAmount, rd.total_reward AS totalReward,
              rd.new_balance AS newBalance, rd.net_gain AS netGain,
              COALESCE(c.is_auto, 0) AS isAuto
       FROM reward_distributions rd
       JOIN game_rounds gr ON gr.id = rd.round_id
       LEFT JOIN contributions c ON c.round_id = rd.round_id AND c.team_id = rd.team_id
       WHERE rd.team_id = ? AND gr.session_id = ? AND gr.status = 'SETTLED'
       ORDER BY gr.round_no ASC`
    )
    .all(teamId, sessionId)
    .map((r: any) => ({ ...r, isAuto: Boolean(r.isAuto) }));

  const myLedger = db
    .prepare(
      `SELECT tx.id, tx.team_id AS teamId, t.name AS teamName, tx.round_id AS roundId,
              gr.round_no AS roundNo, tx.kind, tx.amount, tx.balance_after AS balanceAfter,
              tx.note, tx.created_at AS createdAt
       FROM transactions tx
       JOIN teams t ON t.id = tx.team_id
       LEFT JOIN game_rounds gr ON gr.id = tx.round_id
       WHERE tx.team_id = ? AND tx.session_id = ?
       ORDER BY tx.id DESC`
    )
    .all(teamId, sessionId) as unknown as LedgerEntry[];

  const myMaxAllowed = computeMaxAllowed(
    myTeam.balance,
    config.maxContributionMode,
    config.maxContributionValue
  );

  return {
    ...base,
    role: 'team',
    myTeam: myTeamWithCode,
    myMaxAllowed,
    myCurrentContribution,
    myHistory,
    myLedger,
  };
}

export function getAdminSessionState(sessionId: number): AdminSessionState {
  const base = getPublicGameState(sessionId);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  const config = parseConfig(session);

  const rounds = db
    .prepare('SELECT * FROM game_rounds WHERE session_id = ? ORDER BY round_no ASC')
    .all(sessionId) as unknown as RoundRow[];
  const currentRoundRow = rounds.find((r) => r.round_no === session.current_round_no);
  const adminLeaderboard = buildRankedTeams(session, config, currentRoundRow, true);

  const ledger = db
    .prepare(
      `SELECT tx.id, tx.team_id AS teamId, t.name AS teamName, tx.round_id AS roundId,
              gr.round_no AS roundNo, tx.kind, tx.amount, tx.balance_after AS balanceAfter,
              tx.note, tx.created_at AS createdAt
       FROM transactions tx
       JOIN teams t ON t.id = tx.team_id
       LEFT JOIN game_rounds gr ON gr.id = tx.round_id
       WHERE tx.session_id = ?
       ORDER BY tx.id DESC
       LIMIT 250`
    )
    .all(sessionId) as unknown as LedgerEntry[];

  const auditLogs = db
    .prepare(
      `SELECT id, actor, action, details_json AS details, created_at AS createdAt
       FROM audit_logs
       WHERE session_id = ?
       ORDER BY id DESC
       LIMIT 100`
    )
    .all(sessionId) as unknown as AuditEntry[];

  const now = Date.now();
  const elapsedMin = session.started_at ? Math.round((now - session.started_at) / 60000) : 0;
  const perRoundMin =
    (config.roundDurationSec + config.revealDurationSec + config.discussionDurationSec + 15) / 60;
  const remainingRounds = Math.max(0, config.totalRounds - session.current_round_no);
  const projectedEndMin = Math.round(elapsedMin + remainingRounds * perRoundMin);
  const behindByMin = projectedEndMin - config.targetDurationMin;

  return {
    ...base,
    role: 'admin',
    playerXcode: session.player_xcode,
    leaderboard: adminLeaderboard,
    connectedClients: clientCounter(sessionId),
    scheduleGuard: {
      elapsedMin,
      plannedTotalMin: config.targetDurationMin,
      projectedEndMin,
      behindByMin,
      status: behindByMin > 3 ? 'BEHIND' : behindByMin < -5 ? 'AHEAD' : 'ON_TRACK',
    },
    ledger,
    auditLogs,
  };
}

export function setTeamOnlineStatus(teamId: number, isOnline: boolean): void {
  db.prepare('UPDATE teams SET is_online = ?, last_seen_at = ? WHERE id = ?').run(
    isOnline ? 1 : 0,
    Date.now(),
    teamId
  );
}

export function joinTeamByTeamXcode(joinCode: string): {
  sessionId: number;
  teamId: number;
  tokenVersion: number;
} {
  const normalized = joinCode.trim().toUpperCase();
  const row = db
    .prepare(
      `SELECT t.id AS teamId, t.session_id AS sessionId, t.token_version AS tokenVersion
       FROM teams t
       JOIN sessions s ON s.id = t.session_id
       WHERE UPPER(t.join_code) = ?
       ORDER BY s.id DESC LIMIT 1`
    )
    .get(normalized) as { teamId: number; sessionId: number; tokenVersion: number } | undefined;
  if (!row) {
    throw new Error('INVALID_TEAM_XCODE');
  }
  return row;
}

export function joinWithPlayerXcode(params: {
  playerXcode: string;
  teamName: string;
}): {
  sessionId: number;
  teamId: number;
  tokenVersion: number;
  joinCode: string;
} {
  const session = ensureActiveSession();
  const submittedCode = params.playerXcode.trim().toUpperCase();
  if (submittedCode !== session.player_xcode.trim().toUpperCase()) {
    throw new Error('INVALID_PLAYER_XCODE');
  }

  const trimmedName = params.teamName.trim();
  if (trimmedName.length < 1 || trimmedName.length > 30) {
    throw new Error('INVALID_TEAM_NAME');
  }

  const nameLower = trimmedName.toLowerCase();
  const config = parseConfig(session);

  return runInTransaction(() => {
    const existing = db
      .prepare('SELECT id, token_version, join_code FROM teams WHERE session_id = ? AND name_lower = ?')
      .get(session.id, nameLower) as
      | { id: number; token_version: number; join_code: string }
      | undefined;

    if (existing) {
      return {
        sessionId: session.id,
        teamId: existing.id,
        tokenVersion: existing.token_version,
        joinCode: existing.join_code,
      };
    }

    if (session.status !== 'LOBBY' || !config.openPlayerJoin) {
      throw new Error('REGISTRATION_CLOSED');
    }

    const countRow = db
      .prepare('SELECT COUNT(*) AS cnt FROM teams WHERE session_id = ?')
      .get(session.id) as { cnt: number };
    if (countRow.cnt >= 40) {
      throw new Error('MAX_TEAMS_REACHED');
    }

    const prefix = trimmedName.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'PLYR';
    const joinCode = generateShortCode(prefix, 3);
    const now = Date.now();
    const res = db
      .prepare(
        `INSERT INTO teams (session_id, name, name_lower, join_code, seed_order, avatar_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(session.id, trimmedName, nameLower, joinCode, countRow.cnt, (countRow.cnt % 8) + 1, now);
    const teamId = Number(res.lastInsertRowid);

    db.prepare(
      `INSERT INTO team_wallets (team_id, balance, initial_balance, total_contributed, total_rewards)
       VALUES (?, 0, 0, 0, 0)`
    ).run(teamId);

    logAudit(session.id, 'SYSTEM', 'PLAYER_REGISTERED', { teamId, name: trimmedName });

    return {
      sessionId: session.id,
      teamId,
      tokenVersion: 1,
      joinCode,
    };
  });
}

export function configureSession(params: {
  sessionId: number;
  title?: string;
  playerXcode?: string;
  newAdminXcode?: string;
  teamNames: string[];
  config: Partial<GameConfig>;
}): void {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(params.sessionId) as
    | SessionRow
    | undefined;
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status !== 'LOBBY') {
    throw new Error('Cannot reconfigure teams after the game has started.');
  }

  const cleanedNames = params.teamNames.map((n) => n.trim()).filter(Boolean);
  if (cleanedNames.length < 2 || cleanedNames.length > 40) {
    throw new Error('Team count must be between 2 and 40.');
  }

  const seen = new Set<string>();
  for (const name of cleanedNames) {
    if (name.length > 30) throw new Error(`Team name too long: ${name}`);
    const lower = name.toLowerCase();
    if (seen.has(lower)) throw new Error(`Duplicate team name: ${name}`);
    seen.add(lower);
  }

  const nextConfig: GameConfig = {
    ...parseConfig(session),
    ...params.config,
  };

  const nextPlayerXcode =
    params.playerXcode && params.playerXcode.trim().length >= 4
      ? params.playerXcode.trim().toUpperCase()
      : session.player_xcode;

  const nextAdminHash =
    params.newAdminXcode && params.newAdminXcode.trim().length >= 4
      ? hashXcode(params.newAdminXcode.trim())
      : session.admin_xcode_hash;

  if (params.newAdminXcode && params.newAdminXcode.trim().toUpperCase() === nextPlayerXcode) {
    throw new Error('Admin XCode and Player XCode must be different!');
  }

  runInTransaction(() => {
    db.prepare(
      `UPDATE sessions SET title = ?, player_xcode = ?, admin_xcode_hash = ?, config_json = ? WHERE id = ?`
    ).run(
      params.title?.trim() || session.title,
      nextPlayerXcode,
      nextAdminHash,
      JSON.stringify(nextConfig),
      session.id
    );

    // Replace teams in LOBBY
    db.prepare('DELETE FROM teams WHERE session_id = ?').run(session.id);

    const seeds = shuffleArray(cleanedNames.map((_, idx) => idx));
    const now = Date.now();
    cleanedNames.forEach((name, idx) => {
      const prefix = name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'TEAM';
      const joinCode = generateShortCode(prefix, 3);
      const tRes = db
        .prepare(
          `INSERT INTO teams (session_id, name, name_lower, join_code, seed_order, avatar_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(session.id, name, name.toLowerCase(), joinCode, seeds[idx], (idx % 8) + 1, now);
      const teamId = Number(tRes.lastInsertRowid);
      db.prepare(
        `INSERT INTO team_wallets (team_id, balance, initial_balance, total_contributed, total_rewards)
         VALUES (?, 0, 0, 0, 0)`
      ).run(teamId);
    });

    logAudit(session.id, 'ADMIN', 'SESSION_CONFIGURED', {
      teamCount: cleanedNames.length,
      rounds: nextConfig.totalRounds,
      multiplierX100: nextConfig.multiplierX100,
    });
  });

  broadcaster(session.id, 'state_update');
}

export function startGame(sessionId: number): void {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status !== 'LOBBY') throw new Error('Game has already started.');

  const config = parseConfig(session);
  const teams = getTeamRows(sessionId);
  if (teams.length < 2) throw new Error('At least 2 teams are required to start.');

  const now = Date.now();

  runInTransaction(() => {
    const cas = db
      .prepare(`UPDATE sessions SET status = 'IN_PROGRESS', started_at = ?, current_round_no = 0 WHERE id = ? AND status = 'LOBBY'`)
      .run(now, sessionId);
    if (cas.changes !== 1) throw new Error('Concurrent start detected');

    for (const t of teams) {
      db.prepare(
        `UPDATE team_wallets SET balance = ?, initial_balance = ?, total_contributed = 0, total_rewards = 0 WHERE team_id = ?`
      ).run(config.initialTokens, config.initialTokens, t.id);

      db.prepare(
        `INSERT INTO transactions (session_id, team_id, round_id, kind, amount, balance_after, note, idempotency_key, created_at)
         VALUES (?, ?, NULL, 'INITIAL_GRANT', ?, ?, 'Initial token allocation', ?, ?)`
      ).run(
        sessionId,
        t.id,
        config.initialTokens,
        config.initialTokens,
        `init:${sessionId}:${t.id}`,
        now
      );
    }

    for (let r = 1; r <= config.totalRounds; r++) {
      db.prepare(
        `INSERT INTO game_rounds (session_id, round_no, status) VALUES (?, ?, 'PENDING')`
      ).run(sessionId, r);
    }

    logAudit(sessionId, 'ADMIN', 'GAME_STARTED', {
      teamCount: teams.length,
      initialTokens: config.initialTokens,
    });
  });

  // Automatically open Round 1 when starting the game
  startNextRound(sessionId);
}

export function startNextRound(sessionId: number): void {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status === 'PAUSED') throw new Error('Resume the game before starting a round.');
  if (session.status !== 'IN_PROGRESS') throw new Error('Game is not in progress.');

  const config = parseConfig(session);
  const nextNo = session.current_round_no + 1;
  if (nextNo > config.totalRounds) {
    endGame(sessionId, 'SYSTEM');
    return;
  }

  // Carry over remainder from previous settled round if applicable
  let carryIn = 0;
  if (session.current_round_no > 0) {
    const prev = db
      .prepare('SELECT carry_out, status FROM game_rounds WHERE session_id = ? AND round_no = ?')
      .get(sessionId, session.current_round_no) as
      | { carry_out: number; status: RoundStatus }
      | undefined;
    if (prev && prev.status !== 'SETTLED') {
      throw new Error('Settle the current round before starting the next one.');
    }
    carryIn = prev?.carry_out ?? 0;
  }

  const now = Date.now();
  const hasDiscussion = config.discussionDurationSec > 0;
  const targetStatus: RoundStatus = hasDiscussion ? 'DISCUSSION' : 'OPEN';
  const durationMs =
    (hasDiscussion ? config.discussionDurationSec : config.roundDurationSec) * 1000;

  runInTransaction(() => {
    const cas = db
      .prepare(
        `UPDATE game_rounds
         SET status = ?, opened_at = ?, deadline_at = ?, carry_in = ?
         WHERE session_id = ? AND round_no = ? AND status = 'PENDING'`
      )
      .run(targetStatus, now, now + durationMs, carryIn, sessionId, nextNo);
    if (cas.changes !== 1) throw new Error('Round already opened or missing.');

    db.prepare('UPDATE sessions SET current_round_no = ? WHERE id = ?').run(nextNo, sessionId);
    logAudit(sessionId, 'ADMIN', 'ROUND_STARTED', { roundNo: nextNo, status: targetStatus });
  });

  broadcaster(sessionId, 'round_started', { roundNo: nextNo, status: targetStatus });
}

export function openDiscussionToContribution(sessionId: number): void {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  const config = parseConfig(session);
  const now = Date.now();
  const res = db
    .prepare(
      `UPDATE game_rounds SET status = 'OPEN', opened_at = ?, deadline_at = ?
       WHERE session_id = ? AND round_no = ? AND status = 'DISCUSSION'`
    )
    .run(now, now + config.roundDurationSec * 1000, sessionId, session.current_round_no);
  if (res.changes === 1) {
    logAudit(sessionId, 'SYSTEM', 'CONTRIBUTION_WINDOW_OPENED', { roundNo: session.current_round_no });
    broadcaster(sessionId, 'round_started', { roundNo: session.current_round_no, status: 'OPEN' });
  }
}

export function submitContribution(params: {
  sessionId: number;
  teamId: number;
  rawAmount: unknown;
}): { amount: number; roundNo: number; allSubmitted: boolean } {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(params.sessionId) as unknown as SessionRow;
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status === 'PAUSED') {
    const e = new Error('Game is currently paused.');
    (e as any).code = 'GAME_PAUSED';
    throw e;
  }
  if (session.status !== 'IN_PROGRESS') {
    const e = new Error('Round is not active.');
    (e as any).code = 'ROUND_CLOSED';
    throw e;
  }

  const config = parseConfig(session);
  const round = db
    .prepare('SELECT * FROM game_rounds WHERE session_id = ? AND round_no = ?')
    .get(params.sessionId, session.current_round_no) as RoundRow | undefined;

  if (!round || round.status !== 'OPEN') {
    const e = new Error('Contribution window is closed.');
    (e as any).code = 'ROUND_CLOSED';
    throw e;
  }

  // +1s network grace over deadline
  if (round.deadline_at && Date.now() > round.deadline_at + 1000) {
    const e = new Error('Round timer has expired.');
    (e as any).code = 'ROUND_CLOSED';
    throw e;
  }

  const wallet = db
    .prepare('SELECT balance FROM team_wallets WHERE team_id = ?')
    .get(params.teamId) as { balance: number } | undefined;
  if (!wallet) throw new Error('WALLET_NOT_FOUND');

  const check = validateContributionInput(params.rawAmount, wallet.balance, config);
  if (!check.valid) {
    const e = new Error(check.message || 'Invalid donation amount.');
    (e as any).code = check.code;
    throw e;
  }

  let allSubmitted = false;

  runInTransaction(() => {
    const existing = db
      .prepare('SELECT id FROM contributions WHERE round_id = ? AND team_id = ?')
      .get(round.id, params.teamId);
    if (existing) {
      const e = new Error('You have already locked your donation for this round.');
      (e as any).code = 'ALREADY_SUBMITTED';
      throw e;
    }

    db.prepare(
      `INSERT INTO contributions (round_id, team_id, amount, is_auto, submitted_at)
       VALUES (?, ?, ?, 0, ?)`
    ).run(round.id, params.teamId, check.amount, Date.now());

    const totalTeams = (
      db.prepare('SELECT COUNT(*) AS cnt FROM teams WHERE session_id = ?').get(params.sessionId) as {
        cnt: number;
      }
    ).cnt;
    const totalSubs = (
      db.prepare('SELECT COUNT(*) AS cnt FROM contributions WHERE round_id = ?').get(round.id) as {
        cnt: number;
      }
    ).cnt;
    allSubmitted = totalSubs >= totalTeams;
  });

  broadcaster(params.sessionId, 'submission_count', { roundNo: round.round_no });

  if (allSubmitted && config.autoCloseAllSubmitted) {
    closeCurrentRound(params.sessionId, 'SYSTEM');
  }

  return { amount: check.amount, roundNo: round.round_no, allSubmitted };
}

export function closeCurrentRound(sessionId: number, actor: 'ADMIN' | 'SYSTEM' = 'ADMIN'): void {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  if (!session) throw new Error('SESSION_NOT_FOUND');
  const config = parseConfig(session);

  const round = db
    .prepare('SELECT * FROM game_rounds WHERE session_id = ? AND round_no = ?')
    .get(sessionId, session.current_round_no) as RoundRow | undefined;
  if (!round || round.status !== 'OPEN') return;

  const now = Date.now();

  runInTransaction(() => {
    const cas = db
      .prepare(`UPDATE game_rounds SET status = 'CLOSED', closed_at = ? WHERE id = ? AND status = 'OPEN'`)
      .run(now, round.id);
    if (cas.changes !== 1) return;

    // Fill missed contributions per policy
    const teams = getTeamRows(sessionId);
    for (const t of teams) {
      const existing = db
        .prepare('SELECT id FROM contributions WHERE round_id = ? AND team_id = ?')
        .get(round.id, t.id);
      if (!existing) {
        let autoAmount = 0;
        const maxAllowed = computeMaxAllowed(
          t.balance,
          config.maxContributionMode,
          config.maxContributionValue
        );
        if (config.missedPolicy === 'MINIMUM') {
          autoAmount = Math.min(config.minContribution, maxAllowed);
        } else if (config.missedPolicy === 'SAME_AS_LAST' && round.round_no > 1) {
          const lastC = db
            .prepare(
              `SELECT c.amount FROM contributions c
               JOIN game_rounds gr ON gr.id = c.round_id
               WHERE gr.session_id = ? AND gr.round_no = ? AND c.team_id = ?`
            )
            .get(sessionId, round.round_no - 1, t.id) as { amount: number } | undefined;
          autoAmount = Math.min(lastC?.amount ?? 0, maxAllowed);
        }
        db.prepare(
          `INSERT OR IGNORE INTO contributions (round_id, team_id, amount, is_auto, submitted_at)
           VALUES (?, ?, ?, 1, ?)`
        ).run(round.id, t.id, Math.max(0, autoAmount), now);
      }
    }

    logAudit(sessionId, actor, 'ROUND_CLOSED', { roundNo: round.round_no });
  });

  broadcaster(sessionId, 'round_closed', { roundNo: round.round_no });

  if (config.revealMode === 'AUTO') {
    revealAndSettleRound(sessionId, 'SYSTEM');
  }
}

export function revealAndSettleRound(sessionId: number, actor: 'ADMIN' | 'SYSTEM' = 'ADMIN'): void {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  if (!session) throw new Error('SESSION_NOT_FOUND');
  const config = parseConfig(session);

  const round = db
    .prepare('SELECT * FROM game_rounds WHERE session_id = ? AND round_no = ?')
    .get(sessionId, session.current_round_no) as RoundRow | undefined;
  if (!round) throw new Error('No active round found.');

  if (round.status === 'OPEN') {
    closeCurrentRound(sessionId, actor);
  }

  const freshRound = db.prepare('SELECT * FROM game_rounds WHERE id = ?').get(round.id) as unknown as RoundRow;
  if (freshRound.status === 'SETTLED') {
    return; // Idempotent
  }
  if (freshRound.status !== 'CLOSED') {
    throw new Error('Round must be closed before revealing.');
  }

  const now = Date.now();

  runInTransaction(() => {
    const cas = db
      .prepare(`UPDATE game_rounds SET status = 'SETTLED', settled_at = ? WHERE id = ? AND status = 'CLOSED'`)
      .run(now, freshRound.id);
    if (cas.changes !== 1) return;

    const teams = getTeamRows(sessionId);
    const inputTeams = teams.map((t) => {
      const c = db
        .prepare('SELECT amount, is_auto FROM contributions WHERE round_id = ? AND team_id = ?')
        .get(freshRound.id, t.id) as { amount: number; is_auto: number } | undefined;
      // Re-validate against current balance
      const rawAmt = c?.amount ?? 0;
      const safeAmt = Math.max(0, Math.min(rawAmt, t.balance));
      return {
        teamId: t.id,
        teamName: t.name,
        avatarId: t.avatar_id,
        seedOrder: t.seed_order,
        balanceBefore: t.balance,
        contribution: safeAmt,
        isAuto: Boolean(c?.is_auto ?? 1),
      };
    });

    const settled = settlePoolMath({
      teams: inputTeams,
      roundNo: freshRound.round_no,
      carryIn: freshRound.carry_in,
      config,
    });

    db.prepare(
      `UPDATE game_rounds
       SET pool_total = ?, carry_out = ?, reward_total = ?, base_share = ?,
           remainder_tokens = ?, dust_x100 = ?, cooperation_pct = ?
       WHERE id = ?`
    ).run(
      settled.poolTotal,
      settled.carryOut,
      settled.rewardTotal,
      settled.baseShare,
      settled.remainderTokens,
      settled.dustX100,
      settled.cooperationPct,
      freshRound.id
    );

    for (const row of settled.rows) {
      const afterContrib = row.previousBalance - row.contributionAmount;
      const finalBalance = row.newBalance;

      // 1. Ledger: CONTRIBUTION (-)
      db.prepare(
        `INSERT INTO transactions (session_id, team_id, round_id, kind, amount, balance_after, note, idempotency_key, created_at)
         VALUES (?, ?, ?, 'CONTRIBUTION', ?, ?, ?, ?, ?)`
      ).run(
        sessionId,
        row.teamId,
        freshRound.id,
        -row.contributionAmount,
        afterContrib,
        `Round ${freshRound.round_no} pool donation`,
        `contrib:${freshRound.id}:${row.teamId}`,
        now
      );

      // 2. Ledger: REWARD (+)
      db.prepare(
        `INSERT INTO transactions (session_id, team_id, round_id, kind, amount, balance_after, note, idempotency_key, created_at)
         VALUES (?, ?, ?, 'REWARD', ?, ?, ?, ?, ?)`
      ).run(
        sessionId,
        row.teamId,
        freshRound.id,
        row.totalReward,
        finalBalance,
        `Round ${freshRound.round_no} pool share${row.remainderBonus ? ' (+1 remainder)' : ''}`,
        `reward:${freshRound.id}:${row.teamId}`,
        now
      );

      // 3. Guarded wallet update
      const walletUpd = db
        .prepare(
          `UPDATE team_wallets
           SET balance = balance + ?,
               total_contributed = total_contributed + ?,
               total_rewards = total_rewards + ?
           WHERE team_id = ? AND balance + ? >= 0`
        )
        .run(
          row.netGain,
          row.contributionAmount,
          row.totalReward,
          row.teamId,
          row.netGain
        );
      if (walletUpd.changes !== 1) {
        throw new Error(`Wallet balance guard triggered for team ${row.teamId}`);
      }

      // 4. Distribution snapshot
      db.prepare(
        `INSERT INTO reward_distributions
         (round_id, team_id, previous_balance, contribution_amount, base_share, remainder_bonus, total_reward, new_balance, net_gain)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        freshRound.id,
        row.teamId,
        row.previousBalance,
        row.contributionAmount,
        row.baseShare,
        row.remainderBonus,
        row.totalReward,
        row.newBalance,
        row.netGain
      );
    }

    logAudit(sessionId, actor, 'ROUND_REVEALED', {
      roundNo: freshRound.round_no,
      poolTotal: settled.poolTotal,
      rewardTotal: settled.rewardTotal,
    });
  });

  broadcaster(sessionId, 'round_revealed', { roundNo: freshRound.round_no });
}

export function pauseOrResumeGame(sessionId: number): GameSessionStatus {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status !== 'IN_PROGRESS' && session.status !== 'PAUSED') {
    throw new Error('Can only pause/resume an active game.');
  }
  const nextStatus: GameSessionStatus = session.status === 'IN_PROGRESS' ? 'PAUSED' : 'IN_PROGRESS';
  db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(nextStatus, sessionId);
  logAudit(sessionId, 'ADMIN', nextStatus === 'PAUSED' ? 'GAME_PAUSED' : 'GAME_RESUMED', {});
  broadcaster(sessionId, 'state_update');
  return nextStatus;
}

export function adjustTeamWallet(params: {
  sessionId: number;
  teamId: number;
  delta: number;
  note: string;
}): void {
  if (!Number.isInteger(params.delta) || params.delta === 0) {
    throw new Error('Adjustment delta must be a non-zero integer.');
  }
  const now = Date.now();
  runInTransaction(() => {
    const wallet = db
      .prepare('SELECT balance FROM team_wallets WHERE team_id = ?')
      .get(params.teamId) as { balance: number } | undefined;
    if (!wallet) throw new Error('Team wallet not found');
    const newBal = wallet.balance + params.delta;
    if (newBal < 0) throw new Error('Adjustment cannot make balance negative.');

    db.prepare('UPDATE team_wallets SET balance = ? WHERE team_id = ?').run(newBal, params.teamId);
    db.prepare(
      `INSERT INTO transactions (session_id, team_id, round_id, kind, amount, balance_after, note, idempotency_key, created_at)
       VALUES (?, ?, NULL, 'ADJUSTMENT', ?, ?, ?, ?, ?)`
    ).run(
      params.sessionId,
      params.teamId,
      params.delta,
      newBal,
      params.note.trim() || 'Admin wallet adjustment',
      `adj:${params.sessionId}:${params.teamId}:${now}`,
      now
    );
    logAudit(params.sessionId, 'ADMIN', 'WALLET_ADJUSTED', {
      teamId: params.teamId,
      delta: params.delta,
      note: params.note,
    });
  });
  broadcaster(params.sessionId, 'state_update');
}

export function regenerateTeamXcode(sessionId: number, teamId: number): string {
  const team = db
    .prepare('SELECT id, name FROM teams WHERE id = ? AND session_id = ?')
    .get(teamId, sessionId) as { id: number; name: string } | undefined;
  if (!team) throw new Error('Team not found');

  const prefix = team.name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'TEAM';
  const nextCode = generateShortCode(prefix, 3);
  db.prepare(
    `UPDATE teams SET join_code = ?, token_version = token_version + 1 WHERE id = ?`
  ).run(nextCode, teamId);
  logAudit(sessionId, 'ADMIN', 'TEAM_XCODE_ROTATED', { teamId, teamName: team.name });
  broadcaster(sessionId, 'state_update');
  return nextCode;
}

export function endGame(sessionId: number, actor: 'ADMIN' | 'SYSTEM' = 'ADMIN'): void {
  const now = Date.now();
  db.prepare(`UPDATE sessions SET status = 'ENDED', ended_at = ? WHERE id = ?`).run(now, sessionId);
  logAudit(sessionId, actor, 'GAME_ENDED', {});
  broadcaster(sessionId, 'game_ended');
}

export function resetSessionToLobby(sessionId: number): void {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  if (!session) throw new Error('SESSION_NOT_FOUND');

  runInTransaction(() => {
    db.prepare('DELETE FROM reward_distributions WHERE round_id IN (SELECT id FROM game_rounds WHERE session_id = ?)').run(sessionId);
    db.prepare('DELETE FROM contributions WHERE round_id IN (SELECT id FROM game_rounds WHERE session_id = ?)').run(sessionId);
    // Reset keeps teams & creates a clean session row or resets wallets? Because transactions are append-only,
    // we create a fresh session preserving the team roster and XCodes!
    const now = Date.now();
    const newCode = generateShortCode('PXL', 4);
    const oldTeams = getTeamRows(sessionId);

    const res = db
      .prepare(
        `INSERT INTO sessions (session_code, title, status, player_xcode, admin_xcode_hash, config_json, current_round_no, created_at)
         VALUES (?, ?, 'LOBBY', ?, ?, ?, 0, ?)`
      )
      .run(
        newCode,
        session.title,
        session.player_xcode,
        session.admin_xcode_hash,
        session.config_json,
        now
      );
    const newSessionId = Number(res.lastInsertRowid);

    const seeds = shuffleArray(oldTeams.map((_, i) => i));
    oldTeams.forEach((t, idx) => {
      const tRes = db
        .prepare(
          `INSERT INTO teams (session_id, name, name_lower, join_code, seed_order, avatar_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          newSessionId,
          t.name,
          t.name.toLowerCase(),
          generateShortCode(t.name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'TEAM', 3),
          seeds[idx],
          t.avatar_id,
          now
        );
      db.prepare(
        `INSERT INTO team_wallets (team_id, balance, initial_balance, total_contributed, total_rewards)
         VALUES (?, 0, 0, 0, 0)`
      ).run(Number(tRes.lastInsertRowid));
    });

    logAudit(newSessionId, 'ADMIN', 'SESSION_RESET', { previousSessionId: sessionId });
  });

  broadcaster(sessionId, 'session_reset');
}

export function exportSessionCsv(sessionId: number): string {
  const state = getPublicGameState(sessionId);
  const lines: string[] = [
    'Round,Team,Previous Balance,Donated,Base Share,Remainder Bonus,Total Reward,New Balance,Net Gain,Auto Submitted',
  ];
  for (const r of state.roundsHistory) {
    for (const d of r.distributions ?? []) {
      lines.push(
        [
          r.roundNo,
          `"${d.teamName.replace(/"/g, '""')}"`,
          d.previousBalance,
          d.contributionAmount,
          d.baseShare,
          d.remainderBonus,
          d.totalReward,
          d.newBalance,
          d.netGain,
          d.isAuto ? 'YES' : 'NO',
        ].join(',')
      );
    }
  }
  return lines.join('\n');
}

export function startRoundTicker(): NodeJS.Timeout {
  return setInterval(() => {
    try {
      const session = db.prepare('SELECT * FROM sessions ORDER BY id DESC LIMIT 1').get() as
        | SessionRow
        | undefined;
      if (!session || session.status !== 'IN_PROGRESS') return;

      const config = parseConfig(session);
      const round = db
        .prepare('SELECT * FROM game_rounds WHERE session_id = ? AND round_no = ?')
        .get(session.id, session.current_round_no) as RoundRow | undefined;
      if (!round) return;

      const now = Date.now();
      if (round.status === 'DISCUSSION' && round.deadline_at && now >= round.deadline_at) {
        openDiscussionToContribution(session.id);
      } else if (round.status === 'OPEN' && round.deadline_at && now >= round.deadline_at) {
        closeCurrentRound(session.id, 'SYSTEM');
      } else if (
        round.status === 'SETTLED' &&
        config.nextRoundMode === 'AUTO' &&
        round.settled_at &&
        now >= round.settled_at + config.revealDurationSec * 1000
      ) {
        if (session.current_round_no >= config.totalRounds) {
          endGame(session.id, 'SYSTEM');
        } else {
          startNextRound(session.id);
        }
      }
    } catch (err) {
      console.error('Ticker error:', err);
    }
  }, 1000);
}
