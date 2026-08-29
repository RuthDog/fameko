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
      className="mx-auto w-full max-w-[1560px] px-4 pb-2 pt-4 sm:px-6 sm:pt-16 lg:px-8 lg:pt-20"
    >
      <div className="max-w-3xl">
        <h2
          className="text-2xl font-semibold tracking-[-0.035em] text-stone-950 sm:text-[28px]"
          id="personal-economy-title"
        >
          Min ekonomi
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-500 sm:text-[15px]">
          Fördjupa dig i de delar av hushållets ekonomi som förändras mer sällan än den löpande
          årsplaneringen.
        </p>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <div className="min-w-0" key={module.id}>
            {module.preview}
          </div>
        ))}
      </div>
    </section>
  );
}
