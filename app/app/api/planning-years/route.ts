import { NextResponse } from "next/server";

import { getFamekoDatabase } from "../../../../server/cloudflare/database.ts";
import { requirePlanningAuthorization } from "../../../../server/planning/planning-http.ts";
import { listDevelopmentPlanningYears } from "../../../../server/planning/development-planning-store.ts";
import { PlanningRepository } from "../../../../server/planning/planning-repository.ts";

export async function GET(request: Request) {
  const authorization = await requirePlanningAuthorization(request);
  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const years =
      authorization.mode === "development"
        ? listDevelopmentPlanningYears(authorization.context.household.id)
        : await new PlanningRepository(await getFamekoDatabase()).listYears(
            authorization.context.household.id,
          );

    return NextResponse.json(
      { years },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        correlationId: crypto.randomUUID(),
        message: "Dina planeringsår kunde inte hämtas just nu.",
      },
      { status: 500 },
    );
  }
}
