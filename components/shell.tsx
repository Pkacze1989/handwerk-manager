"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, FolderKanban, HardHat, LayoutDashboard, Library, Receipt, Sparkles, Wallet, Wrench } from "lucide-react";

const office = [
  { href: "/", label: "Übersicht", icon: LayoutDashboard },
  { href: "/buero", label: "Büro", icon: Receipt },
  { href: "/projekte", label: "Projekte", icon: FolderKanban },
  { href: "/plantafel", label: "Plantafel", icon: CalendarRange },
  { href: "/baustelle", label: "Baustelle", icon: HardHat },
  { href: "/finanzen", label: "Finanzen", icon: Wallet },
  { href: "/stammdaten", label: "Stammdaten", icon: Library },
  { href: "/schnittstellen", label: "Schnittstellen", icon: Wrench },
  { href: "/ki/angebot", label: "KI-Assistent", icon: Sparkles },
];

const site = [
  { href: "/baustelle", label: "Heute" },
  { href: "/baustelle/zeit", label: "Zeit" },
  { href: "/baustelle/aufmass", label: "Aufmaß" },
  { href: "/baustelle/doku", label: "Doku" },
  { href: "/baustelle/anweisungen", label: "Aufgaben" },
];

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/baustelle") return pathname === "/baustelle";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({
  user,
  children,
}: {
  user: { name: string; role: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onSite = pathname.startsWith("/baustelle");

  if (onSite) {
    return (
      <div className="min-h-screen bg-paper">
        <header className="border-b border-line bg-spruce-deep text-sand">
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
            <div>
              <p className="font-serif text-xl">Werkplan</p>
              <p className="text-xs text-sand/70">Baustelle · {user.name}</p>
            </div>
            <Link href="/" className="rounded-full border border-white/20 px-3 py-1 text-xs">
              Büro
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-4 py-6 pb-28">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-white/95 backdrop-blur">
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {site.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-1 py-3 text-center text-xs font-semibold ${active(pathname, item.href) ? "text-spruce" : "text-muted"}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden bg-spruce-deep text-sand md:flex md:min-h-screen md:flex-col md:justify-between">
        <div>
          <div className="px-6 pb-4 pt-7">
            <p className="font-serif text-3xl">Werkplan</p>
            <p className="mt-2 text-xs leading-relaxed text-sand/70">Vom Erstkontakt bis zur Abrechnung.</p>
          </div>
          <nav className="px-3">
            {office.map((item) => {
              const Icon = item.icon;
              const on = active(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${on ? "bg-white text-spruce" : "text-sand/85 hover:bg-white/10"}`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-sand/60">{user.email}</p>
          <form method="post" action="/api/auth/logout" className="mt-3">
            <button className="text-xs font-semibold text-sand underline-offset-4 hover:underline">Abmelden</button>
          </form>
        </div>
      </aside>
      <div>
        <div className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="font-serif text-xl">Werkplan</p>
            <form method="post" action="/api/auth/logout">
              <button className="text-xs font-semibold text-spruce">Abmelden</button>
            </form>
          </div>
          <div className="flex gap-2 overflow-x-auto px-3 pb-3">
            {office.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${active(pathname, item.href) ? "bg-spruce text-white" : "bg-white text-ink"}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <main className="px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
