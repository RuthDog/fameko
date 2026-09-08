import Image from "next/image";
import Link from "next/link";

const pilotEmail = "fameko.pilot@gmail.com";
const pilotSubject = "Pilotansökan – Fameko";
const pilotBody = `Hej!

Jag vill gärna testa Fameko.

Namn:

Vad hoppas du få hjälp med av Fameko?

Övrigt:

Tack!`;
const pilotHref = `mailto:${pilotEmail}?subject=${encodeURIComponent(pilotSubject)}&body=${encodeURIComponent(pilotBody)}`;

const outcomes = [
  {
    number: "01",
    title: "Planera",
    text: "Ge hela året en riktning innan vardagen hinner bestämma åt dig.",
  },
  {
    number: "02",
    title: "Förstå",
    text: "Se sambanden bakom siffrorna och vad som faktiskt påverkar helheten.",
  },
  {
    number: "03",
    title: "Kommunicera",
    text: "Samla ekonomin i ett underlag som är enkelt att dela och prata om.",
  },
  {
    number: "04",
    title: "Bygg framtiden",
    text: "Låt dagens beslut skapa utrymme för det ni vill göra längre fram.",
  },
];

type ProductFrameProps = {
  alt: string;
  className?: string;
  height: number;
  label: string;
  priority?: boolean;
  src: string;
  width: number;
};

function ProductFrame({
  alt,
  className = "",
  height,
  label,
  priority = false,
  src,
  width,
}: ProductFrameProps) {
  return (
    <figure
      className={`overflow-hidden rounded-[22px] border border-[#d8d7d1] bg-[#f8f7f3] shadow-[0_34px_90px_rgba(29,37,45,0.12),0_3px_12px_rgba(29,37,45,0.06)] sm:rounded-[30px] ${className}`}
    >
      <div
        aria-hidden="true"
        className="flex h-9 items-center gap-1.5 border-b border-[#e4e2dc] bg-white/80 px-4 sm:h-11 sm:px-5"
      >
        <span className="h-2 w-2 rounded-full bg-[#d1d0ca]" />
        <span className="h-2 w-2 rounded-full bg-[#d1d0ca]" />
        <span className="h-2 w-2 rounded-full bg-[#d1d0ca]" />
        <span className="ml-2 truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-[#8d9189] sm:text-[10px]">
          {label}
        </span>
      </div>
      <Image
        alt={alt}
        className="h-auto w-full"
        height={height}
        priority={priority}
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 92vw, 1200px"
        src={src}
        width={width}
      />
    </figure>
  );
}

