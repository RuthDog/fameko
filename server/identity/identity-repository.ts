import type {
  AuthIdentity,
  FamekoUser,
  Household,
  HouseholdMember,
} from "./identity-types";

export class IdentityRepository {
  private readonly database: D1Database;

  constructor(database: D1Database) {
    this.database = database;
  }

  async findAuthIdentity(
    provider: string,
    providerSubject: string,
  ): Promise<AuthIdentity | null> {
    return this.database
      .prepare(
        `SELECT id, user_id, provider, provider_subject, email, created_at, updated_at
         FROM auth_identities
         WHERE provider = ? AND provider_subject = ?
         LIMIT 1`,
      )
      .bind(provider, providerSubject)
      .first<AuthIdentity>();
  }

  async getUser(userId: string): Promise<FamekoUser | null> {
    return this.database
      .prepare(
        `SELECT id, display_name, status, created_at, updated_at
         FROM users
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(userId)
      .first<FamekoUser>();
  }

  async getActiveUser(userId: string): Promise<FamekoUser | null> {
    return this.database
      .prepare(
        `SELECT id, display_name, status, created_at, updated_at
         FROM users
         WHERE id = ? AND status = 'active'
         LIMIT 1`,
      )
      .bind(userId)
      .first<FamekoUser>();
  }

  async getHouseholdMemberships(userId: string): Promise<HouseholdMember[]> {
    const result = await this.database
      .prepare(
        `SELECT household_id, user_id, role, created_at
         FROM household_members
         WHERE user_id = ?
         ORDER BY created_at ASC, household_id ASC`,
      )
      .bind(userId)
      .all<HouseholdMember>();

    return result.results;
  }

  async getHousehold(householdId: string): Promise<Household | null> {
    return this.database
      .prepare(
        `SELECT id, name, created_at, updated_at
         FROM households
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(householdId)
      .first<Household>();
  }
}
