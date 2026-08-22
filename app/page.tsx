"use client"

import { useState } from "react"
import { Sidebar, BottomNav, type Page } from "@/components/sidebar"
import { Dashboard } from "@/components/dashboard"
import { SeatingChart } from "@/components/seating-chart"
import { Contracts } from "@/components/contracts"
import { MemberPortal } from "@/components/member-portal"
import { Tasks } from "@/components/tasks"
import { Documents } from "@/components/documents"
import { PortalAuthGate } from "@/components/portal-auth-gate"

export default function OrchestraApp() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <PortalAuthGate>
      <div className="flex min-h-screen bg-background">
        {/* PC: 左サイドバー */}
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((p) => !p)}
        />

        {/* コンテンツ */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          {/* モバイルトップバー（タイトルのみ） */}
          <header className="md:hidden sticky top-0 z-20 flex items-center border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Arsis Chamber Orchestra</span>
          </header>

          {/* ページコンテンツ。モバイルはボトムナビ分の余白を確保 */}
          <div className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-28 md:pb-8">
            {currentPage === "dashboard"  && (
              <Dashboard
                onNavigateToMembers={() => setCurrentPage("portal")}
                onNavigateToTasks={() => setCurrentPage("tasks")}
                onNavigateToDocuments={() => setCurrentPage("documents")}
              />
            )}
            {currentPage === "tasks"      && <Tasks />}
            {currentPage === "documents"  && <Documents />}
            {currentPage === "seating"    && <SeatingChart />}
            {currentPage === "contracts"  && <Contracts />}
            {currentPage === "portal"     && <MemberPortal />}
          </div>
        </main>

        {/* モバイル: ボトムナビ */}
        <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
      </div>
    </PortalAuthGate>
  )
}
