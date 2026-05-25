import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData()
  const file = formData.get("file") as File

  if (!file) {
    return NextResponse.json({ error: "ファイルがありません" }, { status: 400 })
  }

  const filename = `${Date.now()}-${file.name}`

  const blob = await put(filename, file, {
    access: "public",
  })

  return NextResponse.json(blob)
}
