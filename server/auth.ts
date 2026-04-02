import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { hash as hashPassword, verify as verifyPasswordHash } from '@node-rs/argon2';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { query, withUserRls, type AppRole, type AuthenticatedUser, type DatabaseUser } from './database.ts';

type AllowedEnvUser = {
    email: string;
    password: string;
    role: AppRole;
    emailKey: string;
    passwordKey: string;
};

type SessionUserRow = {
    session_id: string;
    session_expires_at: Date;
    user_id: string;
    email: string;
    role: AppRole;
    must_change_password: boolean;
    created_at: Date;
};

type UserRow = {
    id: string;
    email: string;
    password_hash: string;
    role: AppRole;
    must_change_password: boolean;
    created_at: Date;
    updated_at: Date;
};

type LearningStateRow = {
    data: Record<string, unknown> | null;
};

type RateLimitState = {
    count: number;
    firstAttemptAt: number;
    blockedUntil: number;
};

type LoginSuccess = {
    user: AuthenticatedUser;
    sessionToken: string;
    expiresAt: Date;
};

declare global {
    namespace Express {
        interface Request {
            authUser?: AuthenticatedUser | null;
            authSessionId?: string | null;
            authSessionExpiresAt?: string | null;
        }
    }
}

const SESSION_COOKIE_NAME = 'ctia03_session';
const SESSION_TTL_MS = 1000 * 60 * 30;
const SESSION_WARNING_MS = 1000 * 60 * 5;
const LOGIN_WINDOW_MS = 1000 * 60 * 10;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 1000 * 60 * 15;
const MAX_STATE_BYTES = 64 * 1024;

const loginRateLimit = new Map<string, RateLimitState>();

const ARGON_OPTIONS = {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 3,
    outputLen: 32,
    parallelism: 1,
} as const;

function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (Array.isArray(forwardedFor) && forwardedFor[0]) {
        return forwardedFor[0];
    }

    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0]?.trim() || req.ip;
    }

    return req.ip || 'unknown';
}

function safeStringEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
}

function buildSessionExpiryDate(): Date {
    return new Date(Date.now() + SESSION_TTL_MS);
}

