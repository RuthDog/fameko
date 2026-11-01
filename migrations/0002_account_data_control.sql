CREATE TABLE legal_acceptances (
  user_id TEXT NOT NULL,
  terms_version TEXT NOT NULL CHECK (length(terms_version) > 0),
  privacy_version TEXT NOT NULL CHECK (length(privacy_version) > 0),
  accepted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, terms_version, privacy_version),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_legal_acceptances_user_id
  ON legal_acceptances(user_id);

CREATE TABLE account_deletion_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  household_id TEXT,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'processing_workos', 'workos_deleted', 'processing_d1')
  ),
  lease_token TEXT,
  lease_expires_at TEXT,
  last_error_code TEXT CHECK (
    last_error_code IS NULL OR last_error_code IN (
      'shared_household',
      'workos_sessions',
      'workos_user',
      'd1_finalize'
    )
  ),
  requested_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL
);

CREATE INDEX idx_account_deletion_jobs_status
  ON account_deletion_jobs(status, lease_expires_at);
