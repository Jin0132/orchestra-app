"use client"

import { useState, useEffect } from "react"
import { Sidebar, type Page } from "@/components/sidebar"
import { Dashboard } from "@/components/dashboard"
import { SeatingChart } from "@/components/seating-chart"
import { Contracts } from "@/components/contracts"
import { MemberPortal } from "@/components/member-portal"
import { PortalAuthGate } from "@/components/portal-auth-gate"
import { useIsMobile } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"

export default function OrchestraApp() {
  const isMobileQuery = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>("dashboard")
  // モバイルでは常に非表示、PCでは開いた状態から開始（mount後に反映）
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  // マウント前はモバイル扱いでサイドバー非表示。PC表示時だけ開く
  const isMobile = !mounted || isMobileQuery
  useEffect(() => {
    if (mounted && !isMobileQuery) setSidebarCollapsed(false)
  }, [mounted, isMobileQuery])

  return (
    <PortalAuthGate>
      <div className="flex min-h-screen bg-background">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((p) => !p)}
          isMobile={isMobile}
        />
        <main className="flex-1 min-w-0 overflow-x-hidden transition-[margin] duration-300 ease-out">
          {/* モバイル: ハンバーガーで横からスライド表示 */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background px-4 py-3 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed((p) => !p)}
              aria-label="メニューを開く"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-semibold text-foreground">Arsis Chamber Orchestra</span>
          </header>
          <div className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {currentPage === "dashboard" && <Dashboard onNavigateToMembers={() => setCurrentPage("portal")} />}
            {currentPage === "seating" && <SeatingChart />}
            {currentPage === "contracts" && <Contracts />}
            {currentPage === "portal" && <MemberPortal />}
          </div>
        </main>
      </div>
    </PortalAuthGate>
  )
}
