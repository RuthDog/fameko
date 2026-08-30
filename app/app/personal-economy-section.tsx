import { type HousingData } from "../../shared/planning/housing.ts";
import {
  calculateSavingsPreview,
  getCarPreviewSummary,
  getSavingsPreviewSummary,
  type CarPreviewEconomics,
} from "../../shared/planning/personal-economy.ts";
import { HousingPreview } from "./housing-overview.tsx";
import {
  formatPreviewCurrency,
  formatPreviewPercentage,
  PersonalEconomyCard,
} from "./personal-economy-card.tsx";
import { mobileRhythm, mobileTypography } from "./mobile-design-system.ts";

export type SavingsPreviewSource = {
  monthlyIncome: number[];
  monthlySavings: number[];
};

function CarPreview({ economics }: { economics: CarPreviewEconomics }) {
  return (
    <PersonalEconomyCard
      actionLabel="Visa bil"
      illustrationAlt="Stilren illustration av en modern familjebil"
      illustrationSrc="/images/dashboard/car-preview.webp"
      metrics={[
        { label: "Billån", value: formatPreviewCurrency(economics.loanPayment) },
        { label: "Total månadskostnad", value: formatPreviewCurrency(economics.monthlyCost) },
      ]}
      summary={getCarPreviewSummary(economics)}
      title="Bil"
    />
  );
}

function SavingsPreview({ source }: { source: SavingsPreviewSource }) {
  const economics = calculateSavingsPreview(source.monthlySavings, source.monthlyIncome);

  return (
    <PersonalEconomyCard
      actionLabel="Visa sparande"
      illustrationAlt="Stilren illustration av en växt, sparbössa och mynt"
      illustrationSrc="/images/dashboard/savings-preview.webp"
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
  carPreview,
  housingData,
  savingsPreview,
}: {
  carPreview: CarPreviewEconomics;
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
      preview: <CarPreview economics={carPreview} />,
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
