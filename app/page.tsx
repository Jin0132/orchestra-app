"use client"

import { useState } from "react"
import { Sidebar, BottomNav, type Page } from "@/components/sidebar"
import { Dashboard } from "@/components/dashboard"
import { SeatingChart } from "@/components/seating-chart"
import { Contracts } from "@/components/contracts"
import { MemberPortal } from "@/components/member-portal"
import { Tasks } from "@/components/tasks"
import { Documents } from "@/components/documents"
import { AppHeader, type ViewMode } from "@/components/app-header"
import { MemberHome } from "@/components/member-home"
import { OpsLoginDialog } from "@/components/ops-login-dialog"
import { usePortalAuth } from "@/hooks/use-portal-auth"

export default function OrchestraApp() {
  const [mode, setMode] = useState<ViewMode>("member")
  const [loginOpen, setLoginOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const auth = usePortalAuth()

  const selectMode = (next: ViewMode) => {
    if (next === mode) return
    if (next === "member") {
      setMode("member")
      return
    }
    if (!auth.required || auth.authenticated) {
      setMode("ops")
      return
    }
    setLoginOpen(true)
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-background">
      <AppHeader mode={mode} onSelectMode={selectMode} />

      <div className="flex flex-1 min-h-0">
        {mode === "ops" && (
          <Sidebar
            currentPage={currentPage}
            onNavigate={setCurrentPage}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((p) => !p)}
          />
        )}

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <div
            className={
              mode === "ops"
                ? "w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-32 md:pb-8"
                : "w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
            }
          >
            {mode === "member" ? (
              <MemberHome />
            ) : (
              <>
                {currentPage === "dashboard" && (
                  <Dashboard
                    onNavigateToMembers={() => setCurrentPage("portal")}
                    onNavigateToTasks={() => setCurrentPage("tasks")}
                    onNavigateToDocuments={() => setCurrentPage("documents")}
                  />
                )}
                {currentPage === "tasks" && <Tasks />}
                {currentPage === "documents" && <Documents />}
                {currentPage === "seating" && <SeatingChart />}
                {currentPage === "contracts" && <Contracts />}
                {currentPage === "portal" && <MemberPortal />}
              </>
            )}
          </div>
        </main>
      </div>

      {mode === "ops" && <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />}

      <OpsLoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onLogin={async (password) => {
          await auth.login(password)
          setLoginOpen(false)
          setMode("ops")
        }}
      />
    </div>
  )
}
