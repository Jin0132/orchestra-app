"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
import { SHEET_HEADER_ROW } from "./types"

export function CopyHeaderButton() {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(SHEET_HEADER_ROW).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      <Copy className="w-4 h-4 mr-1" />
      {copied ? "コピーしました" : "コピー"}
    </Button>
  )
}
