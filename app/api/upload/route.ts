import { put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { safeFilename, validateImageUpload } from "@/lib/upload"

export const runtime = "nodejs"

/** マイページ用写真アップロード（画像のみ・サイズ制限あり） */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "ファイルがありません" }, { status: 400 })
    }
    const invalid = validateImageUpload(file)
    if (invalid) return invalid

    const name =
      "name" in file && typeof (file as File).name === "string"
        ? safeFilename((file as File).name)
        : "image.jpg"
    const filename = `mypage/${Date.now()}-${name}`

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: true,
    })

    return NextResponse.json(blob)
  } catch (e) {
    console.error("Upload error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to upload" },
      { status: 500 },
    )
  }
}
