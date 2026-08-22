import { NextRequest, NextResponse } from "next/server"
import { unauthorizedIfNeeded } from "@/lib/api-auth"
import { getDriveFolderId } from "@/lib/google-auth"
import { listPortalDocuments, loadDocumentsSheet } from "@/lib/documents"
import { listDriveFolderFiles } from "@/lib/google-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store, max-age=0" }

export async function GET(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const folderId = request.nextUrl.searchParams.get("folderId")?.trim() || getDriveFolderId()
    const [{ files }, { rows, headerRow }] = await Promise.all([
      listDriveFolderFiles(folderId),
      loadDocumentsSheet(),
    ])
    const registered = listPortalDocuments(rows, headerRow)
    const registeredIds = new Set(registered.map((d) => d.fileId).filter(Boolean))
    const registeredUrls = new Set(registered.map((d) => d.url))

    return NextResponse.json(
      {
        folderId,
        folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
        files: files.map((f) => ({
          ...f,
          registered: registeredIds.has(f.id) || registeredUrls.has(f.url),
        })),
      },
      { headers: noStore },
    )
  } catch (e) {
    console.error("Documents drive list error:", e)
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to list drive folder",
        hint: "Google Cloud で Drive API を有効にし、フォルダをサービスアカウントに共有してください。",
      },
      { status: 500 },
    )
  }
}
