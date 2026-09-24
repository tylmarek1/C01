import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  title: string
  description?: string
  onRetry?: () => void
  className?: string
}

/** Shared "this failed to load" state — the error-path sibling of
 * `EmptyState`, for a query that came back `isError` rather than empty. */
function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline py-16 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-red-50 text-destructive dark:bg-red-500/15">
        <AlertCircle className="size-5" />
      </span>
      <p className="font-medium text-ink-navy">{title}</p>
      {description && <p className="max-w-xs text-sm text-slate-gray">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          {t("common.retry")}
        </Button>
      )}
    </div>
  )
}

export { ErrorState }
