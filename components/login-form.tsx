"use client";

import { useRef } from "react";
import { btnGhost, btnPrimary, fieldClass, labelClass } from "./ui";

export function LoginForm({ fehler, nextPath }: { fehler: boolean; nextPath?: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  function enter(email: string, target: string) {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("email") as HTMLInputElement).value = email;
    (form.elements.namedItem("password") as HTMLInputElement).value = "baustelle";
    (form.elements.namedItem("next") as HTMLInputElement).value = target;
    form.requestSubmit();
  }

  return (
    <form ref={formRef} method="post" action="/api/auth/login" className="space-y-4">
      <input type="hidden" name="next" defaultValue={nextPath || "/"} />
      {fehler ? <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-bad">E-Mail oder Passwort ist nicht korrekt.</p> : null}
      <label className="block">
        <span className={labelClass}>E-Mail</span>
        <input className={fieldClass} name="email" type="email" autoComplete="username" required defaultValue="lena.hoffmann@bergmann-elektro.example" />
      </label>
      <label className="block">
        <span className={labelClass}>Passwort</span>
        <input className={fieldClass} name="password" type="password" autoComplete="current-password" required defaultValue="baustelle" />
      </label>
      <button className={`${btnPrimary} w-full`}>Anmelden</button>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className={btnGhost} onClick={() => enter("lena.hoffmann@bergmann-elektro.example", "/")}>
          Büro öffnen
        </button>
        <button type="button" className={btnGhost} onClick={() => enter("jonas.weber@bergmann-elektro.example", "/baustelle")}>
          Baustelle öffnen
        </button>
      </div>
    </form>
  );
}
