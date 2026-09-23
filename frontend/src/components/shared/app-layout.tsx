import { Suspense } from "react"
import { Outlet } from "react-router-dom"

import { Footer } from "@/components/shared/footer"
import { Navbar } from "@/components/shared/navbar"
import { Skeleton } from "@/components/ui/skeleton"

function RouteLoadingFallback() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-16">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

/** The authenticated `/app/*` shell — same navbar, but a slim footer instead
 * of the marketing one, so the product area reads as a focused workspace
 * rather than a page that happens to sit below a pricing/sport-browse footer. */
function AppShellLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer variant="minimal" />
    </div>
  )
}

export { AppLayout, AppShellLayout }
