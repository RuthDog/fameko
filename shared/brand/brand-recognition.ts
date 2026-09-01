export type BrandDefinition = {
  aliases: readonly string[];
  allowPlanSuffixes?: boolean;
  brandKey: string;
  displayName: string;
  domain: string;
};

export type BrandResolution =
  | {
      brandKey: string;
      displayName: string;
      domain: string;
      recognized: true;
    }
  | { recognized: false };

const planSuffixes = new Set([
  "basic",
  "duo",
  "familj",
  "familjekonto",
  "family",
  "plus",
  "premium",
  "standard",
  "student",
]);

export const brandLibrary: readonly BrandDefinition[] = [
  { aliases: ["spotify"], allowPlanSuffixes: true, brandKey: "spotify", displayName: "Spotify", domain: "spotify.com" },
  { aliases: ["netflix"], allowPlanSuffixes: true, brandKey: "netflix", displayName: "Netflix", domain: "netflix.com" },
  { aliases: ["disney+", "disney plus"], allowPlanSuffixes: true, brandKey: "disney-plus", displayName: "Disney+", domain: "disneyplus.com" },
  { aliases: ["max", "hbo max"], brandKey: "max", displayName: "Max", domain: "max.com" },
  { aliases: ["tv4 play", "tv4play"], allowPlanSuffixes: true, brandKey: "tv4-play", displayName: "TV4 Play", domain: "tv4play.se" },
  { aliases: ["viaplay"], allowPlanSuffixes: true, brandKey: "viaplay", displayName: "Viaplay", domain: "viaplay.se" },
  { aliases: ["youtube premium", "youtube"], brandKey: "youtube", displayName: "YouTube", domain: "youtube.com" },
  { aliases: ["apple", "apple music", "icloud", "icloud+"], brandKey: "apple", displayName: "Apple", domain: "apple.com" },
  { aliases: ["google one"], allowPlanSuffixes: true, brandKey: "google-one", displayName: "Google One", domain: "google.com" },
  { aliases: ["amazon prime", "prime video"], brandKey: "amazon-prime", displayName: "Amazon Prime", domain: "amazon.se" },
  { aliases: ["microsoft 365", "office 365"], brandKey: "microsoft", displayName: "Microsoft", domain: "microsoft.com" },
  { aliases: ["dropbox"], allowPlanSuffixes: true, brandKey: "dropbox", displayName: "Dropbox", domain: "dropbox.com" },
  { aliases: ["storytel"], allowPlanSuffixes: true, brandKey: "storytel", displayName: "Storytel", domain: "storytel.com" },
  { aliases: ["bookbeat"], allowPlanSuffixes: true, brandKey: "bookbeat", displayName: "BookBeat", domain: "bookbeat.com" },
  { aliases: ["nextory"], allowPlanSuffixes: true, brandKey: "nextory", displayName: "Nextory", domain: "nextory.se" },
  { aliases: ["podme", "podme premium"], brandKey: "podme", displayName: "Podme", domain: "podme.com" },
  { aliases: ["telia"], brandKey: "telia", displayName: "Telia", domain: "telia.se" },
  { aliases: ["tele2"], brandKey: "tele2", displayName: "Tele2", domain: "tele2.se" },
  { aliases: ["telenor"], brandKey: "telenor", displayName: "Telenor", domain: "telenor.se" },
  { aliases: ["tre", "3 sverige"], brandKey: "tre", displayName: "Tre", domain: "tre.se" },
  { aliases: ["hallon"], brandKey: "hallon", displayName: "Hallon", domain: "hallon.se" },
  { aliases: ["vimla"], brandKey: "vimla", displayName: "Vimla", domain: "vimla.se" },
  { aliases: ["comviq"], brandKey: "comviq", displayName: "Comviq", domain: "comviq.se" },
  { aliases: ["fello"], brandKey: "fello", displayName: "Fello", domain: "fello.se" },
  { aliases: ["länsförsäkringar", "lansforsakringar", "lf försäkring"], brandKey: "lansforsakringar", displayName: "Länsförsäkringar", domain: "lansforsakringar.se" },
  { aliases: ["folksam"], brandKey: "folksam", displayName: "Folksam", domain: "folksam.se" },
  { aliases: ["if", "if försäkring"], brandKey: "if", displayName: "If", domain: "if.se" },
  { aliases: ["trygg-hansa", "trygg hansa"], brandKey: "trygg-hansa", displayName: "Trygg-Hansa", domain: "trygghansa.se" },
  { aliases: ["agria"], brandKey: "agria", displayName: "Agria", domain: "agria.se" },
  { aliases: ["dina försäkringar", "dina forsakringar"], brandKey: "dina-forsakringar", displayName: "Dina Försäkringar", domain: "dina.se" },
  { aliases: ["vattenfall"], brandKey: "vattenfall", displayName: "Vattenfall", domain: "vattenfall.se" },
  { aliases: ["e.on", "eon"], brandKey: "eon", displayName: "E.ON", domain: "eon.se" },
  { aliases: ["fortum"], brandKey: "fortum", displayName: "Fortum", domain: "fortum.se" },
  { aliases: ["tibber"], brandKey: "tibber", displayName: "Tibber", domain: "tibber.com" },
  { aliases: ["klarna"], brandKey: "klarna", displayName: "Klarna", domain: "klarna.com" },
  { aliases: ["csn"], brandKey: "csn", displayName: "CSN", domain: "csn.se" },
  { aliases: ["swedbank"], brandKey: "swedbank", displayName: "Swedbank", domain: "swedbank.se" },
  { aliases: ["seb"], brandKey: "seb", displayName: "SEB", domain: "seb.se" },
  { aliases: ["handelsbanken"], brandKey: "handelsbanken", displayName: "Handelsbanken", domain: "handelsbanken.se" },
  { aliases: ["nordea"], brandKey: "nordea", displayName: "Nordea", domain: "nordea.se" },
  { aliases: ["ica banken", "icabanken"], brandKey: "ica-banken", displayName: "ICA Banken", domain: "icabanken.se" },
  { aliases: ["sj"], brandKey: "sj", displayName: "SJ", domain: "sj.se" },
  { aliases: ["sl", "sl-kort"], brandKey: "sl", displayName: "SL", domain: "sl.se" },
  { aliases: ["dn", "dagens nyheter"], brandKey: "dn", displayName: "Dagens Nyheter", domain: "dn.se" },
  { aliases: ["svd", "svenska dagbladet"], brandKey: "svd", displayName: "Svenska Dagbladet", domain: "svd.se" },
] as const;

