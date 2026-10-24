import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fehler?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex flex-col justify-between bg-spruce-deep px-8 py-10 text-sand sm:px-14">
        <p className="font-serif text-4xl">Werkplan</p>
        <div className="max-w-xl py-16">
          <p className="text-sm uppercase tracking-[0.2em] text-sand/60">Handwerk</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-6xl">All-in-One für den Handwerksalltag, vom Erstkontakt bis zur Abrechnung.</h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-sand/75">
            Angebote, Baustelle, Zeiten, Plantafel und Rechnung in einer ruhigen Oberfläche. Die Demo gehört Bergmann Elektrotechnik in Dresden.
          </p>
        </div>
        <p className="text-xs text-sand/50">Passwort für alle Demo-Zugänge: baustelle</p>
      </section>
      <section className="flex items-center bg-paper px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <h2 className="font-serif text-3xl">Anmelden</h2>
          <p className="mt-2 mb-6 text-sm text-muted">Büro: lena.hoffmann@bergmann-elektro.example · Baustelle: jonas.weber@bergmann-elektro.example</p>
          <LoginForm fehler={params.fehler === "1"} nextPath={params.next} />
        </div>
      </section>
    </main>
  );
}
