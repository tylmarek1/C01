import { useEffect } from "react"

import { useNow } from "@/lib/use-now"
import { cn } from "@/lib/utils"

/** Live mm:ss (or h:mm:ss) until `to`. Turns urgent in the last minute; calls
 * `onExpire` once when it hits zero (e.g. to refetch a hold that just lapsed). */
function Countdown({ to, className, onExpire }: { to: string; className?: string; onExpire?: () => void }) {
  const now = useNow()
  const remaining = Math.max(0, new Date(to).getTime() - now)
  const expired = remaining === 0

  useEffect(() => {
    if (expired) onExpire?.()
    // onExpire intentionally excluded: fire once on the transition, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])

  const totalSeconds = Math.floor(remaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const text =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`

  return (
    <span
      role="timer"
      className={cn("font-mono tabular", remaining < 60_000 && !expired && "text-danger", className)}
    >
      {text}
    </span>
  )
}

export { Countdown }
