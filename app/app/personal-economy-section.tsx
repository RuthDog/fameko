import {
  getCarLoanMode,
  type CarData,
  type CarPlanningEconomics,
} from "../../shared/planning/car.ts";
import { type HousingData } from "../../shared/planning/housing.ts";
import {
  getHouseholdSizeLabel,
  hasHouseholdProfileData,
  type HouseholdProfile,
} from "../../shared/planning/household.ts";
import {
  calculateSavingsPreview,
} from "../../shared/planning/personal-economy.ts";
import {
  getAnnualCarOperatingCost,
  getCarPreviewStatus,
  getSavingsPreviewStatus,
  type PersonalEconomyStatus,
} from "../../shared/planning/personal-economy-status.ts";
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
  const annualOperatingCost = getAnnualCarOperatingCost(data);

  if (planning.monthlyPlannedCost > 0) {
    metrics.push({
      label: "Månadskostnad",
      value: formatPreviewCurrency(planning.monthlyPlannedCost),
    });
  }

  if (loanMode === "withLoan") {
    metrics.push({
      label: "Låneskuld",
      value: formatPreviewCurrency(data?.currentLoanBalance ?? null),
    });
  } else if (annualOperatingCost !== null) {
    metrics.push({
      label: "Årlig drift",
      value: formatPreviewCurrency(annualOperatingCost),
    });
  }

  return (
    <PersonalEconomyCard
      actionLabel="Visa bil"
      href="/app/bil"
      illustrationAlt="Stilren illustration av en modern familjebil"
      illustrationSrc="/images/dashboard/car-preview-neutral.jpg"
      metrics={metrics}
      status={getCarPreviewStatus(data)}
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
      illustrationSrc="/images/dashboard/savings-preview-neutral.png"
      metrics={[
        {
          label: "Snitt per månad",
          value: formatPreviewCurrency(economics.averageMonthlySavings),
        },
        { label: "Sparkvot", value: formatPreviewPercentage(economics.savingsRate) },
      ]}
      status={getSavingsPreviewStatus(economics)}
      title="Sparande"
    />
  );
}

function HouseholdPreview({ data }: { data: HouseholdProfile | undefined }) {
  const hasData = hasHouseholdProfileData(data);
  const size = getHouseholdSizeLabel(data);
  const locality = [data?.postalCode, data?.city].filter(Boolean).join(" ") || null;
  const metrics = [
    data?.householdDisplayName
      ? { label: "Hushållsnamn", value: data.householdDisplayName }
      : null,
    size ? { label: "Storlek", value: size } : null,
    locality ? { label: "Ort", value: locality } : null,
  ].filter((metric) => metric !== null);
  const status: PersonalEconomyStatus = hasData
    ? {
        label: "Grunduppgifter finns",
        message: "Hushållets gemensamma metadata följer årsplaneringen.",
        tone: "stable",
      }
    : {
        label: "Inte ifyllt",
        message: "Lägg till frivilliga uppgifter när de hjälper din planering.",
        tone: "unknown",
      };

  return (
    <PersonalEconomyCard
      actionLabel="Visa hushåll"
      href="/app/hushall"
      illustrationAlt="Ljust nordiskt matbord som symboliserar hushållets gemensamma grund"
      illustrationSrc="/images/dashboard/household-preview.webp"
      metrics={metrics}
      status={status}
      title="Hushåll"
    />
  );
}

export function PersonalEconomySection({
  carData,
  carPlanning,
  householdProfile,
  housingData,
  savingsPreview,
}: {
  carData: CarData | undefined;
  carPlanning: CarPlanningEconomics;
  householdProfile: HouseholdProfile | undefined;
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
    {
      id: "household",
      preview: <HouseholdPreview data={householdProfile} />,
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
        className={`${mobileRhythm.headingToContent} grid grid-cols-1 gap-5 md:grid-cols-2 lg:mt-7 xl:grid-cols-4`}
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
