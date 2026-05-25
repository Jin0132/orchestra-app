import { put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * 団員写真アップロード。
 * multipart/form-data で "photo" を受け取り、Vercel Blob（Public ストア）に保存して URL を返す。
 * 要: Vercel の Environment Variables に BLOB_READ_WRITE_TOKEN を設定（@vercel/blob が自動で参照）。
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("photo")
    // File も Blob の一種。サーバー環境によって Blob で渡る場合がある
    if (!file || !(file instanceof Blob) || file.size === 0) {
      return NextResponse.json(
        { error: "photo file is required (and must be a non-empty image)" },
        { status: 400 }
      )
    }
    const name = "name" in file && typeof file.name === "string"
      ? file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
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
      { status: 500 }
    )
  }
}
