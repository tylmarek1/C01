import { Outlet } from "react-router-dom"

import { Footer } from "@/components/shared/footer"
import { Navbar } from "@/components/shared/navbar"

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export { AppLayout }
