"use client"

import { useCallback, useEffect, useState } from "react"
import type { ConcertEdition, PortalDocument } from "@/lib/document-catalog"

export function useDocuments() {
  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [concerts, setConcerts] = useState<ConcertEdition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/documents", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDocuments(Array.isArray(data.documents) ? data.documents : [])
      setConcerts(Array.isArray(data.concerts) ? data.concerts : [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { documents, concerts, loading, error, reload, setDocuments }
}
