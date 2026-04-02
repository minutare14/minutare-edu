import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { newDb } from 'pg-mem';

export type AppRole = 'owner' | 'member';

export type DatabaseUser = {
    id: string;
    email: string;
    passwordHash: string;
    role: AppRole;
    mustChangePassword: boolean;
    createdAt: string;
    updatedAt: string;
};

export type AuthenticatedUser = {
    id: string;
    email: string;
    role: AppRole;
    mustChangePassword: boolean;
    createdAt: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;

function getDatabaseUrl(): string {
    return process.env.DATABASE_URL?.trim() || '';
}

function usePgMem(): boolean {
    return getDatabaseUrl().startsWith('pgmem://');
}

function shouldUseSsl(databaseUrl: string): boolean {
    const explicitFlag = (process.env.DATABASE_SSL || process.env.PGSSLMODE || '').trim().toLowerCase();

    if (['true', '1', 'on', 'require', 'required'].includes(explicitFlag)) {
        return true;
    }

    if (['false', '0', 'off', 'disable', 'disabled'].includes(explicitFlag)) {
        return false;
    }

    try {
        const parsed = new URL(databaseUrl);
        const sslMode = parsed.searchParams.get('sslmode')?.trim().toLowerCase() || '';
        return ['require', 'verify-ca', 'verify-full'].includes(sslMode);
    } catch {
        return false;
    }
}

function getPool(): Pool {
    const databaseUrl = getDatabaseUrl();

    if (!databaseUrl) {
        throw new Error('Missing DATABASE_URL.');
    }

    if (!pool) {
        if (usePgMem()) {
            const memoryDb = newDb({
                autoCreateForeignKeyIndices: true,
            });
            const adapter = memoryDb.adapters.createPg();
            pool = new adapter.Pool();
        } else {
            pool = new Pool({
                connectionString: databaseUrl,
                max: 10,
                idleTimeoutMillis: 30_000,
                ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
            });
        }
    }

    return pool;
}

export function getDatabaseStatus() {
    return {
        envVar: 'DATABASE_URL',
        configured: Boolean(getDatabaseUrl()),
        mode: usePgMem() ? 'pg-mem' : 'postgres',
    };
}

function normalizeInitSql(sql: string): string {
    if (!usePgMem()) {
        return sql;
    }

    return sql
        .replace(/\bINET\b/g, 'TEXT')
        .replace(/^ALTER TABLE .* ROW LEVEL SECURITY;\r?\n/gm, '')
        .replace(/^DROP POLICY IF EXISTS .*;\r?\n/gm, '')
        .replace(/^CREATE POLICY[\s\S]*?;\r?\n/gm, '');
}

export async function ensureDatabaseReady(): Promise<void> {
    if (!getDatabaseUrl()) {
        return;
    }

    if (!initPromise) {
        initPromise = (async () => {
            const sqlPath = path.join(__dirname, '..', 'db', 'init.sql');
            const sql = normalizeInitSql(await fs.readFile(sqlPath, 'utf8'));
            const client = await getPool().connect();

            try {
                await client.query(sql);
            } finally {
                client.release();
            }
        })();
    }

    await initPromise;
}

export async function withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    await ensureDatabaseReady();
    const client = await getPool().connect();

    try {
        return await callback(client);
    } finally {
        client.release();
    }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
): Promise<QueryResult<T>> {
    return withClient((client) => client.query<T>(text, params));
}

export async function withUserRls<T>(
    user: AuthenticatedUser,
    callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
    return withClient(async (client) => {
        try {
            await client.query('BEGIN');
            if (!usePgMem()) {
                await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [user.id]);
                await client.query(`SELECT set_config('app.current_user_role', $1, true)`, [user.role]);
            }
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    });
}

export async function closeDatabasePool(): Promise<void> {
    if (!pool) {
        return;
    }

    const activePool = pool;
    pool = null;
    initPromise = null;
    await activePool.end();
}
