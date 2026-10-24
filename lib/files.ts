import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

export async function saveUpload(file: File, prefix: string) {
  if (!file || file.size === 0) return null;
  if (file.size > 8 * 1024 * 1024) throw new Error("Datei ist größer als 8 MB.");
  await mkdir(UPLOAD_ROOT, { recursive: true });
  const ext = path.extname(file.name).toLowerCase();
  const safeExt = /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
  const stored = `${prefix}-${randomUUID()}${safeExt}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_ROOT, stored), bytes);
  return { path: stored, fileName: file.name.slice(0, 180), mime: file.type || "application/octet-stream", bytes };
}

export async function readStored(relativePath: string) {
  const root = path.resolve(UPLOAD_ROOT);
  const full = path.resolve(root, relativePath);
  if (!full.startsWith(root + path.sep) && full !== root) throw new Error("Ungültiger Dateipfad.");
  return readFile(full);
}

export function looksLikeText(bytes: Buffer) {
  return !bytes.subarray(0, 4000).includes(0);
}
