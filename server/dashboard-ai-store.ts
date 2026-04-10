import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { query, withClient } from './database.ts';
import type {
    DashboardAiMessage,
    DashboardAiMessageRole,
    DashboardAiMessageStatus,
    DashboardAiSession,
    DashboardAiSessionStatus,
} from '../types/dashboard-ai.ts';

type DashboardAiSessionRow = {
    id: string;
    user_id: string;
    title: string;
    status: DashboardAiSessionStatus;
    created_at: Date;
    updated_at: Date;
    last_message_at: Date | null;
};

type DashboardAiMessageRow = {
    id: string;
    session_id: string;
    user_id: string;
    role: DashboardAiMessageRole;
    content: string;
    created_at: Date;
    status: DashboardAiMessageStatus | null;
    error_code: string | null;
    reply_to_message_id: string | null;
};

type InsertDashboardAiMessageInput = {
    client: PoolClient;
    content: string;
    errorCode?: string | null;
    replyToMessageId?: string | null;
    role: DashboardAiMessageRole;
    sessionId: string;
    status?: DashboardAiMessageStatus;
    userId: string;
};

export type DashboardAiFailedTurn = {
    failedAssistantMessage: DashboardAiMessageRow;
    userMessage: DashboardAiMessageRow;
};

function createSessionId() {
    return `sess_${randomUUID().replace(/-/g, '')}`;
}

function createMessageId(role: DashboardAiMessageRole) {
    const prefix = role === 'assistant' ? 'msg_ai' : role === 'user' ? 'msg_user' : 'msg';
    return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

function mapSession(row: DashboardAiSessionRow): DashboardAiSession {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        lastMessageAt: row.last_message_at ? row.last_message_at.toISOString() : null,
    };
}

function mapMessage(row: DashboardAiMessageRow): DashboardAiMessage {
    return {
        id: row.id,
        sessionId: row.session_id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at.toISOString(),
        status: row.status || undefined,
        errorCode: row.error_code,
    };
}

export async function getOrCreateDashboardAiSession(userId: string): Promise<DashboardAiSession> {
    const existing = await query<DashboardAiSessionRow>(
        `
            SELECT id, user_id, title, status, created_at, updated_at, last_message_at
            FROM dashboard_ai_sessions
            WHERE user_id = $1
              AND status <> 'archived'
            ORDER BY updated_at DESC
            LIMIT 1
        `,
        [userId],
    );

    if (existing.rows[0]) {
        return mapSession(existing.rows[0]);
    }

    return withClient(async (client) => {
        const sessionId = createSessionId();
        const inserted = await client.query<DashboardAiSessionRow>(
            `
                INSERT INTO dashboard_ai_sessions (id, user_id, title, status)
                VALUES ($1, $2, 'Dashboard AI', 'active')
                RETURNING id, user_id, title, status, created_at, updated_at, last_message_at
            `,
            [sessionId, userId],
        );

        return mapSession(inserted.rows[0]);
    });
}

export async function getDashboardAiSessionForUser(sessionId: string, userId: string): Promise<DashboardAiSession | null> {
    const result = await query<DashboardAiSessionRow>(
        `
            SELECT id, user_id, title, status, created_at, updated_at, last_message_at
            FROM dashboard_ai_sessions
            WHERE id = $1
              AND user_id = $2
            LIMIT 1
        `,
        [sessionId, userId],
    );

    return result.rows[0] ? mapSession(result.rows[0]) : null;
}

export async function listDashboardAiMessages(sessionId: string, userId: string): Promise<DashboardAiMessage[]> {
    const result = await query<DashboardAiMessageRow>(
        `
            SELECT m.id, m.session_id, m.user_id, m.role, m.content, m.created_at, m.status, m.error_code, m.reply_to_message_id
            FROM dashboard_ai_messages m
            INNER JOIN dashboard_ai_sessions s ON s.id = m.session_id
            WHERE m.session_id = $1
              AND s.user_id = $2
            ORDER BY m.created_at ASC, m.id ASC
        `,
        [sessionId, userId],
    );

    return result.rows.map(mapMessage);
}

export async function withDashboardAiClient<T>(callback: (client: PoolClient) => Promise<T>) {
    return withClient(callback);
}

