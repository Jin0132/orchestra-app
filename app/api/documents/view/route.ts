import { NextRequest, NextResponse } from "next/server"
import { unauthorizedIfNeeded } from "@/lib/api-auth"
import { getDriveFileMeta, listDriveFolderFiles } from "@/lib/google-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store, max-age=0" }

export async function GET(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  const fileId = request.nextUrl.searchParams.get("fileId")?.trim()
  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 })
  }

  try {
    const meta = await getDriveFileMeta(fileId)
    if (meta.view === "folder") {
      const { files } = await listDriveFolderFiles(meta.id)
      const listed = [...files].sort((a, b) => {
        const af = a.kind === "folder" ? 0 : 1
        const bf = b.kind === "folder" ? 0 : 1
        if (af !== bf) return af - bf
        return a.name.localeCompare(b.name, "ja")
      })
      return NextResponse.json(
        {
          ...meta,
          files: listed.map((f) => ({
            id: f.id,
            name: f.name,
            kind: f.kind,
            mimeType: f.mimeType,
            url: f.url,
          })),
        },
        { headers: noStore },
      )
    }
    return NextResponse.json(meta, { headers: noStore })
  } catch (e) {
    console.error("Documents view error:", e)
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
