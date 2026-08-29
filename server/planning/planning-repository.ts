import { isPlanningData, type PlanningDataJson } from "./planning-schema.ts";

type PlanningYearRow = {
  data_version: number;
  id: string;
  planning_data: string;
  revision: number;
  updated_at: string;
  year: number;
};

export type PlanningYear = {
  data: PlanningDataJson;
  dataVersion: number;
  id: string;
  revision: number;
  updatedAt: string;
  year: number;
};

function mapPlanningYear(row: PlanningYearRow): PlanningYear {
  const data: unknown = JSON.parse(row.planning_data);
  if (!isPlanningData(data) || data.version !== row.data_version) {
    throw new Error("Stored PlanningData is invalid.");
  }

  return {
    data,
    dataVersion: row.data_version,
    id: row.id,
    revision: row.revision,
    updatedAt: row.updated_at,
    year: row.year,
  };
}

export class PlanningRepository {
  private readonly database: D1Database;

  constructor(database: D1Database) {
    this.database = database;
  }

  async get(householdId: string, year: number): Promise<PlanningYear | null> {
    const row = await this.database
      .prepare(
        `SELECT id, year, planning_data, data_version, revision, updated_at
         FROM planning_years
         WHERE household_id = ? AND year = ?
         LIMIT 1`,
      )
      .bind(householdId, year)
      .first<PlanningYearRow>();

    return row ? mapPlanningYear(row) : null;
  }

  async create(
    householdId: string,
    year: number,
    data: PlanningDataJson,
    dataVersion: number,
  ): Promise<PlanningYear | null> {
    const now = new Date().toISOString();
    const result = await this.database
      .prepare(
        `INSERT INTO planning_years (
           id, household_id, year, planning_data, data_version, revision, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(household_id, year) DO NOTHING`,
      )
      .bind(
        crypto.randomUUID(),
        householdId,
        year,
        JSON.stringify(data),
        dataVersion,
        now,
        now,
      )
      .run();

    if (result.meta.changes !== 1) {
      return null;
    }

    return this.get(householdId, year);
  }

  async update(
    householdId: string,
    year: number,
    expectedRevision: number,
    data: PlanningDataJson,
    dataVersion: number,
  ): Promise<PlanningYear | null> {
    const result = await this.database
      .prepare(
        `UPDATE planning_years
         SET planning_data = ?,
             data_version = ?,
             revision = revision + 1,
             updated_at = ?
         WHERE household_id = ? AND year = ? AND revision = ?`,
      )
      .bind(
        JSON.stringify(data),
        dataVersion,
        new Date().toISOString(),
        householdId,
        year,
        expectedRevision,
      )
      .run();

    if (result.meta.changes !== 1) {
      return null;
    }

    return this.get(householdId, year);
  }
}
