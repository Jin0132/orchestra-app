import { createHash, timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"

export const PORTAL_SESSION_COOKIE = "arsis_portal_session"

/** セッション cookie 用のトークン（秘密鍵そのものは cookie に載せない） */
export function portalSessionToken(secret: string): string {
  return createHash("sha256").update(`arsis-portal:${secret}`).digest("hex")
}

export function isPortalAuthConfigured(): boolean {
  return Boolean(process.env.PORTAL_ACCESS_SECRET?.trim())
}

export function getPortalAccessSecret(): string | null {
  const s = process.env.PORTAL_ACCESS_SECRET?.trim()
  return s || null
}

export function verifyPortalSession(request: NextRequest): boolean {
  const secret = getPortalAccessSecret()
  if (!secret) return true
  const cookie = request.cookies.get(PORTAL_SESSION_COOKIE)?.value
  if (!cookie) return false
  const expected = portalSessionToken(secret)
  try {
    const a = Buffer.from(cookie)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** 認証が有効で未ログインなら 401。無効（未設定）なら null。 */
export function unauthorizedIfNeeded(request: NextRequest): NextResponse | null {
  if (!isPortalAuthConfigured()) return null
  if (verifyPortalSession(request)) return null
  return NextResponse.json(
    { error: "Unauthorized", authRequired: true },
    { status: 401 },
  )
}