function Wordmark() {
  return (
    <Image
      alt="Fameko"
      className="h-7 w-auto object-contain sm:h-8"
      height={724}
      priority
      src="/icons/fameko-app-icon-light.png.png"
      width={2172}
    />
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f3ed] text-[#1d252d]">
      <header className="sticky top-0 z-50 border-b border-[#d9d7d0]/70 bg-[#f5f3ed]/88 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between">
          <Link
            aria-label="Fameko – startsida"
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#657663]"
            href="/"
          >
            <Wordmark />
          </Link>
          <nav aria-label="Huvudnavigation" className="flex items-center gap-3 sm:gap-6">
            <a
              className="hidden text-sm font-medium text-[#596059] transition-colors hover:text-[#1d252d] sm:block"
              href="#upplevelsen"
            >
              Så fungerar det
            </a>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#c9c7c0] bg-white/60 px-5 text-sm font-semibold text-[#1d252d] transition hover:border-[#9fa49d] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#657663]"
              href="/app"
            >
              Logga in
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative px-5 pb-20 pt-20 text-center sm:px-8 sm:pb-28 sm:pt-28 lg:px-10 lg:pb-36 lg:pt-36" id="hero">
        <div aria-hidden="true" className="marketing-hero-glow" />
        <div className="relative mx-auto max-w-[1120px]">
          <p className="marketing-reveal text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f806c] sm:text-xs">
            Hushållets ekonomi, samlad
          </p>
          <h1 className="marketing-display-hero marketing-reveal marketing-delay-1 mx-auto mt-6 max-w-[1050px] font-semibold text-[#1d252d]">
            Hela ekonomin.
            <br />
            Äntligen begriplig.
          </h1>
          <p className="marketing-reveal marketing-delay-2 mx-auto mt-8 max-w-[690px] text-[18px] leading-8 text-[#62665f] sm:mt-10 sm:text-[22px] sm:leading-9">
            Fameko hjälper hushållet att planera året, förstå sambanden och
            fatta tryggare beslut om framtiden.
          </p>
          <div className="marketing-reveal marketing-delay-3 mt-9 flex flex-col items-stretch justify-center gap-3 sm:mt-11 sm:flex-row sm:items-center">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#1d252d] px-8 text-[15px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#2a343d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#657663]"
              href="/app"
            >
              Logga in
            </Link>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#c7c5bd] bg-white/70 px-8 text-[15px] font-semibold text-[#1d252d] transition hover:-translate-y-0.5 hover:border-[#9ea39b] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#657663]"
              href={pilotHref}
            >
              Ansök om pilotplats
            </a>
          </div>
        </div>

        <div className="marketing-reveal marketing-delay-4 relative mx-auto mt-16 max-w-[1280px] sm:mt-24 lg:mt-28">
          <div aria-hidden="true" className="absolute inset-x-[8%] bottom-[-4%] h-[35%] rounded-full bg-[#9eae99]/20 blur-3xl" />
          <ProductFrame
            alt="Famekos årsplanering med inkomster, utgifter och månadens balans samlad i en vy"
            className="marketing-product-float relative"
            height={900}
            label="Fameko / Årsplanering"
            priority
            src="/images/marketing/workspace-year.png"
            width={1440}
          />
        </div>
      </section>

      <section className="border-y border-[#d8d6cf] bg-[#eeece5] px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40">
        <div className="mx-auto max-w-[980px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#758272]">
            Mer än en budget
          </p>
          <h2 className="marketing-display-callout mt-6 font-semibold">
            Ekonomi är inte en lista över vad som redan har hänt.
          </h2>
          <p className="mx-auto mt-7 max-w-[700px] text-lg leading-8 text-[#666a63] sm:text-xl sm:leading-9">
            Den är alla val som ligger framför er. Fameko gör dem synliga,
            begripliga och möjliga att planera tillsammans.
          </p>
        </div>
      </section>

      <div id="upplevelsen">
        <section className="px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40" id="planera">
          <div className="mx-auto max-w-[1240px]">
            <div className="marketing-grid-story">
              <div className="lg:pb-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71806e]">
                  Planera hela året
                </p>
                <h2 className="marketing-display-section mt-5 font-semibold">
                  Se vart året är på väg.
                </h2>
                <p className="mt-7 max-w-[500px] text-lg leading-8 text-[#666a63] sm:text-xl sm:leading-9">
                  Samla återkommande beslut och kommande förändringar i en
                  gemensam plan. Justera en månad och förstå hur resten av året
                  påverkas.
                </p>
              </div>
              <ProductFrame
                alt="Famekos arbetsyta där sparande redigeras direkt i årsplaneringen"
                height={900}
                label="Fameko / Workspace"
                src="/images/marketing/workspace-planning.png"
                width={1440}
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-[#202a29] px-5 py-24 text-white sm:px-8 sm:py-32 lg:px-10 lg:py-40" id="forsta">
          <div className="mx-auto max-w-[1240px]">
            <div className="mx-auto max-w-[840px] text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#acbda8]">
                Förstå ekonomin
              </p>
              <h2 className="marketing-display-section mt-5 font-semibold">
                En tydlig bild. Och förklaringen bakom.
              </h2>
              <p className="mx-auto mt-7 max-w-[680px] text-lg leading-8 text-[#c8ceca] sm:text-xl sm:leading-9">
                Ekonomisk hälsa visar styrkor, sådant som behöver uppmärksamhet
                och varför. Utan poängjakt eller svårbegripliga modeller.
              </p>
            </div>
            <div className="relative mt-14 sm:mt-20">
              <div aria-hidden="true" className="absolute -inset-16 rounded-full bg-[#71866d]/20 blur-3xl" />
              <ProductFrame
                alt="Famekos vy för ekonomisk hälsa med styrkor, fokusområden och en tydlig förklaring av nyckeltalen"
                className="relative border-white/15 shadow-[0_38px_110px_rgba(0,0,0,0.34)]"
                height={1000}
                label="Fameko / Ekonomisk hälsa"
                src="/images/marketing/financial-health.png"
                width={1440}
              />
            </div>
          </div>
        </section>

        <section className="px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40" id="visa">
          <div className="mx-auto max-w-[1240px]">
            <div className="max-w-[930px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71806e]">
                Visa ekonomin
              </p>
              <h2 className="marketing-display-section mt-5 font-semibold">
                Ett dokument du faktiskt vill visa banken.
              </h2>
              <p className="mt-7 max-w-[670px] text-lg leading-8 text-[#666a63] sm:text-xl sm:leading-9">
                Hushållets ekonomiska översikt samlar helheten i ett lugnt,
                professionellt underlag — på skärmen och som PDF.
              </p>
            </div>

            <div className="marketing-grid-report mt-14 sm:mt-20">
              <ProductFrame
                alt="Sammanfattning i Hushållets ekonomiska översikt med hushåll, kassaflöde, tillgångar och skulder"
                height={1054}
                label="Fameko / Hushållets ekonomiska översikt"
                src="/images/marketing/financial-overview.png"
                width={960}
              />
              <div className="mx-auto w-[76%] max-w-[470px] rotate-[1.5deg] rounded-[8px] bg-white p-2 shadow-[0_34px_90px_rgba(29,37,45,0.2)] transition-transform duration-700 hover:rotate-0 sm:p-3 lg:w-full">
                <Image
                  alt="Första sidan i Famekos PDF-underlag för banken"
                  className="h-auto w-full rounded-[3px]"
                  height={1684}
                  sizes="(max-width: 1024px) 72vw, 420px"
                  src="/images/marketing/bank-report.png"
                  width={1191}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#e5ebe1] px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40" id="framtiden">
          <div className="marketing-grid-story mx-auto max-w-[1240px] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#62735f]">
                Bygg framtiden
              </p>
              <h2 className="marketing-display-section mt-5 font-semibold">
                Gör plats för det ni längtar efter.
              </h2>
              <p className="mt-7 max-w-[510px] text-lg leading-8 text-[#5e675c] sm:text-xl sm:leading-9">
                Sparande blir en del av årsplanen, inte det som råkar bli kvar.
                Se hur små beslut i dag skapar handlingsutrymme längre fram.
              </p>
            </div>
            <ProductFrame
              alt="Famekos årsplanering med ett sparmål infogat i kommande månader"
              height={900}
              label="Fameko / Sparande i planen"
              src="/images/marketing/workspace-planning.png"
              width={1440}
            />
          </div>
        </section>

        <section className="px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40" id="hushallet">
          <div className="mx-auto max-w-[1240px]">
            <div className="mx-auto max-w-[860px] text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71806e]">
                Hela hushållet
              </p>
              <h2 className="marketing-display-section mt-5 font-semibold">
                Fyra delar. En ekonomi.
              </h2>
              <p className="mx-auto mt-7 max-w-[690px] text-lg leading-8 text-[#666a63] sm:text-xl sm:leading-9">
                Boende, bil, sparande och hushållet självt hör ihop. Fameko ger
                varje del sin plats utan att tappa helheten.
              </p>
            </div>

            <div className="mt-14 sm:mt-20">
              <ProductFrame
                alt="Famekos fyra sammanhållna områden Boende, Bil, Sparande och Hushåll"
                height={1000}
                label="Fameko / Min ekonomi"
                src="/images/marketing/household-domains.png"
                width={1440}
              />
            </div>

            <div className="mt-12 grid items-center gap-10 sm:mt-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
              <div className="max-h-[680px] overflow-hidden rounded-[22px] border border-[#d8d7d1] bg-white shadow-[0_28px_80px_rgba(29,37,45,0.1)] sm:rounded-[30px]">
                <Image
                  alt="Hushållssidan med hushållsnamn, adress, antal vuxna och barn"
                  className="h-auto w-full"
                  height={1525}
                  sizes="(max-width: 1024px) 100vw, 680px"
                  src="/images/marketing/household-detail.png"
                  width={1425}
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71806e]">
                  Hushållets identitet
                </p>
                <h3 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl">
                  Gemensam information, registrerad en gång.
                </h3>
                <p className="mt-6 text-lg leading-8 text-[#666a63]">
                  Hushållsnamn, adress och storlek följer med genom planeringen
                  och in i översikten. Inga personprofiler — bara den kontext som
                  gör ekonomin tydligare.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="border-y border-[#d8d6cf] bg-[#eeece5] px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40">
        <div className="mx-auto max-w-[1240px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71806e]">
            Varför Fameko
          </p>
          <div className="mt-8 grid border-t border-[#cbc9c2] sm:grid-cols-2">
            {outcomes.map((outcome, index) => (
              <article
                className={`min-h-[250px] border-b border-[#cbc9c2] py-8 sm:min-h-[310px] sm:p-10 lg:p-14 ${
                  index % 2 === 1 ? "sm:border-l" : ""
                }`}
                key={outcome.title}
              >
                <p className="text-xs font-semibold tracking-[0.14em] text-[#879084]">
                  {outcome.number}
                </p>
                <h2 className="marketing-display-outcome mt-10 font-semibold">
                  {outcome.title}
                </h2>
                <p className="mt-5 max-w-[440px] text-base leading-7 text-[#666a63] sm:text-lg sm:leading-8">
                  {outcome.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#1d252d] px-5 py-28 text-center text-white sm:px-8 sm:py-40 lg:px-10 lg:py-48" id="pilot">
        <div aria-hidden="true" className="absolute left-1/2 top-0 h-[480px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#82917f]/20 blur-3xl" />
        <div className="relative mx-auto max-w-[900px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#afbeab]">
            Fameko
          </p>
          <h2 className="marketing-display-cta mt-6 font-semibold">
            Lite mer lugn i varje beslut.
          </h2>
          <p className="mx-auto mt-8 max-w-[620px] text-lg leading-8 text-[#c9cfcb] sm:text-xl sm:leading-9">
            Samla hushållets ekonomi, se framåt och skapa en plan som går att
            förstå — och leva med.
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:mt-12 sm:flex-row sm:items-center">
            <a
              className="marketing-pilot-button inline-flex min-h-12 items-center justify-center rounded-full px-8 text-[15px] font-semibold transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              href={pilotHref}
            >
              Ansök om pilotplats
            </a>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-8 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              href="/app"
            >
              Logga in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#1d252d] px-5 py-8 text-white sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 text-xs text-[#aeb5b1] sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold tracking-wide text-white">Fameko</p>
          <p>Hushållets ekonomi, tydligt framåt.</p>
          <p>© 2026</p>
        </div>
      </footer>
    </main>
  );
}
