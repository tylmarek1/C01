import { AlertCircle, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  size?: "default" | "compact"
  className?: string
}

/** Shared "this failed to load" state — the error-path sibling of
 * `EmptyState`, for a query that came back `isError` rather than empty. */
function ErrorState({ title, description, onRetry, size = "default", className }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className={cn(
        "flex animate-fade-in flex-col items-center gap-3 rounded-xl border border-danger/20 bg-danger-soft/40 text-center",
        size === "default" ? "px-6 py-12" : "px-4 py-6",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-danger-soft text-danger">
        <AlertCircle className="size-5" />
      </span>
      <p className="text-[15px] font-medium text-foreground">{title ?? t("common.error.title")}</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">{description ?? t("common.error.description")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RotateCw /> {t("common.retry")}
        </Button>
      )}
    </div>
  )
}

export { ErrorState }