function parseExpiresAt(value: string | Date | null | undefined): Date | null {
    if (!value) {
        return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getSessionTtlMs(): number {
    return SESSION_TTL_MS;
}

export function getSessionWarningMs(): number {
    return SESSION_WARNING_MS;
}

export function getSessionTtlSeconds(): number {
    return Math.floor(SESSION_TTL_MS / 1000);
}

export function getSessionWarningSeconds(): number {
    return Math.floor(SESSION_WARNING_MS / 1000);
}

export function getExpiresInSeconds(expiresAt: string | Date | null | undefined): number {
    const parsed = parseExpiresAt(expiresAt);
    if (!parsed) {
        return 0;
    }

    return Math.max(0, Math.ceil((parsed.getTime() - Date.now()) / 1000));
}

function hashSessionToken(token: string): string {
    const secret = process.env.SESSION_SECRET?.trim() || 'missing-session-secret';
    return createHmac('sha256', secret).update(token).digest('hex');
}

function mapUserRow(row: UserRow): DatabaseUser {
    return {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        mustChangePassword: row.must_change_password,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

function toAuthenticatedUser(user: DatabaseUser): AuthenticatedUser {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt,
    };
}

function getAllowedEnvUsers() {
    const entries: AllowedEnvUser[] = [];
    const missing: string[] = [];
    const invalid: string[] = [];
    const seenEmails = new Set<string>();

    [
        { emailKey: 'APP_OWNER_EMAIL', passwordKey: 'APP_OWNER_PASSWORD', role: 'owner' as const },
        { emailKey: 'APP_MEMBER_EMAIL', passwordKey: 'APP_MEMBER_PASSWORD', role: 'member' as const },
    ].forEach(({ emailKey, passwordKey, role }) => {
        const rawEmail = process.env[emailKey]?.trim() || '';
        const rawPassword = process.env[passwordKey] || '';

        if (!rawEmail) missing.push(emailKey);
        if (!rawPassword) missing.push(passwordKey);

        if (!rawEmail || !rawPassword) {
            return;
        }

        const email = normalizeEmail(rawEmail);

        if (!isValidEmail(email) || seenEmails.has(email)) {
            invalid.push(emailKey);
            return;
        }

        seenEmails.add(email);
        entries.push({ email, password: rawPassword, role, emailKey, passwordKey });
    });

    return {
        ready: missing.length === 0 && invalid.length === 0,
        entries,
        missing,
        invalid,
    };
}

export function getAuthConfigStatus() {
    const envStatus = getAllowedEnvUsers();
    const sessionSecret = process.env.SESSION_SECRET?.trim() || '';
    const missing = [...envStatus.missing];

    if (!sessionSecret) {
        missing.push('SESSION_SECRET');
    }

    return {
        ready: envStatus.ready && Boolean(sessionSecret),
        missing,
        invalid: envStatus.invalid,
        envVarNames: [
            'APP_OWNER_EMAIL',
            'APP_OWNER_PASSWORD',
            'APP_MEMBER_EMAIL',
            'APP_MEMBER_PASSWORD',
            'DATABASE_URL',
            'SESSION_SECRET',
        ],
    };
}

export function getAuthCookieName(): string {
    return SESSION_COOKIE_NAME;
}

export function getSessionSecretStatus() {
    return {
        envVar: 'SESSION_SECRET',
        configured: Boolean(process.env.SESSION_SECRET?.trim()),
    };
}

async function findUserByEmail(email: string): Promise<DatabaseUser | null> {
    const result = await query<UserRow>(
        `
            SELECT id, email, password_hash, role, must_change_password, created_at, updated_at
            FROM app_users
            WHERE email = $1
            LIMIT 1
        `,
        [email],
    );

    if (!result.rowCount) {
        return null;
    }

    return mapUserRow(result.rows[0]);
}

async function updateUserRole(id: string, role: AppRole): Promise<void> {
    await query(
        `
            UPDATE app_users
            SET role = $2, updated_at = NOW()
            WHERE id = $1
        `,
        [id, role],
    );
}

async function ensureLearningStateRow(userId: string, initialState: Record<string, unknown> = {}): Promise<void> {
    await query(
        `
            INSERT INTO user_learning_state (owner_user_id, data, created_at, updated_at)
            VALUES ($1, $2::jsonb, NOW(), NOW())
            ON CONFLICT (owner_user_id) DO NOTHING
        `,
        [userId, JSON.stringify(initialState)],
    );
}

async function createUserFromSeed(seedUser: AllowedEnvUser, password: string): Promise<DatabaseUser> {
    const id = randomUUID();
    const passwordHash = await hashPassword(password, ARGON_OPTIONS);

    const result = await query<UserRow>(
        `
            INSERT INTO app_users (id, email, password_hash, role, must_change_password, created_at, updated_at)
            VALUES ($1, $2, $3, $4, FALSE, NOW(), NOW())
            RETURNING id, email, password_hash, role, must_change_password, created_at, updated_at
        `,
        [id, seedUser.email, passwordHash, seedUser.role],
    );

    await ensureLearningStateRow(id, { completedQuizzes: [], lastSimuladoScore: null });
    return mapUserRow(result.rows[0]);
}

function getRateLimitKey(req: Request, email: string): string {
    return `${getClientIp(req)}::${normalizeEmail(email)}`;
}

function cleanupRateLimit(now: number): void {
    for (const [key, value] of loginRateLimit.entries()) {
        const expired = value.blockedUntil < now && value.firstAttemptAt + LOGIN_WINDOW_MS < now;
        if (expired) {
            loginRateLimit.delete(key);
        }
    }
}

function checkRateLimit(req: Request, email: string) {
    const now = Date.now();
    cleanupRateLimit(now);
    const key = getRateLimitKey(req, email);
    const entry = loginRateLimit.get(key);

    if (!entry) {
        return { allowed: true, retryAfterSeconds: 0, key };
    }

    if (entry.blockedUntil > now) {
        return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)),
            key,
        };
    }

    if (entry.firstAttemptAt + LOGIN_WINDOW_MS < now) {
        loginRateLimit.delete(key);
        return { allowed: true, retryAfterSeconds: 0, key };
    }

    return { allowed: true, retryAfterSeconds: 0, key };
}

