import { redirect } from "next/navigation";

export function isRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function errorText(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code === "P2002") return "Dieser Wert ist schon vergeben.";
    if (code === "P2003") return "Der Datensatz wird noch verwendet und kann nicht gelöscht werden.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Unerwarteter Fehler.";
}

export function redirectWith(path: string, query: Record<string, string | undefined>): never {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString();
  redirect(suffix ? `${path}?${suffix}` : path);
}
