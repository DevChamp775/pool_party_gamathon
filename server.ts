import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import QRCode from 'qrcode';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';
import {
  ADMIN_COOKIE,
  DEFAULT_ADMIN_PASSWORD,
  PLAYER_COOKIE,
  extractBearerToken,
  getAdminAuthFromTokenOrCookies,
  getPlayerAuthFromTokenOrCookies,
  issueAdminCookie,
  issuePlayerCookie,
  parseCookieHeader,
  requireAdmin,
  requirePlayer,
  verifyAdminPassword,
  verifyXcode,
} from './server/auth.ts';
import type { AuthedRequest } from './server/auth.ts';
import {
  adjustTeamWallet,
  closeCurrentRound,
  configureSession,
  endGame,
  ensureActiveSession,
  exportSessionCsv,
  getActiveSession,
  getAdminSessionState,
  getPlayerSessionState,
  getPublicGameState,
  joinTeamByTeamXcode,
  joinWithPlayerXcode,
  pauseOrResumeGame,
  regenerateTeamXcode,
  registerWsHooks,
  resetSessionToLobby,
  revealAndSettleRound,
  startGame,
  startNextRound,
  startRoundTicker,
  submitContribution,
  setTeamOnlineStatus,
} from './server/gameService.ts';

interface WsClientMeta {
  ws: WebSocket;
  role: 'admin' | 'team' | 'display';
  sessionId: number;
  teamId?: number;
}

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

