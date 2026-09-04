import { NextResponse } from "next/server";

import { getFamekoDatabase } from "../../../../../../server/cloudflare/database.ts";
import { requirePlanningAuthorization } from "../../../../../../server/planning/planning-http.ts";
import { getDevelopmentPlanningYear } from "../../../../../../server/planning/development-planning-store.ts";
import { PlanningRepository } from "../../../../../../server/planning/planning-repository.ts";
import {
  createBankReportPdfDownloadResponse,
  createBankReportPdfErrorResponse,
} from "../../../../../../server/planning/bank-report-pdf-http.ts";
import {
  buildBankReportModel,
  type BankReportPlanningData,
} from "../../../../../../shared/planning/bank-report.ts";

type RouteContext = { params: Promise<{ year: string }> };

function parseYear(value: string): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2200 ? year : null;
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
    const planningYear = authorization.mode === "development"
      ? getDevelopmentPlanningYear(authorization.context.household.id, year)
      : await new PlanningRepository(await getFamekoDatabase()).get(
          authorization.context.household.id,
          year,
        );

    if (!planningYear) {
      return NextResponse.json(
        { message: "Planeringsåret finns inte ännu." },
        { status: 404 },
      );
    }

    const report = buildBankReportModel(
      planningYear.data as unknown as BankReportPlanningData,
      { generatedAt: new Date(), planningYear: year },
    );
    return createBankReportPdfDownloadResponse(report);
  } catch {
    return createBankReportPdfErrorResponse();
  }
}
