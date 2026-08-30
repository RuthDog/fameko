import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

import { seedPlanningDataV3 } from "../../shared/planning/seed-planning-data.ts";
import { PlanningRepository } from "./planning-repository.ts";
import { isPlanningData } from "./planning-schema.ts";

const migrationUrl = new URL("../../migrations/0001_identity_foundation.sql", import.meta.url);
const monthIds = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const housingData = {
  propertyValue: 4_200_000,
  valuationDate: "2026-08-29",
  totalMortgage: 2_450_000,
  averageInterestRate: 3.68,
  monthlyAmortization: 2_400,
};
const carData = {
  annualInsurance: 7_200,
  annualService: 6_000,
  averageInterestRate: 4.2,
  carName: "Familjebilen",
  carValue: 285_000,
  currentLoanBalance: 185_000,
  monthlyAmortization: 2_500,
};

function createPlanningData(openingBalance = 10_000) {
  const monthlyValues = Object.fromEntries(monthIds.map((monthId) => [monthId, 1_000]));
  return {
    version: 3 as const,
    openingBalance,
    incomes: [
      {
        id: "income-salary",
        monthlyValues,
        name: "Inkomster",
        recurring: true,
      },
    ],
    expenseCategories: [{ id: "boende", name: "Boende", order: 0 }],
    expenseItems: [
      {
        category: "boende",
        id: "boende-hyra",
        monthlyValues,
        name: "Hyra",
        recurring: true,
      },
    ],
  };
}

async function createDatabase() {
  const miniflare = new Miniflare({
    d1Databases: { FAMEKO_DB: "fameko-planning-test" },
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
  });
  const database = await miniflare.getD1Database("FAMEKO_DB");
  const migration = await readFile(migrationUrl, "utf8");
  await database.batch(
    unstable_splitSqlQuery(migration)
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement)),
  );
  const now = new Date().toISOString();
  await database.batch([
    database
      .prepare("INSERT INTO households (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .bind("household-a", "A", now, now),
    database
      .prepare("INSERT INTO households (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .bind("household-b", "B", now, now),
  ]);
  return { database, miniflare };
}

test("PlanningData v3 validation accepts the complete Workspace shape", () => {
  assert.equal(isPlanningData(seedPlanningDataV3), true);
  assert.equal(isPlanningData(createPlanningData()), true);
  assert.equal(isPlanningData({ ...createPlanningData(), housingData }), true);
  assert.equal(isPlanningData({ ...createPlanningData(), carData }), true);
  assert.equal(
    isPlanningData({
      ...createPlanningData(),
      housingData: { ...housingData, averageInterestRate: 101 },
    }),
    false,
  );
  assert.equal(isPlanningData({ ...createPlanningData(), version: 4 }), false);
  assert.equal(
    isPlanningData({ ...createPlanningData(), openingBalance: Number.POSITIVE_INFINITY }),
    false,
  );
});

test("HousingData and CarData round-trip in the same authoritative PlanningData document", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const repository = new PlanningRepository(database);
    const data = { ...createPlanningData(), housingData, carData };
    const created = await repository.create("household-a", 2026, data, 3);
    assert.ok(created);

    const stored = await repository.get("household-a", 2026);
    assert.deepEqual(stored?.data.housingData, housingData);
    assert.deepEqual(stored?.data.carData, carData);

    const updatedCarData = { ...carData, currentLoanBalance: 0 };
    const updated = await repository.update(
      "household-a",
      2026,
      created.revision,
      { ...data, carData: updatedCarData },
      3,
    );
    assert.equal(updated?.revision, 2);
    assert.deepEqual(updated?.data.housingData, housingData);
    assert.deepEqual(updated?.data.carData, updatedCarData);
  } finally {
    await miniflare.dispose();
  }
});

test("HousingData round-trips inside authoritative PlanningData", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const repository = new PlanningRepository(database);
    const data = { ...createPlanningData(), housingData };
    const created = await repository.create("household-a", 2026, data, 3);
    assert.ok(created);
    assert.deepEqual((await repository.get("household-a", 2026))?.data.housingData, housingData);

    const updatedHousingData = { ...housingData, propertyValue: 4_350_000 };
    const updated = await repository.update(
      "household-a",
      2026,
      created.revision,
      { ...data, housingData: updatedHousingData },
      3,
    );
    assert.equal(updated?.revision, 2);
    assert.deepEqual(updated?.data.housingData, updatedHousingData);
  } finally {
    await miniflare.dispose();
  }
});

test("create stores one complete authoritative JSON document with revision one", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const repository = new PlanningRepository(database);
    const data = createPlanningData();
    const created = await repository.create("household-a", 2026, data, data.version);

    assert.equal(created?.revision, 1);
    assert.deepEqual(created?.data, data);
    assert.equal(await repository.create("household-a", 2026, data, data.version), null);
  } finally {
    await miniflare.dispose();
  }
});

test("save uses optimistic concurrency and preserves the newer revision", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const repository = new PlanningRepository(database);
    const created = await repository.create("household-a", 2026, createPlanningData(), 3);
    assert.ok(created);

    const updatedData = createPlanningData(25_000);
    const updated = await repository.update("household-a", 2026, created.revision, updatedData, 3);
    assert.equal(updated?.revision, 2);
    assert.equal(updated?.data.openingBalance, 25_000);

    const staleWrite = await repository.update("household-a", 2026, created.revision, createPlanningData(1), 3);
    assert.equal(staleWrite, null);
    assert.equal((await repository.get("household-a", 2026))?.data.openingBalance, 25_000);
  } finally {
    await miniflare.dispose();
  }
});

test("every read and write remains scoped to the server-derived household", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const repository = new PlanningRepository(database);
    await repository.create("household-a", 2026, createPlanningData(10_000), 3);
    await repository.create("household-b", 2026, createPlanningData(90_000), 3);

    assert.equal((await repository.get("household-a", 2026))?.data.openingBalance, 10_000);
    assert.equal((await repository.get("household-b", 2026))?.data.openingBalance, 90_000);
    assert.equal(await repository.get("household-missing", 2026), null);
    await repository.update("household-a", 2026, 1, createPlanningData(20_000), 3);
    assert.equal((await repository.get("household-b", 2026))?.data.openingBalance, 90_000);
  } finally {
    await miniflare.dispose();
  }
});
