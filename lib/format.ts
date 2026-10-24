import { round2 } from "./money";

export function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" })
    .format(round2(value))
    .replace(/\u202f|\u00a0/g, " ");
}

export function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatBerlinDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatBerlinTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatBerlinDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return `${formatBerlinDate(value)} ${formatBerlinTime(value)}`;
}

export function berlinToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDaysISO(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mondayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDaysISO(iso, diff);
}

export function weekdayLabel(iso: string, width: "short" | "long" = "short") {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { weekday: width, timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function parseDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateInputValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function hoursBetween(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
}

export function greeting(name: string) {
  const hour = Number(
    new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const hello = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";
  const first = name.split(" ")[0];
  return `${hello}, ${first}`;
}

export function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
