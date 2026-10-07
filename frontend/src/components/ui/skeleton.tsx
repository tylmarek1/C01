import { cn } from "@/lib/utils"

/** Shimmering placeholder — mirror the shape of the content it stands in for. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--muted)_0%,var(--c-wash-strong)_50%,var(--muted)_100%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
