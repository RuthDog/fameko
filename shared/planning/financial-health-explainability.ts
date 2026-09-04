import { financialHealthRules } from "./financial-health-rules.ts";
import type {
  FinancialHealthMetric,
  FinancialHealthResult,
} from "./financial-health-types.ts";

export type FinancialHealthMetricStatusTone =
  | "attention"
  | "neutral"
  | "positive";

export type FinancialHealthMetricExplanation = {
  description: string;
  importance: string;
  title: string;
  usage: string;
};

export type FinancialHealthMetricPresentation = {
  explanation: FinancialHealthMetricExplanation;
  status: {
    label: string;
    tone: FinancialHealthMetricStatusTone;
  };
};

const explanations: Record<string, FinancialHealthMetricExplanation> = {
  ANNUAL_HOUSEHOLD_COSTS: {
    description:
      "Visar hushållets planerade kostnader under året, utan sparande och amortering.",
    importance:
      "Kostnadsnivån påverkar hur stor marginal och buffert hushållet normalt behöver.",
    title: "Årskostnader",
    usage:
      "Fameko använder kostnaderna för att bedöma kassaflöde, marginal och hur länge bufferten räcker.",
  },
  ANNUAL_INCOME: {
    description: "Visar hushållets sammanlagda planerade inkomster under året.",
    importance:
      "En stabil inkomstbas ger normalt bättre utrymme för kostnader, sparande och oväntade händelser.",
    title: "Årsinkomster",
    usage:
      "Fameko använder inkomsterna när årets kassaflöde, sparkvot och marginal bedöms.",
  },
  ANNUAL_MARGIN: {
    description:
      "Visar vad som återstår av årets planerade inkomster efter kostnader och sparande.",
    importance:
      "En positiv marginal ger normalt större utrymme att hantera förändringar under året.",
    title: "Årsmarginal",
    usage:
      "Fameko använder marginalen som en del av bedömningen av hushållets kassaflöde.",
  },
  ANNUAL_PLANNED_SAVINGS: {
    description: "Visar hur mycket som sammanlagt är planerat för sparande under året.",
    importance:
      "Regelbundet sparande kan över tid stärka både buffert och långsiktig motståndskraft.",
    title: "Planerat sparande",
    usage:
      "Fameko använder sparandet för att förstå sparvanan, men räknar det inte som en hushållskostnad.",
  },
  BUFFER_MONTHS: {
    description:
      "Visar ungefär hur många månaders planerade hushållskostnader den privata bufferten motsvarar.",
    importance:
      "En högre buffert ger normalt större utrymme att hantera inkomstbortfall och oväntade utgifter.",
    title: "Buffert i månader",
    usage:
      "Fameko använder buffertens räckvidd som en del av den samlade bedömningen.",
  },
  CAR_LOAN_TO_VALUE: {
    description: "Jämför den uppgivna bilskulden med bilens uppgivna värde.",
    importance:
      "Om skulden är hög i förhållande till värdet kan det minska handlingsutrymmet vid en försäljning.",
    title: "Bilskuld jämfört med bilvärde",
    usage:
      "Fameko använder relationen för att uppmärksamma när bilskulden överstiger det uppgivna värdet.",
  },
  CONSUMER_CREDIT_PAYMENTS: {
    description:
      "Visar årets planerade betalningar för identifierade privatlån och konsumentkrediter.",
    importance:
      "Sådana betalningar kan begränsa hushållets löpande ekonomiska handlingsutrymme.",
    title: "Betalningar för konsumentkrediter",
    usage:
      "Fameko använder betalningarna som en försiktig signal och antar inte skuldens storlek eller ränta.",
  },
  HOUSING_LTV: {
    description: "Visar hur stor del av bostadens uppgivna värde som är belånat.",
    importance:
      "En lägre belåningsgrad innebär ofta större motståndskraft mot ränteförändringar och prisfall.",
    title: "Belåningsgrad",
    usage:
      "Fameko använder belåningsgraden som en del av den samlade bedömningen.",
  },
  LIQUID_SAVINGS: {
    description: "Visar den privata buffert som har angetts som direkt tillgänglig.",
    importance:
      "En tillgänglig buffert kan ge handlingsutrymme när något oväntat påverkar ekonomin.",
    title: "Privat buffert",
    usage:
      "Fameko använder beloppet för att beräkna buffert i månader. Andra tillgångar räknas inte automatiskt som lika likvida.",
  },
  MORTGAGE_INTEREST_SHARE: {
    description:
      "Visar hur stor del av de planerade hushållskostnaderna som utgörs av bolåneränta.",
    importance:
      "En större ränteandel kan göra hushållets kostnadsbild mer känslig för ränteförändringar.",
    title: "Bolåneräntans kostnadsandel",
    usage:
      "Fameko använder andelen för att förklara boendets betydelse i den samlade kostnadsbilden.",
  },
  NEGATIVE_MONTHS: {
    description: "Visar hur många månader som har ett negativt planerat kassaflöde.",
    importance:
      "Flera negativa månader kan innebära att årets positiva delar behöver bära återkommande underskott.",
    title: "Negativa månader",
    usage:
      "Fameko använder antalet för att bedöma hur jämnt hushållets kassaflöde är över året.",
  },
  OTHER_FINANCIAL_ASSETS: {
    description: "Visar andra finansiella tillgångar som har lagts till i underlaget.",
    importance:
      "Ytterligare tillgångar kan bidra till hushållets långsiktiga ekonomiska grund.",
    title: "Andra finansiella tillgångar",
    usage:
      "Fameko tar med uppgiften i helhetsbilden men räknar den inte automatiskt som likvid buffert.",
  },
  PRIVATE_INVESTMENTS: {
    description: "Visar värdet av de privata investeringar som har angetts.",
    importance:
      "Investeringar kan stärka den långsiktiga ekonomin men värdet kan variera och tillgängligheten skilja sig åt.",
    title: "Privata investeringar",
    usage:
      "Fameko använder uppgiften i den långsiktiga helhetsbilden, inte som direkt tillgänglig buffert.",
  },
  PRIVATE_PENSION: {
    description: "Visar det privata pensionssparande som har angetts.",
    importance:
      "Ett långsiktigt pensionssparande kan komplettera hushållets framtida ekonomiska grund.",
    title: "Privat pensionssparande",
    usage:
      "Fameko behandlar uppgiften som långsiktig och räknar den inte som likvid buffert.",
  },
  SAVINGS_RATE: {
    description: "Visar hur stor andel av de planerade inkomsterna som går till sparande.",
    importance:
      "En återkommande sparkvot kan över tid stärka hushållets ekonomiska handlingsutrymme.",
    title: "Sparkvot",
    usage:
      "Fameko använder sparkvoten som en del av helhetsbilden, inte som ett fristående betyg.",
  },
};

