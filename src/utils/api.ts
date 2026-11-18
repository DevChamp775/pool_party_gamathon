import type { AdminSessionState, GameConfig, PlayerSessionState, PublicGameState } from '../types/game.ts';

const ADMIN_TOKEN_KEY = 'pp_admin_token';
const PLAYER_TOKEN_KEY = 'pp_player_token';

function getStoredToken(key: string): string {
  try {
    return window.sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function setStoredToken(key: string, val: string): void {
  try {
    if (val) window.sessionStorage.setItem(key, val);
    else window.sessionStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export function getAdminAuthToken(): string {
  return getStoredToken(ADMIN_TOKEN_KEY);
}

export function getPlayerAuthToken(): string {
  return getStoredToken(PLAYER_TOKEN_KEY);
}

async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ============================================================================
// PUBLIC / DISPLAY API
// ============================================================================
export const publicApi = {
  getState: () => fetch('/api/public/state').then((r) => handleJson<PublicGameState>(r)),
  getLobbyTeams: () =>
    fetch('/api/public/teams-lobby').then((r) =>
      handleJson<{
        sessionCode: string;
        status: string;
        teams: Array<{ id: number; name: string; avatarId: number; isOnline: boolean }>;
      }>(r)
    ),
  getQrCode: () =>
    fetch('/api/public/qr').then((r) => handleJson<{ joinUrl: string; dataUrl: string }>(r)),
};

// ============================================================================
// PLAYER PORTAL API (SEPARATE FROM ADMIN)
// ============================================================================
function playerHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getPlayerAuthToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

export const playerApi = {
  me: () =>
    fetch('/api/player/me', {
      credentials: 'include',
      headers: playerHeaders(),
    }).then((r) => handleJson<{ authenticated: boolean; state?: PlayerSessionState }>(r)),
  joinWithPlayerXcode: async (playerXcode: string, teamName: string) => {
    const res = await fetch('/api/player/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mode: 'PLAYER_XCODE', playerXcode, teamName }),
    }).then((r) =>
      handleJson<{ authenticated: boolean; token?: string; state: PlayerSessionState }>(r)
    );
    if (res.token) setStoredToken(PLAYER_TOKEN_KEY, res.token);
    return res;
  },
  joinWithTeamXcode: async (teamXcode: string) => {
    const res = await fetch('/api/player/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mode: 'TEAM_XCODE', teamXcode }),
    }).then((r) =>
      handleJson<{ authenticated: boolean; token?: string; state: PlayerSessionState }>(r)
    );
    if (res.token) setStoredToken(PLAYER_TOKEN_KEY, res.token);
    return res;
  },
  logout: async () => {
    const headers = playerHeaders();
    setStoredToken(PLAYER_TOKEN_KEY, '');
    return fetch('/api/player/logout', {
      method: 'POST',
      credentials: 'include',
      headers,
    }).then((r) => handleJson<{ ok: boolean }>(r));
  },
  contribute: (amount: number) =>
    fetch('/api/player/contribute', {
      method: 'POST',
      headers: playerHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ amount }),
    }).then((r) =>
      handleJson<{ amount: number; roundNo: number; allSubmitted: boolean; state: PlayerSessionState }>(r)
    ),
};

// ============================================================================
// ADMIN PORTAL API (PASSWORD-ONLY ACCESS WITH IFRAME-SAFE BEARER TOKEN)
// ============================================================================
let adminCsrfToken = '';

export function setAdminCsrf(token: string) {
  adminCsrfToken = token;
}

function adminHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAdminAuthToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(adminCsrfToken ? { 'x-csrf-token': adminCsrfToken } : {}),
    ...(extra || {}),
  };
}

function adminPost<T>(url: string, body?: unknown): Promise<T> {
  return fetch(url, {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: body ? JSON.stringify(body) : '{}',
  }).then((r) => handleJson<T>(r));
}

export const adminApi = {
  me: async () => {
    const res = await fetch('/api/admin/me', {
      credentials: 'include',
      headers: adminHeaders(),
    }).then((r) =>
      handleJson<{ authenticated: boolean; csrf?: string; state?: AdminSessionState }>(r)
    );
    if (res.csrf) adminCsrfToken = res.csrf;
    return res;
  },
  login: async (password: string) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    }).then((r) =>
      handleJson<{ authenticated: boolean; token?: string; csrf: string; state: AdminSessionState }>(r)
    );
    if (res.token) setStoredToken(ADMIN_TOKEN_KEY, res.token);
    adminCsrfToken = res.csrf;
    return res;
  },
  logout: async () => {
    adminCsrfToken = '';
    setStoredToken(ADMIN_TOKEN_KEY, '');
    return fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    );
  },
  configure: (payload: {
    title?: string;
    playerXcode?: string;
    newAdminXcode?: string;
    teamNames: string[];
    config: Partial<GameConfig>;
  }) => adminPost<{ state: AdminSessionState }>('/api/admin/configure', payload),
  startGame: () => adminPost<{ state: AdminSessionState }>('/api/admin/start'),
  nextRound: () => adminPost<{ state: AdminSessionState }>('/api/admin/next-round'),
  closeRound: () => adminPost<{ state: AdminSessionState }>('/api/admin/close-round'),
  revealRound: () => adminPost<{ state: AdminSessionState }>('/api/admin/reveal'),
  togglePause: () => adminPost<{ state: AdminSessionState }>('/api/admin/pause'),
  adjustWallet: (teamId: number, delta: number, note: string, confirmText: string) =>
    adminPost<{ state: AdminSessionState }>('/api/admin/adjust-wallet', {
      teamId,
      delta,
      note,
      confirmText,
    }),
  rotateTeamXcode: (teamId: number) =>
    adminPost<{ joinCode: string; state: AdminSessionState }>('/api/admin/rotate-team-xcode', {
      teamId,
    }),
  endGame: () => adminPost<{ state: AdminSessionState }>('/api/admin/end'),
  resetSession: (confirmText: string, password: string) =>
    adminPost<{ state: AdminSessionState }>('/api/admin/reset', { confirmText, password }),
};
