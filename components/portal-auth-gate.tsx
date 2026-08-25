"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { prefetchAppData } from "@/hooks/use-app-data"

type AuthState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "login"; error?: string }

/**
 * PORTAL_ACCESS_SECRET が設定されているとき、運営ポータルをパスワード保護する。
 * 未設定なら何もせず children を表示。
 */
export function PortalAuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" })
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/auth", { cache: "no-store" })
        const data = (await res.json()) as { required?: boolean; authenticated?: boolean }
        if (cancelled) return
        if (!data.required || data.authenticated) {
          setState({ status: "ready" })
        } else {
          setState({ status: "login" })
        }
      } catch {
        if (!cancelled) setState({ status: "ready" })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const msg = await res.json().then((d: { error?: string }) => d.error).catch(() => null)
        setState({ status: "login", error: msg || "認証に失敗しました" })
        return
      }
      await prefetchAppData().catch(() => null)
      setState({ status: "ready" })
    } catch {
      setState({ status: "login", error: "通信エラーです" })
    } finally {
      setSubmitting(false)
    }
  }

  if (state.status === "loading") {
    return (
      <div
        className="min-h-screen bg-white"
        aria-busy="true"
        aria-label="読み込み中"
      />
    )
  }

  if (state.status === "login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg">Arsis Portal</CardTitle>
            <p className="text-sm text-muted-foreground">アクセス用パスワードを入力してください</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="portal-password">パスワード</Label>
                <Input
                  id="portal-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              {state.error && <p className="text-sm text-destructive">{state.error}</p>}
              <Button type="submit" disabled={submitting || !password}>
                {submitting ? "確認中…" : "入室"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
