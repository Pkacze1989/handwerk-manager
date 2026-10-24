"use client";

import { useState } from "react";
import { fileReception } from "@/actions/ai";
import { URGENCY } from "@/lib/labels";
import { btnPrimary, fieldClass, labelClass } from "./ui";

const scenarios = [
  { callerName: "Herr Petzold", phone: "0351 445566", concern: "Herd ohne Funktion, der FI-Schutzschalter fällt sofort.", urgency: "NOTDIENST" },
  { callerName: "Frau Nguyen", phone: "0172 8801122", concern: "Steckdose in der Küche schmort, es riecht nach Kunststoff.", urgency: "HOCH" },
  { callerName: "Hausmeister Brückner", phone: "0351 889900", concern: "Im Treppenhaus sind drei Leuchten ausgefallen.", urgency: "NORMAL" },
];

export function ReceptionDesk({
  customers,
  projects,
}: {
  customers: { id: string; name: string }[];
  projects: { id: string; title: string; customerId: string }[];
}) {
  const [ringing, setRinging] = useState(false);
  const [caller, setCaller] = useState(scenarios[0]);
  const [customerId, setCustomerId] = useState("");

  function simulate() {
    const next = scenarios[Math.floor(Math.random() * scenarios.length)];
    setRinging(true);
    window.setTimeout(() => {
      setCaller(next);
      setRinging(false);
    }, 900);
  }

  return (
    <div className="space-y-4">
      <button type="button" className={btnPrimary} onClick={simulate}>
        Anruf simulieren
      </button>
      <div className={`rounded-3xl border px-5 py-6 ${ringing ? "border-copper bg-copper-soft" : "border-line bg-sand"}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-copper">{ringing ? "Es klingelt" : "Leitung offen"}</p>
        <p className="mt-2 font-serif text-3xl">{ringing ? "Unbekannt" : caller.callerName}</p>
        <p className="text-sm text-muted">{ringing ? "Virtueller Empfang, keine Telefonanlage." : caller.phone}</p>
      </div>
      <form action={fileReception} className="grid gap-3">
        <label>
          <span className={labelClass}>Name</span>
          <input className={fieldClass} name="callerName" value={caller.callerName} onChange={(event) => setCaller({ ...caller, callerName: event.target.value })} required />
        </label>
        <label>
          <span className={labelClass}>Telefon</span>
          <input className={fieldClass} name="phone" value={caller.phone} onChange={(event) => setCaller({ ...caller, phone: event.target.value })} />
        </label>
        <label>
          <span className={labelClass}>Anliegen</span>
          <textarea className={fieldClass} name="concern" rows={4} value={caller.concern} onChange={(event) => setCaller({ ...caller, concern: event.target.value })} required />
        </label>
        <label>
          <span className={labelClass}>Dringlichkeit</span>
          <select className={fieldClass} name="urgency" value={caller.urgency} onChange={(event) => setCaller({ ...caller, urgency: event.target.value })}>
            {URGENCY.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Bekannter Kunde</span>
          <select className={fieldClass} name="customerId" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Neu anlegen oder über Telefon finden</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Projekt</span>
          <select className={fieldClass} name="projectId" defaultValue="">
            <option value="">Neues Projekt aus dem Anliegen</option>
            {projects
              .filter((project) => !customerId || project.customerId === customerId)
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
          </select>
        </label>
        <button className={btnPrimary}>Anliegen ablegen</button>
      </form>
    </div>
  );
}
