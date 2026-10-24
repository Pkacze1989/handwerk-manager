import { clockIn, clockOut, deleteTime } from "@/actions/site";
import { Elapsed } from "./elapsed";
import { formatBerlinDate, formatBerlinTime, hoursBetween } from "@/lib/format";
import { labelOf, TIME_TYPES } from "@/lib/labels";
import { btnDanger, btnPrimary, fieldClass, labelClass } from "./ui";

export function TimePanel({
  entries,
  projects,
  open,
  back,
}: {
  entries: {
    id: string;
    type: string;
    start: Date;
    end: Date | null;
    note: string | null;
    user: string;
    project: string | null;
  }[];
  projects: { id: string; title: string }[];
  open: { start: Date; type: string; project: string | null } | null;
  back: string;
}) {
  return (
    <div className="space-y-6">
      {open ? (
        <form action={clockOut} className="rounded-3xl bg-spruce px-5 py-4 text-sand">
          <input type="hidden" name="back" value={back} />
          <p className="text-xs uppercase tracking-[0.16em] text-sand/70">Läuft · {labelOf(TIME_TYPES, open.type)}</p>
          <p className="mt-1 font-serif text-4xl">
            <Elapsed start={open.start.toISOString()} />
          </p>
          <p className="text-sm text-sand/80">{open.project ?? "Ohne Projekt"}</p>
          <button className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-spruce">Ausstempeln</button>
        </form>
      ) : (
        <form action={clockIn} className="grid gap-3 rounded-3xl border border-line bg-white p-4">
          <input type="hidden" name="back" value={back} />
          <label>
            <span className={labelClass}>Art</span>
            <select className={fieldClass} name="type" defaultValue="ARBEIT">
              {TIME_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Projekt</span>
            <select className={fieldClass} name="projectId">
              <option value="">Kein Projekt</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Notiz</span>
            <input className={fieldClass} name="note" />
          </label>
          <button className={btnPrimary}>Kommen</button>
        </form>
      )}
      <ul className="space-y-2">
        {entries.map((entry) => {
          const end = entry.end ?? new Date();
          const hours = entry.end ? hoursBetween(entry.start, end) : null;
          return (
            <li key={entry.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold">
                  {labelOf(TIME_TYPES, entry.type)} · {entry.user}
                </p>
                <p className="text-xs text-muted">
                  {formatBerlinDate(entry.start)} {formatBerlinTime(entry.start)}
                  {entry.end ? `–${formatBerlinTime(entry.end)}` : " · läuft"}
                  {hours !== null ? ` · ${hours.toLocaleString("de-DE", { maximumFractionDigits: 2 })} h` : ""}
                </p>
                <p className="text-xs text-muted">{entry.project}</p>
                {entry.note ? <p className="text-sm">{entry.note}</p> : null}
              </div>
              <form action={deleteTime}>
                <input type="hidden" name="id" value={entry.id} />
                <input type="hidden" name="back" value={back} />
                <button className={btnDanger}>Löschen</button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
