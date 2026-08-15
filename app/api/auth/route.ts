import { NextRequest, NextResponse } from "next/server"
import {
  getPortalAccessSecret,
  isPortalAuthConfigured,
  PORTAL_SESSION_COOKIE,
  portalSessionToken,
  verifyPortalSession,
} from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** 認証の要否と現在のセッション状態 */
export async function GET(request: NextRequest) {
  const required = isPortalAuthConfigured()
  return NextResponse.json({
    required,
    authenticated: required ? verifyPortalSession(request) : true,
  })
}

/** パスワードでセッション cookie を発行 */
export async function POST(request: NextRequest) {
  const secret = getPortalAccessSecret()
  if (!secret) {
    return NextResponse.json({ ok: true, required: false })
  }

  let password = ""
  try {
    const body = (await request.json()) as { password?: string }
    password = String(body.password ?? "")
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (password !== secret) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(PORTAL_SESSION_COOKIE, portalSessionToken(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}

/** ログアウト */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(PORTAL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  return res
}
