import { cn } from "@/lib/utils"

interface DecorativeBlobProps {
  color?: "magenta" | "cyan"
  className?: string
}

/** Atmosphere only — never used as a fill for functional UI, per the blob rule. */
function DecorativeBlob({ color = "cyan", className }: DecorativeBlobProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full opacity-50 blur-3xl",
        color === "magenta" ? "bg-coral-magenta" : "bg-sky-cyan",
        className,
      )}
    />
  )
}

export { DecorativeBlob }