function registerFailedLogin(rateKey: string): { blockedUntil: number; attempts: number } {
    const now = Date.now();
    const entry = loginRateLimit.get(rateKey);

    if (!entry || entry.firstAttemptAt + LOGIN_WINDOW_MS < now) {
        const nextEntry: RateLimitState = { count: 1, firstAttemptAt: now, blockedUntil: 0 };
        loginRateLimit.set(rateKey, nextEntry);
        return { blockedUntil: 0, attempts: 1 };
    }

    entry.count += 1;
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
        entry.blockedUntil = now + LOGIN_BLOCK_MS;
    }

    loginRateLimit.set(rateKey, entry);
    return { blockedUntil: entry.blockedUntil, attempts: entry.count };
}

function clearLoginFailures(rateKey: string): void {
    loginRateLimit.delete(rateKey);
}

async function createSession(user: AuthenticatedUser, req: Request): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashSessionToken(token);
    const expiresAt = buildSessionExpiryDate();

    await query(
        `
            INSERT INTO app_sessions (id, user_id, session_token_hash, created_at, last_seen_at, expires_at, ip_address, user_agent)
            VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6)
        `,
        [randomUUID(), user.id, tokenHash, expiresAt.toISOString(), getClientIp(req), req.headers['user-agent'] || null],
    );

    return { token, expiresAt };
}

export async function refreshRequestSession(req: Request): Promise<Date | null> {
    const sessionId = req.authSessionId;
    if (!sessionId) {
        return null;
    }

    const expiresAt = buildSessionExpiryDate();
    const result = await query<{ expires_at: Date }>(
        `
            UPDATE app_sessions
            SET
                last_seen_at = NOW(),
                expires_at = $2,
                ip_address = $3,
                user_agent = $4
            WHERE id = $1
              AND expires_at > NOW()
            RETURNING expires_at
        `,
        [sessionId, expiresAt.toISOString(), getClientIp(req), req.headers['user-agent'] || null],
    );

    if (!result.rowCount) {
        req.authSessionExpiresAt = null;
        return null;
    }

    const nextExpiresAt = parseExpiresAt(result.rows[0]?.expires_at) || expiresAt;
    req.authSessionExpiresAt = nextExpiresAt.toISOString();
    return nextExpiresAt;
}

function getCookieOptions(req: Request, expiresAt: Date) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isSecureRequest = req.secure || forwardedProto === 'https' || process.env.NODE_ENV === 'production';

    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: isSecureRequest,
        path: '/',
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
        expires: expiresAt,
    };
}

export function setSessionCookie(res: Response, req: Request, token: string, expiresAt: Date): void {
    res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, token, getCookieOptions(req, expiresAt)));
}

export function clearSessionCookie(res: Response, req: Request): void {
    res.setHeader(
        'Set-Cookie',
        serializeCookie(SESSION_COOKIE_NAME, '', {
            ...getCookieOptions(req, new Date(0)),
            expires: new Date(0),
            maxAge: 0,
        }),
    );
}

export function readSessionTokenFromRequest(req: Request): string | null {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
        return null;
    }

    const cookies = parseCookie(cookieHeader);
    const token = cookies[SESSION_COOKIE_NAME];
    return token && token.trim() ? token.trim() : null;
}

async function findUserBySessionToken(
    token: string,
): Promise<(AuthenticatedUser & { sessionId: string; sessionExpiresAt: string }) | null> {
    const result = await query<SessionUserRow>(
        `
            SELECT
                s.id AS session_id,
                s.expires_at AS session_expires_at,
                u.id AS user_id,
                u.email,
                u.role,
                u.must_change_password,
                u.created_at
            FROM app_sessions s
            INNER JOIN app_users u ON u.id = s.user_id
            WHERE s.session_token_hash = $1
              AND s.expires_at > NOW()
            LIMIT 1
        `,
        [hashSessionToken(token)],
    );

    if (!result.rowCount) {
        return null;
    }

    const row = result.rows[0];

    await query(
        `
            UPDATE app_sessions
            SET last_seen_at = NOW()
            WHERE id = $1
        `,
        [row.session_id],
    );

    return {
        id: row.user_id,
        email: row.email,
        role: row.role,
        mustChangePassword: row.must_change_password,
        createdAt: row.created_at.toISOString(),
        sessionId: row.session_id,
        sessionExpiresAt: row.session_expires_at.toISOString(),
    };
}

