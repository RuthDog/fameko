CREATE TABLE account_link_grants (
  id TEXT PRIMARY KEY NOT NULL,
  state_hash TEXT NOT NULL UNIQUE,
  existing_user_id TEXT NOT NULL,
  source_provider TEXT NOT NULL CHECK (source_provider = 'cloudflare_access'),
  source_provider_subject TEXT NOT NULL CHECK (length(source_provider_subject) > 0),
  target_provider TEXT CHECK (target_provider IS NULL OR target_provider = 'workos'),
  target_provider_subject TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  target_bound_at TEXT,
  consumed_at TEXT,
  revoked_at TEXT,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  CHECK (
    (target_provider IS NULL AND target_provider_subject IS NULL AND target_bound_at IS NULL)
    OR
    (target_provider = 'workos' AND length(target_provider_subject) > 0 AND target_bound_at IS NOT NULL)
  ),
  CHECK (consumed_at IS NULL OR revoked_at IS NULL),
  FOREIGN KEY (existing_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_account_link_grants_active_source
  ON account_link_grants (
    existing_user_id,
    source_provider,
    source_provider_subject
  )
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX idx_account_link_grants_active_target
  ON account_link_grants (target_provider, target_provider_subject)
  WHERE
    target_provider IS NOT NULL
    AND target_provider_subject IS NOT NULL
    AND consumed_at IS NULL
    AND revoked_at IS NULL;

CREATE INDEX idx_account_link_grants_expiry
  ON account_link_grants (expires_at, consumed_at, revoked_at);

CREATE UNIQUE INDEX idx_auth_identities_workos_user
  ON auth_identities (user_id)
  WHERE provider = 'workos';

CREATE TRIGGER consume_account_link_grant_after_workos_identity_insert
AFTER INSERT ON auth_identities
WHEN NEW.provider = 'workos'
BEGIN
  UPDATE account_link_grants
  SET
    consumed_at = NEW.created_at,
    updated_at = NEW.updated_at,
    revision = revision + 1
  WHERE
    existing_user_id = NEW.user_id
    AND target_provider = NEW.provider
    AND target_provider_subject = NEW.provider_subject
    AND consumed_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > NEW.created_at;
END;
