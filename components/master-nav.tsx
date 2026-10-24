import Link from "next/link";

const links = [
  ["/stammdaten/betrieb", "Betrieb"],
  ["/stammdaten/kunden", "Kunden"],
  ["/stammdaten/lieferanten", "Lieferanten"],
  ["/stammdaten/material", "Material"],
  ["/stammdaten/leistungen", "Leistungen"],
  ["/stammdaten/team", "Team"],
];

export function MasterNav({ current }: { current: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {links.map(([href, label]) => (
        <Link key={href} href={href} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${current === href ? "bg-spruce text-white" : "bg-white text-ink"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
