"use client"

import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Grid3X3,
  FileText,
  Users,
  Music,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export type Page = "dashboard" | "seating" | "contracts" | "portal" | "tasks" | "documents"

/** ボトムナビ用（ホーム＝dashboard を中央に配置。タスクはナビ非表示） */
export const navItems: { id: Page; label: string; mobileLabel: string; icon: React.ElementType }[] = [
  { id: "documents",  label: "書類",            mobileLabel: "書類",      icon: FolderOpen },
  { id: "seating",    label: "セッティング表",  mobileLabel: "座席",      icon: Grid3X3 },
  { id: "dashboard",  label: "ダッシュボード",  mobileLabel: "ホーム",    icon: LayoutDashboard },
  { id: "contracts",  label: "エキストラ契約",  mobileLabel: "契約",      icon: FileText },
  { id: "portal",     label: "団員情報",        mobileLabel: "団員",      icon: Users },
]

/** PC サイドバー用の表示順（ダッシュボード先頭。タスクはホームの直近タスクから遷移） */
const sidebarOrder: Page[] = ["dashboard", "documents", "seating", "contracts", "portal"]
const sidebarItems = sidebarOrder.map((id) => navItems.find((n) => n.id === id)!)

/* ─── PC サイドバー ─────────────────────────────────── */
interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ currentPage, onNavigate, collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        "sticky top-0 h-screen shrink-0 transition-[width] duration-300 ease-out",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* ロゴ */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary shrink-0">
          <Music className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-base font-semibold tracking-tight text-sidebar-foreground truncate">
              Arsis Chamber Orchestra
            </h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">管理プラットフォーム</p>
          </div>
        )}
      </div>

      {/* ナビ */}
      <nav className="flex-1 px-2 py-4">
        <ul className="flex flex-col gap-1" role="navigation" aria-label="メインナビゲーション">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 折りたたみボタン */}
      <div className="px-2 py-3 border-t border-sidebar-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          aria-label={collapsed ? "サイドバーを広げる" : "サイドバーを折りたたむ"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </aside>
  )
}

/* ─── モバイル ボトムナビ ────────────────────────────── */
interface BottomNavProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

export function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border"
      aria-label="メインナビゲーション"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-end">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          const isHome = item.id === "dashboard"
          return (
            <li key={item.id} className="flex-1">
              <button
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-end w-full font-medium transition-colors pb-2.5",
                  isHome
                    ? "gap-1 pt-2 text-[11px]"
                    : "gap-0.5 pt-2.5 text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "transition-transform",
                    isHome ? "w-6 h-6" : "w-5 h-5",
                    isActive && "scale-110",
                  )}
                />
                <span className="leading-none">{item.mobileLabel}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
