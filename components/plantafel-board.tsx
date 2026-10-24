"use client";

import { useState, useTransition } from "react";
import { createAssignment, deleteAssignment, moveAssignment } from "@/actions/planning";
import { formatDate } from "@/lib/format";
import { btnGhost, btnPrimary, fieldClass, labelClass } from "./ui";

type Resource = { id: string; name: string; type: string; color: string };
type Project = { id: string; number: string; title: string };
type Assignment = {
  id: string;
  resourceId: string;
  projectId: string;
  start: string;
  end: string;
  name: string;
  color: string;
  note: string;
};

export function PlantafelBoard({
  weekStart,
  days,
  resources,
  projects,
  assignments,
  back,
}: {
  weekStart: string;
  days: { iso: string; label: string }[];
  resources: Resource[];
  projects: Project[];
  assignments: Assignment[];
  back: string;
}) {
  const weekEnd = days[days.length - 1]?.iso ?? weekStart;
  const [pending, setPending] = useState<{ resourceId: string; projectId: string; start: string; name: string } | null>(null);
  const [message, setMessage] = useState("");
  const [, startTransition] = useTransition();

  function onDrop(event: React.DragEvent, projectId: string, day: string) {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (payload.startsWith("resource:")) {
      const resourceId = payload.slice("resource:".length);
      const resource = resources.find((entry) => entry.id === resourceId);
      setPending({ resourceId, projectId, start: day, name: resource?.name ?? "Ressource" });
      setMessage("");
      return;
    }
    if (payload.startsWith("assignment:")) {
      const id = payload.slice("assignment:".length);
      const data = new FormData();
      data.set("id", id);
      data.set("projectId", projectId);
      data.set("startDate", day);
      data.set("back", back);
      startTransition(async () => {
        await moveAssignment(data);
      });
    }
  }

  const groups = [
    ["MITARBEITER", "Mitarbeiter"],
    ["KOLONNE", "Kolonnen"],
    ["MASCHINE", "Maschinen"],
    ["FAHRZEUG", "Fahrzeuge"],
  ] as const;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Mitarbeiter, Kolonnen, Maschinen und Fahrzeuge auf eine Baustelle und einen Tag ziehen. Das Ende des Zeitraums legen Sie danach fest.</p>
      <div className="flex flex-wrap gap-2">
        {groups.map(([type, label]) => (
          <div key={type} className="rounded-2xl border border-line bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
            <div className="flex flex-wrap gap-2">
              {resources
                .filter((resource) => resource.type === type)
                .map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", `resource:${resource.id}`)}
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ background: resource.color }}
                  >
                    {resource.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {pending ? (
        <form action={createAssignment} className="grid gap-3 rounded-3xl border border-copper/30 bg-copper-soft p-4 md:grid-cols-5">
          <input type="hidden" name="resourceId" value={pending.resourceId} />
          <input type="hidden" name="projectId" value={pending.projectId} />
          <input type="hidden" name="startDate" value={pending.start} />
          <input type="hidden" name="back" value={back} />
          <p className="md:col-span-5 text-sm">
            <strong>{pending.name}</strong> auf {projects.find((project) => project.id === pending.projectId)?.title} ab {formatDate(`${pending.start}T00:00:00.000Z`)}
          </p>
          <label>
            <span className={labelClass}>Ende</span>
            <input className={fieldClass} type="date" name="endDate" defaultValue={pending.start} required />
          </label>
          <label className="md:col-span-2">
            <span className={labelClass}>Notiz</span>
            <input className={fieldClass} name="note" />
          </label>
          <div className="flex items-end gap-2">
            <button className={btnPrimary}>Einplanen</button>
            <button type="button" className={btnGhost} onClick={() => setPending(null)}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-3xl border border-line bg-white">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[220px_repeat(7,1fr)] border-b border-line bg-sand text-xs font-semibold uppercase tracking-wide text-muted">
            <div className="px-4 py-3">Baustelle</div>
            {days.map((day) => (
              <div key={day.iso} className="px-2 py-3">
                {day.label}
                <div className="font-normal normal-case text-ink">{day.iso.slice(8, 10)}.{day.iso.slice(5, 7)}.</div>
              </div>
            ))}
          </div>
          {projects.map((project) => (
            <div key={project.id} className="grid grid-cols-[220px_repeat(7,1fr)] border-b border-line last:border-b-0">
              <div className="px-4 py-3">
                <p className="text-sm font-semibold">{project.title}</p>
                <p className="text-xs text-muted">{project.number}</p>
              </div>
              <div className="relative col-span-7 grid grid-cols-7">
                {days.map((day) => (
                  <div
                    key={day.iso}
                    className="min-h-16 border-l border-line"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => onDrop(event, project.id, day.iso)}
                  />
                ))}
                {assignments
                  .filter((assignment) => assignment.projectId === project.id && assignment.end >= weekStart && assignment.start <= weekEnd)
                  .map((assignment) => {
                    const start = assignment.start < weekStart ? weekStart : assignment.start;
                    const end = assignment.end > weekEnd ? weekEnd : assignment.end;
                    const startIndex = days.findIndex((day) => day.iso === start);
                    const endIndex = days.findIndex((day) => day.iso === end);
                    if (startIndex < 0 || endIndex < 0) return null;
                    return (
                      <div
                        key={assignment.id}
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", `assignment:${assignment.id}`)}
                        className="absolute top-2 flex h-11 items-center justify-between gap-2 overflow-hidden rounded-xl px-2 text-xs font-semibold text-white"
                        style={{
                          background: assignment.color,
                          left: `${(startIndex / 7) * 100}%`,
                          width: `${((endIndex - startIndex + 1) / 7) * 100}%`,
                        }}
                        title={assignment.note}
                      >
                        <span className="truncate">{assignment.name}</span>
                        <form action={deleteAssignment}>
                          <input type="hidden" name="id" value={assignment.id} />
                          <input type="hidden" name="back" value={back} />
                          <button className="rounded-full bg-black/20 px-1.5" aria-label="Einsatz entfernen">
                            ×
                          </button>
                        </form>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
