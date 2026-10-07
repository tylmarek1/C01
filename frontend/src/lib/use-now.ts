import { useEffect, useState } from "react"

/** Current time that re-renders every `intervalMs` — the render-safe way to
 * read "now" (calling Date.now() during render is impure and goes stale). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