export async function destroySessionByToken(token: string | null): Promise<void> {
    if (!token) {
        return;
    }

    await query(
        `
            DELETE FROM app_sessions
            WHERE session_token_hash = $1
        `,
        [hashSessionToken(token)],
    );
}

export async function destroyExpiredSessions(): Promise<void> {
    await query('DELETE FROM app_sessions WHERE expires_at <= NOW()');
}

export async function authenticateLogin(email: string, password: string, req: Request): Promise<LoginSuccess | null> {
    const normalizedEmail = normalizeEmail(email);
    const rate = checkRateLimit(req, normalizedEmail);

    if (!rate.allowed) {
        const error = new Error('Too many login attempts.');
        Object.assign(error, {
            statusCode: 429,
            retryAfterSeconds: rate.retryAfterSeconds,
        });
        throw error;
    }

    const allowedUsers = getAllowedEnvUsers();
    const envUser = allowedUsers.entries.find((entry) => entry.email === normalizedEmail);

    if (!envUser) {
        registerFailedLogin(rate.key);
        return null;
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    if (!existingUser) {
        if (!safeStringEquals(envUser.password, password)) {
            registerFailedLogin(rate.key);
            return null;
        }

        const createdUser = await createUserFromSeed(envUser, password);
        const authUser = toAuthenticatedUser(createdUser);
        const session = await createSession(authUser, req);
        clearLoginFailures(rate.key);

        return {
            user: authUser,
            sessionToken: session.token,
            expiresAt: session.expiresAt,
        };
    }

    const passwordValid = await verifyPasswordHash(existingUser.passwordHash, password, ARGON_OPTIONS);
    if (!passwordValid) {
        registerFailedLogin(rate.key);
        return null;
    }

    if (existingUser.role !== envUser.role) {
        await updateUserRole(existingUser.id, envUser.role);
        existingUser.role = envUser.role;
    }

    await ensureLearningStateRow(existingUser.id, { completedQuizzes: [], lastSimuladoScore: null });

    const authUser = toAuthenticatedUser(existingUser);
    const session = await createSession(authUser, req);
    clearLoginFailures(rate.key);

    return {
        user: authUser,
        sessionToken: session.token,
        expiresAt: session.expiresAt,
    };
}

export async function resolveRequestAuth(req: Request): Promise<AuthenticatedUser | null> {
    if (req.authUser !== undefined) {
        return req.authUser;
    }

    const token = readSessionTokenFromRequest(req);
    if (!token) {
        req.authUser = null;
        req.authSessionId = null;
        req.authSessionExpiresAt = null;
        return null;
    }

    const user = await findUserBySessionToken(token);
    if (!user) {
        req.authUser = null;
        req.authSessionId = null;
        req.authSessionExpiresAt = null;
        return null;
    }

    req.authUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt,
    };
    req.authSessionId = user.sessionId;
    req.authSessionExpiresAt = user.sessionExpiresAt;
    return req.authUser;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = await resolveRequestAuth(req);
        if (!user) {
            res.status(401).json({
                ok: false,
                error: 'Authentication required.',
            });
            return;
        }

        next();
    } catch (error) {
        next(error);
    }
}

