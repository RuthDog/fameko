export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#111111]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="w-full max-w-2xl rounded-[32px] border border-black/5 bg-white px-8 py-14 shadow-[0_24px_80px_rgba(17,17,17,0.08)] sm:px-14 sm:py-16">
          <h1 className="text-5xl font-semibold tracking-normal text-balance sm:text-7xl">
            Fameko
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-xl leading-8 text-neutral-600 sm:text-2xl">
            Hushållsekonomi på ett enklare sätt.
          </p>
          <p className="mt-5 text-sm font-medium text-neutral-500">
            Version 0 – utveckling pågår.
          </p>
          <button
            className="mt-10 rounded-full bg-[#111111] px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900"
            type="button"
          >
            Kommer snart
          </button>
        </div>
      </section>
    </main>
  );
}
