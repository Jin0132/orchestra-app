"use client"

import { useEffect, useState } from "react"

/** 新規登録で選択したファイルのプレビュー（全体が映る） */
export function PhotoFilePreview({ file, size }: { file: File; size: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  if (!url) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-lg bg-muted animate-pulse"
      />
    )
  }
  return (
    <div
      className="border border-border rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <img
        src={url}
        alt=""
        className="max-w-full max-h-full w-full h-full object-contain"
      />
    </div>
  )
}
