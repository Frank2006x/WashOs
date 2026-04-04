import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "warden_auth";

export async function POST(request: NextRequest) {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  return NextResponse.redirect(new URL("/", request.url));
}
