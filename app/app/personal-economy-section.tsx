import {
  getCarLoanMode,
  type CarData,
  type CarPlanningEconomics,
} from "../../shared/planning/car.ts";
import { type HousingData } from "../../shared/planning/housing.ts";
import {
  calculateSavingsPreview,
  getSavingsPreviewSummary,
} from "../../shared/planning/personal-economy.ts";
import { HousingPreview } from "./housing-overview.tsx";
import {
  formatPreviewCurrency,
  formatPreviewPercentage,
  PersonalEconomyCard,
  type PersonalEconomyMetric,
} from "./personal-economy-card.tsx";
import { mobileRhythm, mobileTypography } from "./mobile-design-system.ts";

export type SavingsPreviewSource = {
  monthlyIncome: number[];
  monthlySavings: number[];
};

function CarPreview({
  data,
  planning,
}: {
  data: CarData | undefined;
  planning: CarPlanningEconomics;
}) {
  const loanMode = getCarLoanMode(data);
  const metrics: PersonalEconomyMetric[] = [];

  if (loanMode === "withLoan") {
    metrics.push({ label: "Billån", value: formatPreviewCurrency(data?.currentLoanBalance ?? null) });
  } else if (loanMode === "loanFree") {
    metrics.push({ label: "Lån", value: "Lånefri" });
  } else if (planning.hasPlannedLoan && planning.monthlyPlannedLoanPayment > 0) {
    metrics.push({
      label: "Billån i planeringen",
      value: formatPreviewCurrency(planning.monthlyPlannedLoanPayment),
    });
  }

  if (planning.monthlyPlannedCost > 0) {
    metrics.push({
      label: "Månadskostnad",
      value: formatPreviewCurrency(planning.monthlyPlannedCost),
    });
  }

  if (data?.annualInsurance !== null && data?.annualInsurance !== undefined) {
    metrics.push({
      label: "Försäkring / år",
      value: formatPreviewCurrency(data.annualInsurance),
    });
  }

  if (data?.annualService !== null && data?.annualService !== undefined) {
    metrics.push({
      label: "Service / år",
      value: formatPreviewCurrency(data.annualService),
    });
  }

  let summary = "Biluppgifter saknas";
  if (loanMode === "loanFree") {
    summary = "Bilen är registrerad som lånefri.";
  } else if (loanMode === "withLoan") {
    summary = "Billånet och månadens planerade bilkostnad visas från sina respektive källor.";
  } else if (data) {
    summary = "Komplettera låneskulden för att visa om bilen har lån eller är lånefri.";
  } else if (planning.hasPlannedLoan) {
    summary = "Biluppgifter saknas. Ett billån finns i årsplaneringen.";
  }

  return (
    <PersonalEconomyCard
      actionLabel="Visa bil"
      href="/app/bil"
      illustrationAlt="Stilren illustration av en modern familjebil"
      illustrationSrc="/images/dashboard/car-preview-neutral.jpg"
      metrics={metrics.slice(0, 4)}
      summary={summary}
      title="Bil"
    />
  );
}

function SavingsPreview({ source }: { source: SavingsPreviewSource }) {
  const economics = calculateSavingsPreview(source.monthlySavings, source.monthlyIncome);

  return (
    <PersonalEconomyCard
      actionLabel="Visa sparande"
      href="/app/sparande"
      illustrationAlt="Stilren illustration av en växt, sparbössa och mynt"
      illustrationSrc="/images/dashboard/savings-preview-neutral.jpg"
      metrics={[
        { label: "Planerat sparande", value: formatPreviewCurrency(economics.totalPlannedSavings) },
        {
          label: "Snitt per månad",
          value: formatPreviewCurrency(economics.averageMonthlySavings),
        },
        { label: "Sparkvot", value: formatPreviewPercentage(economics.savingsRate) },
      ]}
      summary={getSavingsPreviewSummary(economics, source.monthlySavings.length)}
      title="Sparande"
    />
  );
}

export function PersonalEconomySection({
  carData,
  carPlanning,
  housingData,
  savingsPreview,
}: {
  carData: CarData | undefined;
  carPlanning: CarPlanningEconomics;
  housingData: HousingData | undefined;
  savingsPreview: SavingsPreviewSource;
}) {
  const modules = [
    {
      id: "housing",
      preview: <HousingPreview data={housingData} />,
    },
    {
      id: "car",
      preview: <CarPreview data={carData} planning={carPlanning} />,
    },
    {
      id: "savings",
      preview: <SavingsPreview source={savingsPreview} />,
    },
  ];

  return (
    <section
      aria-labelledby="personal-economy-title"
      className={`mx-auto w-full max-w-[1560px] ${mobileRhythm.section} pt-0 lg:px-8 lg:pb-2 lg:pt-20`}
    >
      <div className="max-w-3xl">
        <h2
          className={`${mobileTypography.pageTitle} text-stone-950 lg:text-[28px]`}
          id="personal-economy-title"
        >
          Min ekonomi
        </h2>
        <p
          className={`${mobileRhythm.headingToDescription} ${mobileTypography.metadata} text-stone-500 lg:mt-3 lg:text-[15px] lg:leading-6`}
        >
          Fördjupa dig i de delar av hushållets ekonomi som förändras mer sällan än den löpande
          årsplaneringen.
        </p>
      </div>

      <div
        className={`${mobileRhythm.headingToContent} grid grid-cols-1 gap-5 md:grid-cols-2 lg:mt-7 xl:grid-cols-3`}
      >
        {modules.map((module) => (
          <div className="min-w-0" key={module.id}>
            {module.preview}
          </div>
        ))}
      </div>
    </section>
  );
}
