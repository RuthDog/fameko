import Link from "next/link";

export default function AccountDeletedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 px-4 text-stone-900">
      <section className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Fameko</p>
        <h1 className="mt-3 text-3xl font-semibold">Kontot har raderats</h1>
        <p className="mt-4 text-sm leading-6 text-stone-600">
          Du är utloggad. Om du vill använda Fameko igen behöver du registrera ett nytt konto.
        </p>
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-full bg-stone-900 px-5 font-semibold text-white" href="/">
          Till startsidan
        </Link>
      </section>
    </main>
  );
}
