"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type ViewMode = "member" | "ops"

const MODE_LABEL: Record<ViewMode, string> = {
  member: "団員",
  ops: "運営",
}

const glow =
  "border border-primary/30 shadow-[0_0_0_3px_oklch(0.45_0.10_260/0.10),0_0_16px_oklch(0.42_0.12_260/0.28)]"
const glowOpen =
  "border border-primary/40 shadow-[0_0_0_4px_oklch(0.45_0.10_260/0.14),0_0_22px_oklch(0.42_0.12_260/0.36)]"

export function AppHeader({
  mode,
  onSelectMode,
}: {
  mode: ViewMode
  onSelectMode: (mode: ViewMode) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const pick = (next: ViewMode) => {
    setOpen(false)
    if (next !== mode) onSelectMode(next)
  }

  return (
    <header className="relative shrink-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur-sm">
      <div ref={rootRef} className="flex h-full items-center px-4">
        <div className="relative [perspective:720px]">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "relative z-20 rounded-full bg-background/90 px-4 py-1 text-sm sm:text-base font-semibold tracking-tight text-foreground",
              "transition-[box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              open ? glowOpen : glow,
            )}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="表示モードを選ぶ"
          >
            {MODE_LABEL[mode]}
          </button>

          <div
            className={cn(
              "absolute left-0 top-[calc(100%+2px)] z-10 origin-top-left",
              "[transform-style:preserve-3d]",
              "flex w-max flex-col items-center gap-2.5 rounded-[1.75rem] bg-background/95 px-6 py-4",
              "transition-[opacity,transform] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              glowOpen,
              open
                ? "pointer-events-auto opacity-100 [transform:translate3d(1.1rem,0.45rem,36px)_scale(1)_rotateX(0deg)]"
                : "pointer-events-none opacity-0 [transform:translate3d(0.15rem,-0.1rem,-48px)_scale(0.42)_rotateX(-46deg)]",
            )}
            role="menu"
          >
            {(["member", "ops"] as const).map((id) => {
              const active = mode === id
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  tabIndex={open ? 0 : -1}
                  onClick={() => pick(id)}
                  className={cn(
                    "min-w-44 rounded-full px-10 py-3 text-lg font-semibold text-center",
                    "transition-[background-color,box-shadow,border-color,color] duration-200 ease-out",
                    "border",
                    active
                      ? "border-primary/50 bg-primary text-primary-foreground shadow-[0_0_16px_oklch(0.42_0.12_260/0.35)]"
                      : "border-primary/25 bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {MODE_LABEL[id]}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </header>
  )
}
