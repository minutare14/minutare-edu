CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions (expires_at);

CREATE TABLE IF NOT EXISTS feynman_attempts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    tema TEXT NOT NULL,
    resposta TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
    acertos JSONB NOT NULL DEFAULT '[]'::JSONB,
    falhas JSONB NOT NULL DEFAULT '[]'::JSONB,
    erros JSONB NOT NULL DEFAULT '[]'::JSONB,
    recomendacao TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feynman_attempts_user_id ON feynman_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_feynman_attempts_created_at ON feynman_attempts (created_at);

CREATE TABLE IF NOT EXISTS user_learning_state (
    owner_user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_learning_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_learning_state_select_policy ON user_learning_state;
CREATE POLICY user_learning_state_select_policy
ON user_learning_state
FOR SELECT
USING (
    current_setting('app.current_user_role', true) = 'owner'
    OR owner_user_id::TEXT = current_setting('app.current_user_id', true)
);

DROP POLICY IF EXISTS user_learning_state_insert_policy ON user_learning_state;
CREATE POLICY user_learning_state_insert_policy
ON user_learning_state
FOR INSERT
WITH CHECK (
    current_setting('app.current_user_role', true) = 'owner'
    OR owner_user_id::TEXT = current_setting('app.current_user_id', true)
);

DROP POLICY IF EXISTS user_learning_state_update_policy ON user_learning_state;
CREATE POLICY user_learning_state_update_policy
ON user_learning_state
FOR UPDATE
USING (
    current_setting('app.current_user_role', true) = 'owner'
    OR owner_user_id::TEXT = current_setting('app.current_user_id', true)
)
WITH CHECK (
    current_setting('app.current_user_role', true) = 'owner'
    OR owner_user_id::TEXT = current_setting('app.current_user_id', true)
);
