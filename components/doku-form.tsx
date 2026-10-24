import { addSiteLog } from "@/actions/site";
import { LOG_KINDS } from "@/lib/labels";
import { berlinToday } from "@/lib/format";
import { SignaturePad } from "./signature-pad";
import { btnPrimary, fieldClass, labelClass } from "./ui";

export function DokuForm({ projectId, back }: { projectId: string; back: string }) {
  return (
    <form action={addSiteLog} className="grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="back" value={back} />
      <label>
        <span className={labelClass}>Art</span>
        <select className={fieldClass} name="kind">
          {LOG_KINDS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={labelClass}>Datum</span>
        <input className={fieldClass} type="date" name="date" defaultValue={berlinToday()} />
      </label>
      <label>
        <span className={labelClass}>Bericht</span>
        <textarea className={fieldClass} name="text" rows={4} required placeholder="Was wurde heute geschafft?" />
      </label>
      <label>
        <span className={labelClass}>Wetter</span>
        <input className={fieldClass} name="weather" placeholder="trocken, 12 °C" />
      </label>
      <label>
        <span className={labelClass}>Material</span>
        <textarea className={fieldClass} name="materials" rows={3} placeholder="Eine Zeile je Material" />
      </label>
      <label>
        <span className={labelClass}>Stunden</span>
        <input className={fieldClass} name="hours" type="number" step="0.25" />
      </label>
      <label>
        <span className={labelClass}>Fotos</span>
        <input className={fieldClass} name="photos" type="file" accept="image/*" multiple />
      </label>
      <label>
        <span className={labelClass}>Unterschrift von</span>
        <input className={fieldClass} name="signerName" placeholder="Name der unterschreibenden Person" />
      </label>
      <label>
        <span className={labelClass}>Rolle</span>
        <input className={fieldClass} name="role" placeholder="Bauleitung, Kunde, Monteur" />
      </label>
      <SignaturePad />
      <button className={btnPrimary}>Bericht speichern</button>
    </form>
  );
}
