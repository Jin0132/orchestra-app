import { NextResponse } from "next/server"

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
])

export function validateImageUpload(file: Blob): NextResponse | null {
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "ファイルが空です" }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `ファイルサイズは ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB 以下にしてください` },
      { status: 400 },
    )
  }
  const type = (file.type || "").toLowerCase()
  if (type && !ALLOWED_IMAGE_TYPES.has(type)) {
    return NextResponse.json(
      { error: "画像ファイル（JPEG / PNG / WebP / GIF）のみアップロードできます" },
      { status: 400 },
    )
  }
  // type が空の環境もあるため、拡張子でも一応弾く
  if ("name" in file && typeof (file as File).name === "string") {
    const name = (file as File).name.toLowerCase()
    if (name && !/\.(jpe?g|png|webp|gif)$/.test(name)) {
      return NextResponse.json(
        { error: "画像ファイル（JPEG / PNG / WebP / GIF）のみアップロードできます" },
        { status: 400 },
      )
    }
  }
  return null
}

export function safeFilename(name: string, fallback = "image.jpg"): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
  return cleaned || fallback
}
