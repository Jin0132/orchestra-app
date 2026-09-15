import { NextRequest, NextResponse } from "next/server"
import { unauthorizedIfNeeded } from "@/lib/api-auth"
import { loadDriveFileBytes } from "@/lib/google-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  const fileId = request.nextUrl.searchParams.get("fileId")?.trim()
  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 })
  }

  try {
    const file = await loadDriveFileBytes(fileId)
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (e) {
    console.error("Documents media error:", e)
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "ファイルを開けませんでした。サービスアカウントに共有されているか確認してください。",
      },
      { status: 500 },
    )
  }
}