export function requireRole(...roles: AppRole[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await resolveRequestAuth(req);
            if (!user) {
                res.status(401).json({
                    ok: false,
                    error: 'Authentication required.',
                });
                return;
            }

            if (!roles.includes(user.role)) {
                res.status(403).json({
                    ok: false,
                    error: 'Forbidden.',
                });
                return;
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function getLearningState(user: AuthenticatedUser): Promise<Record<string, unknown>> {
    return withUserRls(user, async (client) => {
        const result = await client.query<LearningStateRow>(
            `
                SELECT data
                FROM user_learning_state
                WHERE owner_user_id = $1
                LIMIT 1
            `,
            [user.id],
        );

        if (!result.rowCount) {
            await client.query(
                `
                    INSERT INTO user_learning_state (owner_user_id, data, created_at, updated_at)
                    VALUES ($1, $2::jsonb, NOW(), NOW())
                    ON CONFLICT (owner_user_id) DO NOTHING
                `,
                [user.id, JSON.stringify({ completedQuizzes: [], lastSimuladoScore: null })],
            );

            return {
                completedQuizzes: [],
                lastSimuladoScore: null,
            };
        }

        return result.rows[0].data || {};
    });
}

export async function saveLearningState(user: AuthenticatedUser, state: unknown): Promise<Record<string, unknown>> {
    if (!isPlainObject(state)) {
        throw new Error('Invalid learning state payload.');
    }

    const serialized = JSON.stringify(state);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_STATE_BYTES) {
        throw new Error('Learning state payload too large.');
    }

    return withUserRls(user, async (client) => {
        await client.query(
            `
                INSERT INTO user_learning_state (owner_user_id, data, created_at, updated_at)
                VALUES ($1, $2::jsonb, NOW(), NOW())
                ON CONFLICT (owner_user_id)
                DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
            `,
            [user.id, serialized],
        );

        const result = await client.query<LearningStateRow>(
            `
                SELECT data
                FROM user_learning_state
                WHERE owner_user_id = $1
                LIMIT 1
            `,
            [user.id],
        );

        return result.rows[0]?.data || {};
    });
}

export function buildLoginPageHtml(options: { configReady: boolean; configMessage?: string; appName?: string }) {
    const appName = options.appName || 'CTIA03';
    const configBanner = options.configReady
        ? ''
        : `
            <div class="auth-alert auth-alert--warning">
                <strong>Acesso indisponivel no momento.</strong>
                <span>Tente novamente mais tarde.</span>
            </div>
        `;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${appName} - Login</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #eef4fb;
            --panel: rgba(255,255,255,0.92);
            --panel-strong: #ffffff;
            --text: #13305a;
            --muted: #5b7194;
            --line: rgba(19,48,90,0.12);
            --accent: #0d4dcf;
            --accent-soft: rgba(13,77,207,0.12);
            --danger: #b42318;
            --warning: #9a6700;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: "Manrope", system-ui, sans-serif;
            background:
                radial-gradient(circle at top left, rgba(13,77,207,0.16), transparent 32%),
                radial-gradient(circle at bottom right, rgba(255,171,36,0.15), transparent 28%),
                var(--bg);
            color: var(--text);
            padding: 24px;
        }
        .auth-shell {
            width: min(100%, 960px);
            display: grid;
            gap: 20px;
            grid-template-columns: minmax(280px, 1.1fr) minmax(320px, 0.9fr);
            align-items: stretch;
        }
        .auth-panel,
        .auth-form-card {
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 28px;
            box-shadow: 0 28px 60px rgba(26, 45, 79, 0.12);
            backdrop-filter: blur(12px);
        }
        .auth-panel {
            padding: 32px;
            display: grid;
            gap: 18px;
            align-content: start;
        }
        .auth-kicker {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            width: fit-content;
            padding: 8px 12px;
            border-radius: 999px;
            background: var(--accent-soft);
            color: var(--accent);
            font-weight: 700;
            font-size: 0.8rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        h1 { margin: 0; font-size: clamp(2rem, 4vw, 3.1rem); line-height: 1.02; }
        .auth-copy { margin: 0; color: var(--muted); font-size: 1.02rem; line-height: 1.7; }
        .auth-points { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
        .auth-points li {
            padding: 14px 16px;
            border-radius: 18px;
            background: rgba(255,255,255,0.74);
            border: 1px solid rgba(19,48,90,0.08);
            color: var(--text);
        }
        .auth-form-card { padding: 28px; display: grid; gap: 18px; align-content: start; }
        .auth-form-card h2 { margin: 0; font-size: 1.4rem; }
        .auth-form-card p { margin: 0; color: var(--muted); line-height: 1.6; }
        form { display: grid; gap: 14px; }
        label { display: grid; gap: 8px; font-weight: 600; color: var(--text); }
        input {
            width: 100%;
            border-radius: 16px;
            border: 1px solid var(--line);
            background: var(--panel-strong);
            padding: 14px 16px;
            font: inherit;
            color: var(--text);
        }
        input:focus {
            outline: 2px solid rgba(13,77,207,0.22);
            outline-offset: 2px;
            border-color: rgba(13,77,207,0.36);
        }
        button {
            border: 0;
            border-radius: 16px;
            padding: 15px 18px;
            font: inherit;
            font-weight: 700;
            background: linear-gradient(135deg, #0d4dcf, #0a67e0);
            color: white;
            cursor: pointer;
        }
        button:disabled { opacity: 0.7; cursor: wait; }
        .auth-alert {
            display: grid;
            gap: 4px;
            border-radius: 18px;
            padding: 14px 16px;
            border: 1px solid rgba(19,48,90,0.1);
            background: rgba(255,255,255,0.72);
            color: var(--text);
        }
        .auth-alert--error {
            border-color: rgba(180,35,24,0.18);
            color: var(--danger);
            background: rgba(180,35,24,0.08);
        }
        .auth-alert--warning {
            border-color: rgba(154,103,0,0.22);
            color: var(--warning);
            background: rgba(154,103,0,0.08);
        }
        .auth-meta { color: var(--muted); font-size: 0.92rem; }
        @media (max-width: 860px) {
            body { padding: 16px; }
            .auth-shell { grid-template-columns: 1fr; }
            .auth-panel, .auth-form-card { padding: 24px; border-radius: 24px; }
        }
    </style>
</head>
<body>
    <main class="auth-shell">
        <section class="auth-panel">
            <span class="auth-kicker">MINUTARE - EDUCATION DIVISION</span>
            <h1>${appName}</h1>
            <p class="auth-copy">
                Entre para continuar seus estudos no ambiente privado da plataforma.
            </p>
            <ul class="auth-points">
                <li>Acesso privado.</li>
                <li>Conteudo e progresso pessoais.</li>
                <li>Entre com suas credenciais para continuar.</li>
            </ul>
            ${configBanner}
        </section>
        <section class="auth-form-card">
            <div>
                <h2>Entrar na plataforma</h2>
                <p>Use seu e-mail e sua senha para acessar.</p>
            </div>
            <form id="login-form" novalidate>
                <label><span>E-mail</span><input id="email" name="email" type="email" autocomplete="username" required /></label>
                <label><span>Senha</span><input id="password" name="password" type="password" autocomplete="current-password" required /></label>
                <button id="submit-button" type="submit"${options.configReady ? '' : ' disabled'}>Entrar</button>
            </form>
            <div id="auth-feedback" class="auth-alert auth-alert--error" hidden>Credenciais invalidas.</div>
            <div class="auth-meta">Somente usuarios autorizados podem continuar.</div>
        </section>
    </main>
    <script>
        const form = document.getElementById('login-form');
        const feedback = document.getElementById('auth-feedback');
        const submitButton = document.getElementById('submit-button');
        form?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!submitButton || submitButton.disabled) return;
            feedback.hidden = true;
            submitButton.disabled = true;
            submitButton.textContent = 'Entrando...';
            const email = document.getElementById('email')?.value || '';
            const password = document.getElementById('password')?.value || '';
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ email, password }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || payload?.ok === false) {
                    console.error('[auth] login failed', { status: response.status, payload });
                    feedback.textContent = payload?.error || 'Credenciais invalidas';
                    feedback.hidden = false;
                    return;
                }
                window.location.assign('/app');
            } catch (error) {
                console.error('[auth] login request failed', error);
                feedback.textContent = 'Falha ao entrar. Tente novamente.';
                feedback.hidden = false;
            } finally {
                submitButton.disabled = ${options.configReady ? 'false' : 'true'};
                submitButton.textContent = 'Entrar';
            }
        });
    </script>
</body>
</html>`;
}