async function bootstrap() {
  ensureActiveSession();

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Explicitly serve /assets so uploaded poster and static assets resolve cleanly
  app.use('/assets', express.static(path.resolve(process.cwd(), 'public/assets')));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WsClientMeta>();

  function countClients(sessionId: number) {
    let total = 0;
    let teams = 0;
    let displays = 0;
    let admins = 0;
    for (const c of clients) {
      if (c.ws.readyState === WebSocket.OPEN) {
        total++;
        if (c.role === 'team') teams++;
        else if (c.role === 'display') displays++;
        else if (c.role === 'admin') admins++;
      }
    }
    return { total, teams, displays, admins };
  }

  function broadcastEvent(sessionId: number, event: string, extra: Record<string, unknown> = {}) {
    const active = getActiveSession();
    const targetSessionId = active.id;
    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      try {
        let payloadState: unknown;
        if (client.role === 'admin') {
          payloadState = getAdminSessionState(targetSessionId);
        } else if (client.role === 'team' && client.teamId) {
          try {
            payloadState = getPlayerSessionState(targetSessionId, client.teamId);
          } catch {
            // Session was reset or team replaced
            client.ws.send(JSON.stringify({ type: 'session_reset' }));
            continue;
          }
        } else {
          payloadState = getPublicGameState(targetSessionId);
        }
        client.ws.send(
          JSON.stringify({
            type: 'event',
            event,
            extra,
            state: payloadState,
          })
        );
      } catch (err) {
        console.error('WS broadcast error:', err);
      }
    }
  }

  registerWsHooks(broadcastEvent, countClients);

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== '/ws') {
      return;
    }

    const channel = url.searchParams.get('channel') || 'display';
    const wsToken = url.searchParams.get('token') || undefined;
    const cookies = parseCookieHeader(req.headers.cookie);

    let role: 'admin' | 'team' | 'display' = 'display';
    let sessionId = getActiveSession().id;
    let teamId: number | undefined;

    if (channel === 'admin') {
      const adminAuth = getAdminAuthFromTokenOrCookies(wsToken, cookies);
      if (!adminAuth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      role = 'admin';
      sessionId = getActiveSession().id;
    } else if (channel === 'team') {
      const playerAuth = getPlayerAuthFromTokenOrCookies(wsToken, cookies);
      if (!playerAuth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      role = 'team';
      sessionId = playerAuth.sessionId;
      teamId = playerAuth.teamId;
    } else {
      role = 'display';
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const meta: WsClientMeta = { ws, role, sessionId, teamId };
      clients.add(meta);

      try {
        const initState =
          role === 'admin'
            ? getAdminSessionState(getActiveSession().id)
            : role === 'team' && teamId
            ? getPlayerSessionState(sessionId, teamId)
            : getPublicGameState(getActiveSession().id);
        ws.send(JSON.stringify({ type: 'init', state: initState }));
      } catch (err) {
        console.error('WS init error:', err);
      }

      if (role === 'team' && teamId) {
        setTeamOnlineStatus(teamId, true);
        broadcastEvent(sessionId, 'presence_changed', { teamId, isOnline: true });
      } else {
        broadcastEvent(sessionId, 'presence_changed');
      }

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }));
          }
        } catch {
          // ignore malformed messages
        }
      });

      ws.on('close', () => {
        clients.delete(meta);
        if (role === 'team' && teamId) {
          // Only mark offline if no other socket for same teamId
          let stillConnected = false;
          for (const c of clients) {
            if (c.role === 'team' && c.teamId === teamId && c.ws.readyState === WebSocket.OPEN) {
              stillConnected = true;
              break;
            }
          }
          if (!stillConnected) {
            setTeamOnlineStatus(teamId, false);
            broadcastEvent(sessionId, 'presence_changed', { teamId, isOnline: false });
          }
        }
      });
    });
  });

  // =========================================================================
  // PUBLIC & DISPLAY ROUTES (NO SECRETS, NO ADMIN DATA)
  // =========================================================================
  app.get('/api/public/state', (_req, res) => {
    try {
      const state = getPublicGameState();
      res.json(state);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/public/teams-lobby', (_req, res) => {
    try {
      const session = getActiveSession();
      const rows = db
        .prepare('SELECT id, name, avatar_id AS avatarId, is_online AS isOnline FROM teams WHERE session_id = ? ORDER BY id ASC')
        .all(session.id) as Array<{ id: number; name: string; avatarId: number; isOnline: number }>;
      res.json({
        sessionCode: session.session_code,
        status: session.status,
        teams: rows.map((r) => ({ ...r, isOnline: Boolean(r.isOnline) })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/public/qr', async (req, res) => {
    try {
      const baseUrl =
        process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
          ? process.env.APP_URL
          : `${req.protocol}://${req.get('host')}`;
      const joinUrl = `${baseUrl.replace(/\/$/, '')}/join`;
      const dataUrl = await QRCode.toDataURL(joinUrl, {
        width: 240,
        margin: 1,
        color: { dark: '#0B131B', light: '#FFD60A' },
      });
      res.json({ joinUrl, dataUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/public/export.csv', (_req, res) => {
    try {
      const session = getActiveSession();
      const csv = exportSessionCsv(session.id);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pool-party-${session.session_code}.csv"`);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // PLAYER AUTH & GAMEPLAY ROUTES (SEPARATE XCODES & COOKIE)
  // =========================================================================
  app.get('/api/player/me', (req, res) => {
    const auth = getPlayerAuthFromTokenOrCookies(extractBearerToken(req), req.cookies);
    if (!auth) {
      res.json({ authenticated: false });
      return;
    }
    try {
      const state = getPlayerSessionState(auth.sessionId, auth.teamId);
      res.json({ authenticated: true, state });
    } catch {
      res.clearCookie(PLAYER_COOKIE);
      res.json({ authenticated: false });
    }
  });

  app.post('/api/player/join', (req, res) => {
    try {
      const { mode, playerXcode, teamName, teamXcode } = req.body || {};
      let result: { sessionId: number; teamId: number; tokenVersion: number };

      if (mode === 'TEAM_XCODE') {
        if (typeof teamXcode !== 'string' || !teamXcode.trim()) {
          res.status(400).json({ error: 'MISSING_XCODE', message: 'Enter your Team XCode.' });
          return;
        }
        result = joinTeamByTeamXcode(teamXcode);
      } else {
        if (typeof playerXcode !== 'string' || !playerXcode.trim()) {
          res.status(400).json({ error: 'MISSING_XCODE', message: 'Enter the Player XCode.' });
          return;
        }
        if (typeof teamName !== 'string' || !teamName.trim()) {
          res.status(400).json({ error: 'MISSING_TEAM', message: 'Enter or select your Team Name.' });
          return;
        }
        result = joinWithPlayerXcode({ playerXcode, teamName });
      }

      const token = issuePlayerCookie(
        res,
        result.sessionId,
        result.teamId,
        result.tokenVersion,
        req
      );
      setTeamOnlineStatus(result.teamId, true);
      broadcastEvent(result.sessionId, 'player_joined', { teamId: result.teamId });

      const state = getPlayerSessionState(result.sessionId, result.teamId);
      res.json({ authenticated: true, token, state });
    } catch (err: any) {
      const code = err.message;
      const messages: Record<string, string> = {
        INVALID_PLAYER_XCODE: 'Invalid Player XCode. Ask the organizer for the Player XCode.',
        INVALID_TEAM_XCODE: 'Team XCode not found. Check the code and try again.',
        INVALID_TEAM_NAME: 'Team name must be 1–30 characters.',
        REGISTRATION_CLOSED: 'Game has already started. Select an existing team or use your Team XCode.',
        MAX_TEAMS_REACHED: 'Maximum of 40 teams reached.',
      };
      res.status(400).json({
        error: code,
        message: messages[code] || 'Could not join game.',
      });
    }
  });

  app.post('/api/player/logout', (req, res) => {
    const auth = getPlayerAuthFromTokenOrCookies(extractBearerToken(req), req.cookies);
    if (auth) {
      setTeamOnlineStatus(auth.teamId, false);
      broadcastEvent(auth.sessionId, 'presence_changed', { teamId: auth.teamId, isOnline: false });
    }
    res.clearCookie(PLAYER_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.post('/api/player/contribute', requirePlayer, (req: AuthedRequest, res) => {
    try {
      const auth = req.playerAuth!;
      const active = getActiveSession();
      if (auth.sessionId !== active.id) {
        res.status(409).json({ error: 'SESSION_STALE', message: 'Session was reset. Please re-join.' });
        return;
      }
      const result = submitContribution({
        sessionId: auth.sessionId,
        teamId: auth.teamId,
        rawAmount: req.body?.amount,
      });
      const state = getPlayerSessionState(auth.sessionId, auth.teamId);
      res.json({ ...result, state });
    } catch (err: any) {
      res.status(400).json({
        error: err.code || 'CONTRIBUTION_FAILED',
        message: err.message || 'Could not lock donation.',
      });
    }
  });

  // =========================================================================
  // ADMIN PASSWORD & COMMAND CENTER ROUTES
  // =========================================================================
  app.get('/api/admin/me', (req, res) => {
    const auth = getAdminAuthFromTokenOrCookies(extractBearerToken(req), req.cookies);
    if (!auth) {
      res.json({ authenticated: false });
      return;
    }
    const active = getActiveSession();
    res.json({
      authenticated: true,
      csrf: auth.csrf,
      state: getAdminSessionState(active.id),
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const rawPassword = req.body?.password ?? req.body?.adminPassword ?? req.body?.adminXcode;
    if (typeof rawPassword !== 'string' || !rawPassword.trim()) {
      res.status(400).json({ error: 'MISSING_PASSWORD', message: 'Enter the Admin Password.' });
      return;
    }

    const session = getActiveSession();
    if (rawPassword.trim().toUpperCase() === session.player_xcode.trim().toUpperCase()) {
      res.status(403).json({
        error: 'WRONG_PORTAL_CODE',
        message: 'That is the Player XCode. Admin access requires the Admin Password.',
      });
      return;
    }

    const check = verifyAdminPassword(rawPassword);
    if (!check.valid) {
      res.status(401).json({ error: 'INVALID_ADMIN_PASSWORD', message: 'Incorrect Admin Password.' });
      return;
    }

    const { token, csrf } = issueAdminCookie(res, session.id, req);
    res.json({
      authenticated: true,
      token,
      csrf,
      state: getAdminSessionState(session.id),
    });
  });

  app.post('/api/admin/logout', (_req, res) => {
    res.clearCookie(ADMIN_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.post('/api/admin/configure', requireAdmin, (req: AuthedRequest, res) => {
    try {
      const active = getActiveSession();
      configureSession({
        sessionId: active.id,
        title: req.body?.title,
        playerXcode: req.body?.playerXcode,
        newAdminXcode: req.body?.newAdminXcode,
        teamNames: Array.isArray(req.body?.teamNames) ? req.body.teamNames : [],
        config: req.body?.config || {},
      });
      res.json({ state: getAdminSessionState(active.id) });
    } catch (err: any) {
      res.status(400).json({ error: 'CONFIG_ERROR', message: err.message });
    }
  });

  app.post('/api/admin/start', requireAdmin, (_req, res) => {
    try {
      const active = getActiveSession();
      startGame(active.id);
      res.json({ state: getAdminSessionState(active.id) });
    } catch (err: any) {
      res.status(400).json({ error: 'START_ERROR', message: err.message });
    }
  });

  app.post('/api/admin/next-round', requireAdmin, (_req, res) => {
    try {
      const active = getActiveSession();
      startNextRound(active.id);
      res.json({ state: getAdminSessionState(active.id) });
    } catch (err: any) {
      res.status(400).json({ error: 'NEXT_ROUND_ERROR', message: err.message });
    }
  });

  app.post('/api/admin/close-round', requireAdmin, (_req, res) => {
    try {
      const active = getActiveSession();
      closeCurrentRound(active.id, 'ADMIN');
      res.json({ state: getAdminSessionState(active.id) });
    } catch (err: any) {
      res.status(400).json({ error: 'CLOSE_ROUND_ERROR', message: err.message });
    }
  });

  app.post('/api/admin/reveal', requireAdmin, (_req, res) => {
    try {
      const active = getActiveSession();
      revealAndSettleRound(active.id, 'ADMIN');
      res.json({ state: getAdminSessionState(active.id) });
    } catch (err: any) {
      res.status(400).json({ error: 'REVEAL_ERROR', message: err.message });
    }
  });

  app.post('/api/admin/pause', requireAdmin, (_req, res) => {
    try {
      const active = getActiveSession();
      pauseOrResumeGame(active.id);
      res.json({ state: getAdminSessionState(active.id) });
    } catch (err: any) {
      res.status(400).json({ error: 'PAUSE_ERROR', message: err.message });
    }
  });

  app.post('/api/admin/adjust-wallet', requireAdmin, (req, res) => {
    try {
      if (req.body?.confirmText !== 'ADJUST') {
        res.status(400).json({ error: 'CONFIRM_REQUIRED', message: 'Type ADJUST to confirm.' });
        return;
      }
      const active = getActiveSession();
      adjustTeamWallet({
        sessionId: active.id,
        teamId: Number(req.body.teamId),
        delta: Number(req.body.delta),
        note: String(req.body.note || ''),
      });
      res.json({ state: getAdminSessionState(active.id) });
    } catch (err: any) {
      res.status(400).json({ error: 'ADJUST_ERROR', message: err.message });
    }
  });

  app.post('/api/admin/rotate-team-xcode', requireAdmin, (req, res) => {
    try {
      const active = getActiveSession();
      const joinCode = regenerateTeamXcode(active.id, Number(req.body.teamId));
      res.json({ joinCode, state: getAdminSessionState(active.id) });
    } catch (err: any) {
      res.status(400).json({ error: 'ROTATE_ERROR', message: err.message });
    }
  });

  app.post('/api/admin/end', requireAdmin, (_req, res) => {
    try {
      const active = getActiveSession();
      endGame(active.id, 'ADMIN');
      res.json({ state: getAdminSessionState(active.id) });
    } catch (err: any) {
      res.status(400).json({ error: 'END_ERROR', message: err.message });
    }
  });

  app.post('/api/admin/reset', requireAdmin, (req, res) => {
    try {
      const confirmText = req.body?.confirmText;
      const rawPassword = req.body?.password ?? req.body?.adminPassword ?? req.body?.adminXcode;
      if (confirmText !== 'RESET') {
        res.status(400).json({ error: 'CONFIRM_REQUIRED', message: 'Type RESET to confirm.' });
        return;
      }
      const active = getActiveSession();
      const valid =
        typeof rawPassword === 'string' &&
        (verifyXcode(rawPassword, active.admin_xcode_hash) ||
          rawPassword.trim() === DEFAULT_ADMIN_PASSWORD);
      if (!valid) {
        res.status(401).json({
          error: 'INVALID_ADMIN_PASSWORD',
          message: 'Admin Password verification failed.',
        });
        return;
      }
      resetSessionToLobby(active.id);
      const next = getActiveSession();
      res.json({ state: getAdminSessionState(next.id) });
    } catch (err: any) {
      res.status(400).json({ error: 'RESET_ERROR', message: err.message });
    }
  });

  // =========================================================================
  // VITE MIDDLEWARE (DEV) OR STATIC DIST (PROD)
  // =========================================================================
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  startRoundTicker();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`POOL PARTY — Pixel Forge server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
