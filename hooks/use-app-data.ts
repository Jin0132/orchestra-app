"use client"

/**
 * useAppData – 公演情報・練習スケジュール・タスク・エキストラ契約を
 * Google Sheets 経由で読み書きする共有フック。
 * ローカルステートをキャッシュとして使い、保存時は API を叩く。
 */

import { useState, useEffect, useCallback, useRef } from "react"
import type { Task, Concert } from "@/lib/task-store"
export type { Task, Concert }

/* ─── 型定義 ────────────────────────────────────── */
export interface BasicInfo {
  nextConcertDate: string | null
  hall: string
  rehearsalTime: string
  concertTime: string
}

export interface PracticeItem {
  id: string
  date: string
  title: string
  time: string
  location: string
}

export interface ExtraContract {
  id: string
  name: string
  instrument: string
  guaranteeEur: string
  status: "pending" | "confirmed"
}

export interface AppData {
  concert: BasicInfo
  practices: PracticeItem[]
  tasks: Task[]
  contracts: ExtraContract[]
  taskConcerts: Concert[]
}

const DEFAULT_DATA: AppData = {
  concert: { nextConcertDate: null, hall: "", rehearsalTime: "", concertTime: "" },
  practices: [],
  tasks: [],
  contracts: [],
  taskConcerts: [],
}

/* ─── フック ────────────────────────────────────── */
export function useAppData() {
  const [data, setData] = useState<AppData>(DEFAULT_DATA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* 初回ロード */
  useEffect(() => {
    setLoading(true)
    fetch("/api/app-data", { cache: "no-store" })
      .then((r) => r.json())
      .then((raw: Partial<{
        concert: BasicInfo
        practices: PracticeItem[]
        tasks: Task[]
        contracts: ExtraContract[]
        taskConcerts: Concert[]
      }>) => {
        setData({
          concert: raw.concert ?? DEFAULT_DATA.concert,
          practices: Array.isArray(raw.practices) ? raw.practices : [],
          tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
          contracts: Array.isArray(raw.contracts) ? raw.contracts : [],
          taskConcerts: Array.isArray(raw.taskConcerts) ? raw.taskConcerts : [],
        })
        setError(null)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  /* デバウンス付き保存（500ms 後に実行） */
  const scheduleSave = useCallback((next: AppData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        const res = await fetch("/api/app-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        })
        if (!res.ok) throw new Error(await res.text())
        setError(null)
      } catch (e) {
        setError(String(e))
      } finally {
        setSaving(false)
      }
    }, 500)
  }, [])

  const update = useCallback((patch: Partial<AppData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  return { data, loading, saving, error, update }
}
