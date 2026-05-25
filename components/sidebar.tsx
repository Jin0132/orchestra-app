"use client"

import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Grid3X3,
  FileText,
  Users,
  Music,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export type Page = "dashboard" | "seating" | "contracts" | "portal"

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  collapsed: boolean
  onToggle: () => void
  /** モバイル時: true で非表示（ドロワー閉じ）、false でスライド表示。PC時は収縮状態に使用 */
  isMobile?: boolean
}

const navItems: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { id: "seating", label: "セッティング表", icon: Grid3X3 },
  { id: "contracts", label: "エキストラ契約", icon: FileText },
  { id: "portal", label: "団員情報", icon: Users },
]

export function Sidebar({ currentPage, onNavigate, collapsed, onToggle, isMobile = false }: SidebarProps) {
  return (
    <>
      {/* モバイル時のみ: オーバーレイ（ドロワー開いているときタップで閉じる） */}
      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden transition-opacity duration-300"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen z-40",
          "transition-[transform,width,box-shadow] duration-300 ease-out",
          /* モバイル: 画面外に退避 or 左からスライドイン（レイアウトは占有しない） */
          isMobile && "fixed inset-y-0 left-0 w-64 shadow-xl",
          isMobile && collapsed && "-translate-x-full",
          isMobile && !collapsed && "translate-x-0",
          /* PC: 幅で収縮（アイコンのみ 4rem / フル 16rem）、メインが自動で広がる */
          !isMobile && "sticky top-0 shrink-0",
          !isMobile && (collapsed ? "w-16" : "w-64")
        )}
      >
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

      <nav className="flex-1 px-2 py-4">
        <ul className="flex flex-col gap-1" role="navigation" aria-label="メインナビゲーション">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    onNavigate(item.id)
                    if (isMobile) onToggle()
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
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

      <div className="px-2 py-3 border-t border-sidebar-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          aria-label={isMobile ? (collapsed ? "メニューを開く" : "メニューを閉じる") : (collapsed ? "サイドバーを広げる" : "サイドバーを折りたたむ")}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </aside>
    </>
  )
}
