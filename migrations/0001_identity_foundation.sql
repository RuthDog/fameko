PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('invited', 'active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (length(provider) > 0),
  provider_subject TEXT NOT NULL CHECK (length(provider_subject) > 0),
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT auth_identities_provider_subject_unique
    UNIQUE (provider, provider_subject),
  CONSTRAINT auth_identities_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX auth_identities_user_id_idx
  ON auth_identities(user_id);

CREATE TABLE households (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE household_members (
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TEXT NOT NULL,
  CONSTRAINT household_members_unique
    UNIQUE (household_id, user_id),
  CONSTRAINT household_members_household_fk
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  CONSTRAINT household_members_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX household_members_user_id_idx
  ON household_members(user_id);

CREATE TABLE planning_years (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  planning_data TEXT NOT NULL CHECK (json_valid(planning_data)),
  data_version INTEGER NOT NULL CHECK (data_version > 0),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT planning_years_household_year_unique
    UNIQUE (household_id, year),
  CONSTRAINT planning_years_household_fk
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);
