CREATE TABLE users (
 id uuid PRIMARY KEY, username text UNIQUE NOT NULL, display_name text NOT NULL,
 password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('admin','user')),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE records (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id),
 kind text NOT NULL CHECK(kind IN ('revenue','ad','subsidy','traffic-subsidy')),
 designer text, month text, data jsonb NOT NULL, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX unique_monthly_subsidy ON records(kind,designer,month)
 WHERE kind IN ('subsidy','traffic-subsidy');
CREATE INDEX records_owner ON records(owner_id);
CREATE TABLE user_settings (
 owner_id uuid PRIMARY KEY REFERENCES users(id), data jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1
);
