import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="max-w-md text-center">
        <p className="font-serif text-4xl">Werkplan</p>
        <h1 className="mt-4 text-2xl">Diese Seite gibt es nicht.</h1>
        <Link href="/" className="mt-6 inline-block font-semibold text-spruce">
          Zur Übersicht
        </Link>
      </div>
    </main>
  );
}
