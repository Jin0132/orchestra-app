import { NextRequest, NextResponse } from "next/server"
import { unauthorizedIfNeeded } from "@/lib/api-auth"
import { inspectDocumentUrl } from "@/lib/google-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as { url?: string }
    const url = body.url?.trim()
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 })
    }
    const inspected = await inspectDocumentUrl(url)
    return NextResponse.json(inspected)
  } catch (e) {
    console.error("Documents inspect error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to inspect url" },
      { status: 500 },
    )
  }
}
