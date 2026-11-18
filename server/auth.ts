import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';

const SECRET_FILE = path.resolve(process.cwd(), 'data', '.secret');

function loadOrCreateSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  if (fs.existsSync(SECRET_FILE)) {
    const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  return generated;
}

const HMAC_SECRET = loadOrCreateSecret();

export const DEFAULT_ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || process.env.ADMIN_XCODE || 'FORGE-ADMIN-2026';
export const DEFAULT_ADMIN_XCODE = DEFAULT_ADMIN_PASSWORD;

export function hashXcode(secret: string): string {
  return bcrypt.hashSync(secret.trim(), 10);
}

export function verifyXcode(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain.trim(), hash);
}

export interface AdminTokenPayload {
  role: 'admin';
  sessionId: number;
  csrf: string;
  iat: number;
}

export interface PlayerTokenPayload {
  role: 'team';
  sessionId: number;
  teamId: number;
  tokenVersion: number;
  iat: number;
}

export function signPayload(payload: AdminTokenPayload | PlayerTokenPayload): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

export function verifySignedToken<T extends AdminTokenPayload | PlayerTokenPayload>(
  token: string | undefined
): T | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', HMAC_SECRET).update(b64).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    return parsed as T;
  } catch {
    return null;
  }
}

export const ADMIN_COOKIE = 'pp_admin_session';
export const PLAYER_COOKIE = 'pp_player_session';

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = decodeURIComponent(part.slice(0, idx).trim());
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

function cookieOptions(req?: Request) {
  const isHttps =
    Boolean(req?.secure) || req?.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 1000 * 60 * 60 * 12,
  };
}

export function issueAdminCookie(
  res: Response,
  sessionId: number,
  req?: Request
): { token: string; csrf: string } {
  const csrf = crypto.randomBytes(16).toString('hex');
  const token = signPayload({
    role: 'admin',
    sessionId,
    csrf,
    iat: Date.now(),
  });
  res.cookie(ADMIN_COOKIE, token, cookieOptions(req));
  return { token, csrf };
}

export function issuePlayerCookie(
  res: Response,
  sessionId: number,
  teamId: number,
  tokenVersion: number,
  req?: Request
): string {
  const token = signPayload({
    role: 'team',
    sessionId,
    teamId,
    tokenVersion,
    iat: Date.now(),
  });
  res.cookie(PLAYER_COOKIE, token, cookieOptions(req));
  return token;
}

export function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

export function getAdminAuthFromTokenOrCookies(
  token: string | undefined,
  cookies: Record<string, string> | undefined
): AdminTokenPayload | null {
  if (token) {
    const parsed = verifySignedToken<AdminTokenPayload>(token);
    if (parsed && parsed.role === 'admin') return parsed;
  }
  if (cookies) {
    const parsed = verifySignedToken<AdminTokenPayload>(cookies[ADMIN_COOKIE]);
    if (parsed && parsed.role === 'admin') return parsed;
  }
  return null;
}

export function getPlayerAuthFromTokenOrCookies(
  token: string | undefined,
  cookies: Record<string, string> | undefined
): PlayerTokenPayload | null {
  const candidate = token || (cookies ? cookies[PLAYER_COOKIE] : undefined);
  if (!candidate) return null;
  const parsed = verifySignedToken<PlayerTokenPayload>(candidate);
  if (!parsed || parsed.role !== 'team') return null;

  // Verify token_version against DB to enforce single-device / token rotation
  const row = db
    .prepare('SELECT id, session_id, token_version FROM teams WHERE id = ? AND session_id = ?')
    .get(parsed.teamId, parsed.sessionId) as
    | { id: number; session_id: number; token_version: number }
    | undefined;
  if (!row || row.token_version !== parsed.tokenVersion) {
    return null;
  }
  return parsed;
}

export function verifyAdminPassword(plainPassword: string): { valid: boolean; sessionId: number } {
  const row = db
    .prepare('SELECT id, player_xcode, admin_xcode_hash FROM sessions ORDER BY id DESC LIMIT 1')
    .get() as { id: number; player_xcode: string; admin_xcode_hash: string } | undefined;
  if (!row) {
    return { valid: plainPassword.trim() === DEFAULT_ADMIN_PASSWORD, sessionId: 1 };
  }
  if (plainPassword.trim().toUpperCase() === row.player_xcode.trim().toUpperCase()) {
    return { valid: false, sessionId: row.id };
  }
  const valid =
    verifyXcode(plainPassword, row.admin_xcode_hash) ||
    plainPassword.trim() === DEFAULT_ADMIN_PASSWORD;
  return { valid, sessionId: row.id };
}

export interface AuthedRequest extends Request {
  adminAuth?: AdminTokenPayload;
  playerAuth?: PlayerTokenPayload;
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const bearer = extractBearerToken(req);
  const auth = getAdminAuthFromTokenOrCookies(bearer, req.cookies);
  if (auth) {
    req.adminAuth = auth;
    next();
    return;
  }

  // Direct password header fallback for password-only admin access
  const headerPassword = req.headers['x-admin-password'];
  if (typeof headerPassword === 'string' && headerPassword.trim()) {
    const check = verifyAdminPassword(headerPassword);
    if (check.valid) {
      req.adminAuth = {
        role: 'admin',
        sessionId: check.sessionId,
        csrf: 'password-header',
        iat: Date.now(),
      };
      next();
      return;
    }
  }

  res.status(401).json({
    error: 'UNAUTHORIZED_ADMIN',
    message: 'Admin password required. Please unlock the Admin Console.',
  });
}

export function requirePlayer(req: AuthedRequest, res: Response, next: NextFunction): void {
  const bearer = extractBearerToken(req);
  const auth = getPlayerAuthFromTokenOrCookies(bearer, req.cookies);
  if (!auth) {
    res.status(401).json({
      error: 'UNAUTHORIZED_PLAYER',
      message: 'Player XCode authentication required.',
    });
    return;
  }
  req.playerAuth = auth;
  next();
}

export function generateShortCode(prefix: string, len = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `${prefix}-${suffix}`;
}
