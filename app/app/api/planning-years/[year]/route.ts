import { NextResponse } from "next/server";

import { getFamekoDatabase } from "../../../../../server/cloudflare/database.ts";
import {
  isSameOriginJsonRequest,
  requirePlanningAuthorization,
} from "../../../../../server/planning/planning-http.ts";
import {
  getDevelopmentPlanningYear,
  saveDevelopmentPlanningYear,
} from "../../../../../server/planning/development-planning-store.ts";
import { PlanningRepository } from "../../../../../server/planning/planning-repository.ts";
import {
  isPlanningData,
  planningDataVersion,
  planningPayloadMaxBytes,
  serializedPlanningDataSize,
} from "../../../../../server/planning/planning-schema.ts";

type RouteContext = { params: Promise<{ year: string }> };

function parseYear(value: string): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2200 ? year : null;
}

function planningYearResponse(planningYear: Awaited<ReturnType<PlanningRepository["get"]>>) {
  if (!planningYear) {
    return NextResponse.json({ message: "Planeringsåret finns inte ännu." }, { status: 404 });
  }

  return NextResponse.json(
    {
      data: planningYear.data,
      revision: planningYear.revision,
      schemaVersion: planningYear.dataVersion,
      updatedAt: planningYear.updatedAt,
      year: planningYear.year,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function unexpectedErrorResponse() {
  return NextResponse.json(
    {
      correlationId: crypto.randomUUID(),
      message: "Ekonomin kunde inte hämtas just nu. Försök igen om en liten stund.",
    },
    { status: 500 },
  );
}

export async function GET(request: Request, routeContext: RouteContext) {
  const authorization = await requirePlanningAuthorization(request);
  if ("response" in authorization) {
    return authorization.response;
  }

  const year = parseYear((await routeContext.params).year);
  if (!year) {
    return NextResponse.json({ message: "Planeringsåret är inte giltigt." }, { status: 422 });
  }

  try {
    if (authorization.mode === "development") {
      return planningYearResponse(
        getDevelopmentPlanningYear(authorization.context.household.id, year),
      );
    }

    const repository = new PlanningRepository(await getFamekoDatabase());
    return planningYearResponse(await repository.get(authorization.context.household.id, year));
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function PUT(request: Request, routeContext: RouteContext) {
  const authorization = await requirePlanningAuthorization(request);
  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isSameOriginJsonRequest(request)) {
    return NextResponse.json({ message: "Begäran kunde inte godkännas." }, { status: 403 });
  }

  const year = parseYear((await routeContext.params).year);
  if (!year) {
    return NextResponse.json({ message: "Planeringsåret är inte giltigt." }, { status: 422 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > planningPayloadMaxBytes + 1_024) {
    return NextResponse.json({ message: "Ekonomin är för stor för att sparas." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ message: "Ekonomin har ett ogiltigt format." }, { status: 422 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ message: "Ekonomin har ett ogiltigt format." }, { status: 422 });
  }

  const { data, expectedRevision } = payload as Record<string, unknown>;
  if (serializedPlanningDataSize(data) > planningPayloadMaxBytes) {
    return NextResponse.json({ message: "Ekonomin är för stor för att sparas." }, { status: 413 });
  }

  if (!isPlanningData(data)) {
    return NextResponse.json({ message: "Ekonomin har ett ogiltigt format." }, { status: 422 });
  }

  if (
    expectedRevision !== null &&
    (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0)
  ) {
    return NextResponse.json({ message: "Sparversionen är inte giltig." }, { status: 422 });
  }

  try {
    let planningYear;

    if (authorization.mode === "development") {
      planningYear = saveDevelopmentPlanningYear(
        authorization.context.household.id,
        year,
        expectedRevision as number | null,
        data,
        planningDataVersion,
      );
    } else {
      const repository = new PlanningRepository(await getFamekoDatabase());
      planningYear =
        expectedRevision === null
          ? await repository.create(
              authorization.context.household.id,
              year,
              data,
              planningDataVersion,
            )
          : await repository.update(
            authorization.context.household.id,
            year,
            expectedRevision as number,
            data,
            planningDataVersion,
          );
    }

    if (!planningYear) {
      return NextResponse.json(
        { message: "Ekonomin har ändrats på en annan plats. Ladda om innan du sparar igen." },
        { status: 409 },
      );
    }

    return planningYearResponse(planningYear);
  } catch {
    return unexpectedErrorResponse();
  }
}
