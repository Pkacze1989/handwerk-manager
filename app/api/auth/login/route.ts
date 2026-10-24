import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, signSession } from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/");
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.redirect(new URL("/login?fehler=1", request.url), 303);
  }
  const response = NextResponse.redirect(new URL(safe, request.url), 303);
  response.cookies.set(SESSION_COOKIE, signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
