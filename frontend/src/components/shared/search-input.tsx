import { Search, X } from "lucide-react"
import * as React from "react"

import { Input } from "@/components/ui/input"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function SearchInput({
  value,
  onValueChange,
  className,
  inputClassName,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> & {
  value: string
  onValueChange: (value: string) => void
  inputClassName?: string
}) {
  const { t } = useTranslation()
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden", inputClassName)}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t("common.clearSearch")}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export { SearchInput }
