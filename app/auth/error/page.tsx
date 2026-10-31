type AuthenticationErrorPageProps = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function AuthenticationErrorPage({
  searchParams,
}: AuthenticationErrorPageProps) {
  const { ref } = await searchParams;
  const correlationId = ref && /^[0-9a-f-]{36}$/iu.test(ref) ? ref : undefined;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5ef] px-5 text-[#1d252d]">
      <section className="w-full max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#657663]">
          Fameko
        </p>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">
          Inloggningen kunde inte slutföras
        </h1>
        <p className="mt-4 leading-7 text-stone-600">
          Försök igen om en liten stund. Inga tekniska detaljer eller kontouppgifter
          visas här.
        </p>
        {correlationId ? (
          <p className="mt-3 text-sm text-stone-500">
            Referens: <code>{correlationId}</code>
          </p>
        ) : null}
        <a
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#1d252d] px-6 font-semibold text-white"
          href="/sign-up"
        >
          B&ouml;rja om registreringen
        </a>
        <a
          className="mt-3 inline-flex min-h-12 items-center justify-center rounded-full border border-stone-300 px-6 font-semibold"
          href="/sign-in"
        >
          Försök logga in igen
        </a>
      </section>
    </main>
  );
}
