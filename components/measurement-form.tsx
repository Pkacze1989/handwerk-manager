"use client";

import { useMemo, useState } from "react";
import { addMeasurement } from "@/actions/site";
import { evaluateExpression } from "@/lib/expr";
import { MEASURE_KINDS } from "@/lib/labels";
import { btnPrimary, fieldClass, labelClass } from "./ui";

export function MeasurementForm({ projectId, back }: { projectId: string; back: string }) {
  const [kind, setKind] = useState("FLAECHE");
  const [formula, setFormula] = useState("(l + 0.1) * b");
  const [vars, setVars] = useState([
    { name: "l", value: "4" },
    { name: "b", value: "3" },
  ]);
  const [values, setValues] = useState({ laenge: "5", l: "4", b: "3", h: "2.5", n: "1" });
  const [error, setError] = useState("");

  const preview = useMemo(() => {
    try {
      if (kind === "LAENGE") return evaluateExpression("laenge", { laenge: Number(values.laenge) });
      if (kind === "FLAECHE") return evaluateExpression("l * b", { l: Number(values.l), b: Number(values.b) });
      if (kind === "VOLUMEN") return evaluateExpression("l * b * h", { l: Number(values.l), b: Number(values.b), h: Number(values.h) });
      if (kind === "STUECK") return evaluateExpression("n", { n: Number(values.n) });
      const inputs = Object.fromEntries(vars.filter((entry) => entry.name).map((entry) => [entry.name, Number(entry.value)]));
      return evaluateExpression(formula, inputs);
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Formel ungültig";
    }
  }, [kind, formula, vars, values]);

  return (
    <form action={addMeasurement} className="space-y-3" onSubmit={() => setError(typeof preview === "string" ? preview : "")}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="back" value={back} />
      <label>
        <span className={labelClass}>Bezeichnung</span>
        <input className={fieldClass} name="title" required placeholder="z. B. Wohnzimmer Decke" />
      </label>
      <label>
        <span className={labelClass}>Art</span>
        <select className={fieldClass} name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          {MEASURE_KINDS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {kind === "LAENGE" ? <NumberField name="laenge" label="Länge" value={values.laenge} onChange={(value) => setValues({ ...values, laenge: value })} /> : null}
      {kind === "FLAECHE" || kind === "VOLUMEN" ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField name="l" label="Länge" value={values.l} onChange={(value) => setValues({ ...values, l: value })} />
          <NumberField name="b" label="Breite" value={values.b} onChange={(value) => setValues({ ...values, b: value })} />
        </div>
      ) : null}
      {kind === "VOLUMEN" ? <NumberField name="h" label="Höhe" value={values.h} onChange={(value) => setValues({ ...values, h: value })} /> : null}
      {kind === "STUECK" ? <NumberField name="n" label="Anzahl" value={values.n} onChange={(value) => setValues({ ...values, n: value })} /> : null}
      {kind === "FORMEL" ? (
        <div className="space-y-2">
          <label>
            <span className={labelClass}>Formel</span>
            <input className={fieldClass} name="formula" value={formula} onChange={(event) => setFormula(event.target.value)} />
          </label>
          <p className="text-xs text-muted">Erlaubt sind Zahlen, Namen, Klammern und + − * /. Kein JavaScript.</p>
          {vars.map((entry, index) => (
            <div key={index} className="grid grid-cols-2 gap-2">
              <input className={fieldClass} name="varName" value={entry.name} onChange={(event) => setVars(vars.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)))} />
              <input className={fieldClass} name="varValue" value={entry.value} onChange={(event) => setVars(vars.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))} />
            </div>
          ))}
          <button type="button" className="text-xs font-semibold text-spruce" onClick={() => setVars([...vars, { name: "", value: "0" }])}>
            Größe hinzufügen
          </button>
        </div>
      ) : null}
      <label>
        <span className={labelClass}>Einheit</span>
        <input className={fieldClass} name="unit" defaultValue={kind === "FLAECHE" ? "m²" : kind === "VOLUMEN" ? "m³" : kind === "STUECK" ? "Stk" : "m"} />
      </label>
      <p className="rounded-2xl bg-sand px-3 py-2 text-sm">
        Ergebnis: <strong>{typeof preview === "number" ? preview.toLocaleString("de-DE", { maximumFractionDigits: 3 }) : preview}</strong>
      </p>
      {error ? <p className="text-sm text-bad">{error}</p> : null}
      <button className={btnPrimary} disabled={typeof preview === "string"}>
        Aufmaß speichern
      </button>
    </form>
  );
}

function NumberField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <input className={fieldClass} name={name} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
