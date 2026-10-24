import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { readSession, SESSION_COOKIE } from "./session";

export async function currentUser() {
  const jar = await cookies();
  const id = readSession(jar.get(SESSION_COOKIE)?.value);
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

export async function requireUser() {
  const user = await currentUser();
  if (!user || !user.active) redirect("/login");
  return user;
}
