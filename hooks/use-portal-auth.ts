"use client"

import { useCallback, useEffect, useState } from "react"
import { prefetchAppData, resetAppDataCache } from "@/hooks/use-app-data"

type AuthState = {
  loading: boolean
  required: boolean
  authenticated: boolean
}

const INITIAL: AuthState = { loading: true, required: false, authenticated: false }

export function usePortalAuth() {
  const [state, setState] = useState<AuthState>(INITIAL)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", { cache: "no-store" })
      const data = (await res.json()) as { required?: boolean; authenticated?: boolean }
      const required = Boolean(data.required)
      const authenticated = required ? Boolean(data.authenticated) : true
      setState({ loading: false, required, authenticated })
      return { required, authenticated }
    } catch {
      setState({ loading: false, required: false, authenticated: true })
      return { required: false, authenticated: true }
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (password: string) => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      const msg = await res.json().then((d: { error?: string }) => d.error).catch(() => null)
      throw new Error(msg || "認証に失敗しました")
    }
    resetAppDataCache()
    await prefetchAppData().catch(() => null)
    setState({ loading: false, required: true, authenticated: true })
  }, [])

  return { ...state, refresh, login }
}
