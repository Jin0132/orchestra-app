"use client"

import { useCallback, useEffect, useState } from "react"
import type { ConcertEdition } from "@/lib/document-catalog"

let inflight: Promise<ConcertEdition[]> | null = null
let shared: { at: number; concerts: ConcertEdition[] } | null = null
const CLIENT_TTL_MS = 15_000

function forgetSharedConcerts() {
  shared = null
}

async function fetchConcerts(force = false): Promise<ConcertEdition[]> {
  if (!force && shared && Date.now() - shared.at < CLIENT_TTL_MS) return shared.concerts
  if (!force && inflight) return inflight
  inflight = fetch("/api/concerts", { cache: "no-store" })
    .then(async (res) => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const concerts = Array.isArray(data.concerts) ? (data.concerts as ConcertEdition[]) : []
      shared = { at: Date.now(), concerts }
      return concerts
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useConcerts() {
  const [concerts, setConcerts] = useState<ConcertEdition[]>(() => shared?.concerts ?? [])
  const [loading, setLoading] = useState(!shared)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const next = await fetchConcerts(force)
      setConcerts(next)
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

  const addNext = useCallback(async (id?: string) => {
    const res = await fetch("/api/concerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "追加に失敗しました")
    forgetSharedConcerts()
    await reload(true)
    return data as ConcertEdition
  }, [reload])

  const updateEdition = useCallback(async (
    id: string,
    patch: Partial<Pick<ConcertEdition, "name" | "date" | "hall" | "rehearsalTime" | "concertTime">>,
  ) => {
    const res = await fetch("/api/concerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "更新に失敗しました")
    forgetSharedConcerts()
    await reload(true)
    return data as ConcertEdition
  }, [reload])

  return { concerts, loading, error, reload, addNext, updateEdition }
}
