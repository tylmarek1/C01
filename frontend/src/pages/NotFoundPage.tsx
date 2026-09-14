import { Link } from "react-router-dom"

import { Button } from "@/components/shared/button"

function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-sm font-semibold text-signal-blue">404</span>
      <h1 className="text-3xl font-bold text-ink-navy">This court doesn't exist</h1>
      <p className="text-slate-gray">The page you're looking for was moved, renamed, or never booked.</p>
      <Button asChild className="mt-2">
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  )
}

export { NotFoundPage }