function status(
  label: string,
  tone: FinancialHealthMetricStatusTone = "neutral",
) {
  return { label, tone };
}

function numericValue(metric: FinancialHealthMetric) {
  return metric.value ?? 0;
}

const statusResolvers: Record<
  string,
  (
    metric: FinancialHealthMetric,
    result: FinancialHealthResult,
  ) => FinancialHealthMetricPresentation["status"]
> = {
  ANNUAL_HOUSEHOLD_COSTS: () => status("Planerade hushållskostnader"),
  ANNUAL_INCOME: () => status("Planerade inkomster"),
  ANNUAL_MARGIN: (metric) =>
    numericValue(metric) > 0
      ? status("Positiv marginal", "positive")
      : numericValue(metric) < 0
        ? status("Negativ marginal", "attention")
        : status("Balanserad planering"),
  ANNUAL_PLANNED_SAVINGS: (metric) =>
    numericValue(metric) > 0
      ? status("Planerat sparande", "positive")
      : status("Inget planerat sparande"),
  BUFFER_MONTHS: (metric) =>
    metric.value === null
      ? status("Uppgift saknas")
      : metric.value < financialHealthRules.bufferMonths.lowBelow
        ? status("Begränsad buffert", "attention")
        : metric.value >= financialHealthRules.bufferMonths.resilientAtLeast
          ? status("Motståndskraftig buffert", "positive")
          : status("Viss buffert"),
  CAR_LOAN_TO_VALUE: (metric) =>
    numericValue(metric) > financialHealthRules.carLoanToValue.watchAbove
      ? status("Skuld över uppgivet värde", "attention")
      : status("Skuld inom uppgivet värde", "positive"),
  CONSUMER_CREDIT_PAYMENTS: () =>
    status("Planerade kreditbetalningar", "attention"),
  HOUSING_LTV: (metric) =>
    numericValue(metric) <=
    financialHealthRules.housingLoanToValue.resilientAtMost
      ? status("Relativt låg", "positive")
      : numericValue(metric) >
          financialHealthRules.housingLoanToValue.watchAbove
        ? status("Relativt hög", "attention")
        : status("Mellanläge"),
  LIQUID_SAVINGS: () => status("Likvid buffert registrerad", "positive"),
  MORTGAGE_INTEREST_SHARE: () => status("Del av kostnadsbilden"),
  NEGATIVE_MONTHS: (metric) =>
    numericValue(metric) === 0
      ? status("Inga negativa månader", "positive")
      : numericValue(metric) >=
          financialHealthRules.cashFlow.negativeMonthsWatchAtLeast
        ? status("Flera negativa månader", "attention")
        : status("En negativ månad"),
  OTHER_FINANCIAL_ASSETS: () => status("Tillgång registrerad", "positive"),
  PRIVATE_INVESTMENTS: () =>
    status("Långsiktig tillgång registrerad", "positive"),
  PRIVATE_PENSION: () =>
    status("Långsiktigt sparande registrerat", "positive"),
  SAVINGS_RATE: (metric, result) =>
    result.strengths.some(
      (item) => item.code === "REGULAR_PLANNED_SAVINGS",
    )
      ? status("Regelbundet sparande", "positive")
      : numericValue(metric) > 0
        ? status("Sparande finns planerat", "positive")
        : status("Ingen sparkvot"),
};

const fallbackExplanation: FinancialHealthMetricExplanation = {
  description: "Visar ett nyckeltal från hushållets planerade ekonomi.",
  importance: "Nyckeltalet bidrar med en del av hushållets ekonomiska helhetsbild.",
  title: "Ekonomiskt nyckeltal",
  usage: "Fameko använder uppgiften som en del av den samlade bedömningen.",
};

export function getFinancialHealthMetricPresentation(
  metric: FinancialHealthMetric,
  result: FinancialHealthResult,
): FinancialHealthMetricPresentation {
  return {
    explanation: explanations[metric.code] ?? {
      ...fallbackExplanation,
      title: metric.label,
    },
    status:
      metric.value === null
        ? status("Uppgift saknas")
        : (statusResolvers[metric.code]?.(metric, result) ??
          status("Ingår i helhetsbilden")),
  };
}