export function normalizeBrandLabel(label: string): string {
  return label.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
}

function matchesBrandAlias(
  normalizedLabel: string,
  normalizedAlias: string,
  allowPlanSuffixes: boolean,
): boolean {
  if (normalizedLabel === normalizedAlias) {
    return true;
  }

  if (!allowPlanSuffixes || !normalizedLabel.startsWith(`${normalizedAlias} `)) {
    return false;
  }

  return planSuffixes.has(normalizedLabel.slice(normalizedAlias.length + 1));
}

export function resolveBrand(label: string): BrandResolution {
  const normalizedLabel = normalizeBrandLabel(label);

  if (!normalizedLabel) {
    return { recognized: false };
  }

  for (const brand of brandLibrary) {
    const recognized = brand.aliases.some((alias) =>
      matchesBrandAlias(
        normalizedLabel,
        normalizeBrandLabel(alias),
        brand.allowPlanSuffixes === true,
      ),
    );

    if (recognized) {
      return {
        brandKey: brand.brandKey,
        displayName: brand.displayName,
        domain: brand.domain,
        recognized: true,
      };
    }
  }

  return { recognized: false };
}

export function buildLogoDevUrl(
  domain: string,
  publishableKey: string | undefined,
  size = 20,
): string | null {
  const normalizedDomain = domain.trim().toLocaleLowerCase("en-US");
  const normalizedKey = publishableKey?.trim();

  if (
    !normalizedKey?.startsWith("pk_") ||
    !/^[a-z0-9.-]+$/.test(normalizedDomain) ||
    normalizedDomain.includes("..")
  ) {
    return null;
  }

  const normalizedSize = Math.min(80, Math.max(16, Math.round(size)));
  const url = new URL(`https://img.logo.dev/${normalizedDomain}`);
  url.searchParams.set("token", normalizedKey);
  url.searchParams.set("size", String(normalizedSize));
  url.searchParams.set("retina", "true");
  url.searchParams.set("format", "png");
  url.searchParams.set("theme", "light");
  url.searchParams.set("fallback", "404");
  return url.toString();
}