export async function insertDashboardAiMessage({
    client,
    content,
    errorCode = null,
    replyToMessageId = null,
    role,
    sessionId,
    status = 'complete',
    userId,
}: InsertDashboardAiMessageInput): Promise<DashboardAiMessage> {
    const inserted = await client.query<DashboardAiMessageRow>(
        `
            INSERT INTO dashboard_ai_messages (
                id,
                session_id,
                user_id,
                role,
                content,
                status,
                error_code,
                reply_to_message_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, session_id, user_id, role, content, created_at, status, error_code, reply_to_message_id
        `,
        [createMessageId(role), sessionId, userId, role, content, status, errorCode, replyToMessageId],
    );

    return mapMessage(inserted.rows[0]);
}

export async function updateDashboardAiSessionStatus(
    client: PoolClient,
    sessionId: string,
    status: DashboardAiSessionStatus,
    touchLastMessageAt = false,
) {
    await client.query(
        `
            UPDATE dashboard_ai_sessions
            SET status = $2,
                updated_at = NOW(),
                last_message_at = CASE WHEN $3 THEN NOW() ELSE last_message_at END
            WHERE id = $1
        `,
        [sessionId, status, touchLastMessageAt],
    );
}

export async function listDashboardAiMessagesForPrompt(
    client: PoolClient,
    sessionId: string,
    userId: string,
    beforeCreatedAt: Date | null = null,
): Promise<DashboardAiMessageRow[]> {
    const params: unknown[] = [sessionId, userId];
    const beforeClause = beforeCreatedAt ? 'AND m.created_at <= $3' : '';

    if (beforeCreatedAt) {
        params.push(beforeCreatedAt);
    }

    const result = await client.query<DashboardAiMessageRow>(
        `
            SELECT m.id, m.session_id, m.user_id, m.role, m.content, m.created_at, m.status, m.error_code, m.reply_to_message_id
            FROM dashboard_ai_messages m
            INNER JOIN dashboard_ai_sessions s ON s.id = m.session_id
            WHERE m.session_id = $1
              AND s.user_id = $2
              AND m.status = 'complete'
              ${beforeClause}
            ORDER BY m.created_at ASC, m.id ASC
        `,
        params,
    );

    return result.rows;
}

export async function findLastFailedDashboardAiTurn(
    client: PoolClient,
    sessionId: string,
    userId: string,
): Promise<DashboardAiFailedTurn | null> {
    const failed = await client.query<DashboardAiMessageRow>(
        `
            SELECT m.id, m.session_id, m.user_id, m.role, m.content, m.created_at, m.status, m.error_code, m.reply_to_message_id
            FROM dashboard_ai_messages m
            INNER JOIN dashboard_ai_sessions s ON s.id = m.session_id
            WHERE m.session_id = $1
              AND s.user_id = $2
              AND m.role = 'assistant'
              AND m.status = 'error'
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT 1
        `,
        [sessionId, userId],
    );

    const failedAssistantMessage = failed.rows[0];

    if (!failedAssistantMessage?.reply_to_message_id) {
        return null;
    }

    const userResult = await client.query<DashboardAiMessageRow>(
        `
            SELECT id, session_id, user_id, role, content, created_at, status, error_code, reply_to_message_id
            FROM dashboard_ai_messages
            WHERE id = $1
              AND session_id = $2
              AND user_id = $3
              AND role = 'user'
            LIMIT 1
        `,
        [failedAssistantMessage.reply_to_message_id, sessionId, userId],
    );

    if (!userResult.rows[0]) {
        return null;
    }

    return {
        failedAssistantMessage,
        userMessage: userResult.rows[0],
    };
}

export async function deleteDashboardAiMessage(client: PoolClient, messageId: string, sessionId: string, userId: string) {
    await client.query(
        `
            DELETE FROM dashboard_ai_messages
            WHERE id = $1
              AND session_id = $2
              AND user_id = $3
        `,
        [messageId, sessionId, userId],
    );
}

export function mapDashboardAiMessageRoleForProvider(role: DashboardAiMessageRole) {
    return role === 'assistant' ? 'model' : 'user';
}
