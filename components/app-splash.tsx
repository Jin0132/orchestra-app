"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { prefetchAppData } from "@/hooks/use-app-data"

const MIN_VISIBLE_MS = 900
const MAX_WAIT_MS = 8000
const FADE_MS = 480

function hideSplash(startedAt: number) {
  const el = document.getElementById("app-splash")
  if (!el || el.hasAttribute("data-dismissed")) return

  const reveal = () => {
    el.setAttribute("data-dismissed", "true")
    el.classList.add("app-splash-out")
    el.setAttribute("aria-busy", "false")
    window.setTimeout(() => {
      el.setAttribute("hidden", "")
      el.style.display = "none"
    }, FADE_MS)
  }

  const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt))
  window.setTimeout(reveal, remaining)
}

/**
 * 初回HTMLのスプラッシュを、認証と初期データの準備が終わるまで維持する。
 * オーバーレイ中は画面操作できない。
 */
export function AppSplash() {
  const pathname = usePathname()

  useEffect(() => {
    const el = document.getElementById("app-splash")
    if (!el || el.hasAttribute("data-dismissed")) return

    const startedAt = Date.now()
    let cancelled = false
    const safety = window.setTimeout(() => {
      if (!cancelled) hideSplash(startedAt)
    }, MAX_WAIT_MS)

    const boot = async () => {
      try {
        const logo = el.querySelector("img")
        if (logo && !logo.complete) {
          await new Promise<void>((resolve) => {
            logo.addEventListener("load", () => resolve(), { once: true })
            logo.addEventListener("error", () => resolve(), { once: true })
          })
        }

        if (pathname?.startsWith("/mypage")) return

        const authRes = await fetch("/api/auth", { cache: "no-store" })
        const auth = (await authRes.json().catch(() => ({}))) as {
          required?: boolean
          authenticated?: boolean
        }
        const needsLogin = Boolean(auth.required) && !auth.authenticated
        if (!needsLogin) {
          await prefetchAppData()
        }
      } catch {
        /* 失敗してもスプラッシュは閉じ、各画面のエラー表示に任せる */
      } finally {
        if (!cancelled) {
          window.clearTimeout(safety)
          hideSplash(startedAt)
        }
      }
    }

    void boot()
    return () => {
      cancelled = true
      window.clearTimeout(safety)
    }
  }, [pathname])

  return null
}
