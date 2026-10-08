import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { FilterChip } from "@/components/shared/filter-chip"
import { TimeOfDaySelect } from "@/components/shared/time-of-day-select"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency, useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { toMinute } from "@/lib/time-of-day"
import type { Court, PriceRule } from "@/types"

/** One editable row: the same rate on several weekdays. The backend stores
 * a rule per weekday (ADR-009); the dialog groups identical ones back. */
interface RuleDraft {
  key: number
  weekdays: number[]
  starts_at: string
  ends_at: string
  price: string
}

let nextKey = 0

function groupRules(rules: PriceRule[]): RuleDraft[] {
  const groups = new Map<string, RuleDraft>()
  for (const rule of rules) {
    const id = `${rule.starts_at}|${rule.ends_at}|${rule.price_per_hour}`
    const group = groups.get(id)
    if (group) group.weekdays.push(rule.weekday)
    else groups.set(id, { key: nextKey++, weekdays: [rule.weekday], starts_at: rule.starts_at, ends_at: rule.ends_at, price: String(rule.price_per_hour) })
  }
  return [...groups.values()]
}

function PriceRulesDialog({ court, open, onOpenChange }: { court: Court; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const queryClient = useQueryClient()
  const { data: rules, isLoading } = useQuery({ queryKey: ["price-rules", court.id], queryFn: () => api.getPriceRules(court.id), enabled: open })
  const [draft, setDraft] = useState<RuleDraft[] | null>(null)
  const rows = draft ?? (rules ? groupRules(rules) : [])

  const problem = rows.find(
    (row) => row.weekdays.length === 0 || row.price.trim() === "" || Number(row.price) < 0 || toMinute(row.starts_at) >= toMinute(row.ends_at),
  )

  function update(key: number, patch: Partial<RuleDraft>) {
    setDraft(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.setPriceRules(
        token!,
        court.id,
        rows.flatMap((row) =>
          row.weekdays.map((weekday) => ({ weekday, starts_at: row.starts_at, ends_at: row.ends_at, price_per_hour: Number(row.price) })),
        ),
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(["price-rules", court.id], saved)
      setDraft(null)
      toast.success(t("admin.pricing.toast.saved"))
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.pricing.error.save")),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDraft(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.pricing.title", { court: court.name })}</DialogTitle>
          <DialogDescription>
            {court.price_per_hour !== null
              ? t("admin.pricing.description", { price: formatCurrency(court.price_per_hour) })
              : t("admin.pricing.descriptionNoBase")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {rows.length === 0 && <li className="py-3 text-[13px] text-muted-foreground">{t("admin.pricing.empty")}</li>}
            {rows.map((row) => (
              <li key={row.key} className="flex flex-col gap-2.5 py-3">
                <div className="flex flex-wrap gap-1">
                  {[0, 1, 2, 3, 4, 5, 6].map((weekday) => {
                    const active = row.weekdays.includes(weekday)
                    return (
                      <FilterChip
                        key={weekday}
                        active={active}
                        onClick={() =>
                          update(row.key, {
                            weekdays: active ? row.weekdays.filter((d) => d !== weekday) : [...row.weekdays, weekday].sort(),
                          })
                        }
                      >
                        <span className="capitalize">{fmt.weekdayName(weekday, "short")}</span>
                      </FilterChip>
                    )
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <TimeOfDaySelect value={row.starts_at} onValueChange={(value) => update(row.key, { starts_at: value })} label={t("admin.pricing.from")} />
                  <span className="text-muted-foreground">–</span>
                  <TimeOfDaySelect value={row.ends_at} onValueChange={(value) => update(row.key, { ends_at: value })} label={t("admin.pricing.to")} />
                  <span className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      step={10}
                      inputMode="decimal"
                      value={row.price}
                      onChange={(event) => update(row.key, { price: event.target.value })}
                      aria-label={t("admin.pricing.price")}
                      className="w-28 font-mono tabular"
                    />
                    <span className="text-[13px] text-muted-foreground">{t("admin.pricing.perHour")}</span>
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="ml-auto"
                    aria-label={t("admin.pricing.remove")}
                    onClick={() => setDraft(rows.filter((r) => r.key !== row.key))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setDraft([...rows, { key: nextKey++, weekdays: [0, 1, 2, 3, 4], starts_at: "17:00", ends_at: "22:00", price: "" }])}
        >
          <Plus /> {t("admin.pricing.add")}
        </Button>
        {problem && <p className="text-xs text-danger">{t("admin.pricing.invalid")}</p>}
        <p className="text-xs text-muted-foreground">{t("admin.pricing.existingKept")}</p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={isLoading || Boolean(problem)} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("admin.pricing.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { PriceRulesDialog }
