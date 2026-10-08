import { Suspense, useEffect, useState, type ReactNode } from "react"
import { Outlet, useLocation } from "react-router-dom"

import { Dialog, DialogTitle, SheetContent } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { AppMasthead, MobileNavMenu, MobileTabBar, MobileTopBar } from "@/components/shared/app-nav"
import { CommandMenu } from "@/components/shared/command-menu"
import { Footer } from "@/components/shared/footer"
import { Navbar } from "@/components/shared/navbar"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"

function RouteLoadingFallback() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

/** Scroll to top on route change (but not on ?query-only changes like tab switches). */
function useScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
}

/** Public marketing layout — top navbar + full footer. */
function AppLayout() {
  useScrollReset()
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Navbar />
      <main id="main" className="flex-1">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

function ShellFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  useScrollReset()

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded-sm bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("nav.skipToContent")}
      </a>

      <AppMasthead onOpenSearch={() => setSearchOpen(true)} />
      <MobileTopBar onOpenSearch={() => setSearchOpen(true)} />

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[20rem] max-w-[88vw] p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{t("nav.primary")}</DialogTitle>
          <MobileNavMenu onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Dialog>

      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />

      {/* pb clears the fixed mobile tab bar */}
      <main id="main" className="flex min-h-[calc(100dvh-3.5rem)] flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:min-h-[calc(100dvh-6rem)] lg:pb-0">
        <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
      </main>

      <MobileTabBar onOpenMenu={() => setMobileOpen(true)} />
    </div>
  )
}

/** The authenticated `/app/*` shell — masthead navigation, no marketing chrome. */
function AppShellLayout() {
  return (
    <ShellFrame>
      <Outlet />
    </ShellFrame>
  )
}

/** For pages both audiences use (court browsing): inside the app shell when
 * signed in, so navigating to "Courts" from the masthead doesn't drop the
 * user out of the app — the marketing layout otherwise. */
function AdaptiveLayout() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <RouteLoadingFallback />
  if (user) return <AppShellLayout />
  return <AppLayout />
}

export { AdaptiveLayout, AppLayout, AppShellLayout, RouteLoadingFallback }
