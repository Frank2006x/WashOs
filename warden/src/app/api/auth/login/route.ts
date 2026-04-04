import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "warden_auth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "").trim();
  const expectedPassword = String(process.env.WARDEN_PASSWORD || "").trim();

  if (!expectedPassword) {
    return NextResponse.redirect(new URL("/?error=config", request.url));
  }

  if (password !== expectedPassword) {
    return NextResponse.redirect(new URL("/?error=invalid", request.url));
  }

  const store = await cookies();
  store.set(AUTH_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.redirect(new URL("/", request.url));
}
