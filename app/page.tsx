import Image from "next/image";
import Link from "next/link";

const principles = [
  {
    eyebrow: "Planera",
    text: "Se hela årets ekonomi.",
  },
  {
    eyebrow: "Fördela",
    text: "Bestäm vart pengarna ska gå innan de används.",
  },
  {
    eyebrow: "Följ upp",
    text: "Se direkt hur besluten påverkar resten av året.",
  },
];

function Wordmark() {
  return (
    <Image
      alt="Fameko"
      className="h-7 w-auto object-contain sm:h-8"
      height={40}
      priority
      src="/icons/fameko-app-icon-light.png.png"
      width={120}
    />
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f5ef] text-[#1c1917]">
      <header className="px-5 py-5 sm:px-8 sm:py-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between">
          <Link
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#657663]"
            href="/"
          >
            <Wordmark />
          </Link>
          <Link
            className="rounded-full px-1 py-2 text-sm font-medium text-[#1d252d] transition-colors hover:text-[#657663] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#657663]"
            href="/app"
          >
            Logga in
          </Link>
        </div>
      </header>

      <section className="px-5 pb-20 pt-24 text-center sm:px-8 sm:pb-28 sm:pt-32 lg:px-10 lg:pb-36 lg:pt-40">
        <div className="mx-auto max-w-[900px]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#768473]">
            Fameko
          </p>
          <h1 className="mx-auto mt-6 max-w-[820px] text-[clamp(2.7rem,7vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[#1d252d]">
            Familjens ekonomi,
            <br className="hidden sm:block" /> tydligt framåt.
          </h1>
          <div className="mx-auto mt-8 max-w-[620px] text-[17px] leading-7 text-stone-600 sm:mt-9 sm:text-xl sm:leading-8">
            <p>Planera hela årets ekonomi på ett lugnt, enkelt och modernt sätt.</p>
            <p>Fokusera på framtiden istället för historiken.</p>
          </div>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:mt-12 sm:flex-row sm:items-center">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#1d252d] px-7 text-[15px] font-medium text-white shadow-[0_1px_2px_rgba(28,25,23,0.14)] transition hover:bg-[#2a343d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#657663]"
              href="/app"
            >
              Logga in
            </Link>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-stone-300/90 bg-white/45 px-7 text-[15px] font-medium text-[#1d252d] transition hover:border-stone-400 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#657663]"
              href="#produkt"
            >
              Pilotversion
            </a>
          </div>
        </div>
      </section>

      <section className="px-5 sm:px-8 lg:px-10" aria-label="Produktprinciper">
        <div className="mx-auto grid max-w-[980px] border-y border-stone-300/70 sm:grid-cols-3">
          {principles.map((principle, index) => (
            <article
              className={`py-7 sm:px-8 sm:py-8 ${
                index > 0
                  ? "border-t border-stone-300/70 sm:border-l sm:border-t-0"
                  : ""
              }`}
              key={principle.eyebrow}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#768473]">
                {principle.eyebrow}
              </p>
              <p className="mt-3 max-w-[250px] text-[15px] leading-6 text-stone-700">
                {principle.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-3 pb-28 pt-24 sm:px-8 sm:pb-36 sm:pt-32 lg:px-10" id="produkt">
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-7 px-2 sm:mb-9 sm:px-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#768473]">
              Arbetsytan
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[#1d252d] sm:text-3xl">
              Ett år. En tydlig riktning.
            </h2>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-stone-300/80 bg-[#faf9f6] shadow-[0_26px_80px_rgba(48,43,36,0.12),0_2px_8px_rgba(48,43,36,0.06)] sm:rounded-[28px]">
            <div
              className="flex h-9 items-center gap-1.5 border-b border-stone-200/80 bg-white/70 px-4 sm:h-11 sm:px-5"
              aria-hidden="true"
            >
              <span className="h-2 w-2 rounded-full bg-stone-300" />
              <span className="h-2 w-2 rounded-full bg-stone-300" />
              <span className="h-2 w-2 rounded-full bg-stone-300" />
              <span className="ml-3 text-[10px] font-medium tracking-[0.04em] text-stone-400 sm:text-[11px]">
                FAMEKO / WORKSPACE 1.0
              </span>
            </div>
            <div className="relative h-[460px] bg-[#f7f5ef] sm:h-[570px] lg:h-[690px]">
              <iframe
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-[900px] w-full border-0 bg-[#f7f5ef]"
                loading="lazy"
                scrolling="no"
                src="/app"
                tabIndex={-1}
                title="Förhandsvisning av Famekos arbetsyta"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#f7f5ef] to-transparent sm:h-28" />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-300/70 px-5 py-7 sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-2 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-[#1d252d]">Fameko</p>
          <div className="flex items-center gap-4">
            <span>Workspace 1.0</span>
            <span>© 2026</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
