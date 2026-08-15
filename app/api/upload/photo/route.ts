import { put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { unauthorizedIfNeeded } from "@/lib/api-auth"
import { safeFilename, validateImageUpload } from "@/lib/upload"

export const runtime = "nodejs"

/**
 * 団員写真アップロード（運営ポータル用）。
 * multipart/form-data で "photo" を受け取り、Vercel Blob に保存して URL を返す。
 * PORTAL_ACCESS_SECRET 設定時はログイン必須。
 */
export async function POST(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const formData = await request.formData()
    const file = formData.get("photo")
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "photo file is required (and must be a non-empty image)" },
        { status: 400 },
      )
    }
    const invalid = validateImageUpload(file)
    if (invalid) return invalid

    const name =
      "name" in file && typeof (file as File).name === "string"
        ? safeFilename((file as File).name)
        : "image.jpg"
    const filename = `members/${Date.now()}-${name}`
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: true,
    })
    return NextResponse.json({ url: blob.url })
  } catch (e) {
    console.error("Upload photo error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to upload photo" },
      { status: 500 },
    )
  }
}
