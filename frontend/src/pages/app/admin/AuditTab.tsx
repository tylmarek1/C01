import { useInfiniteQuery } from "@tanstack/react-query"
import { ScrollText } from "lucide-react"
import { useState } from "react"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { FilterChip } from "@/components/shared/filter-chip"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import type { AuditAction, AuditLogEntry } from "@/types"

const PAGE_SIZE = 50

// The tables backend audit.AUDITED_FIELDS covers.
const ENTITY_TYPES = [
  "reservations",
  "payments",
  "courts",
  "court_price_rules",
  "venues",
  "venue_opening_hours",
  "venue_managers",
  "facility_blocks",
  "users",
] as const

const ENTITY_LABEL: Record<(typeof ENTITY_TYPES)[number], TranslationKey> = {
  reservations: "admin.audit.entity.reservations",
  payments: "admin.audit.entity.payments",
  courts: "admin.audit.entity.courts",
  court_price_rules: "admin.audit.entity.court_price_rules",
  venues: "admin.audit.entity.venues",
  venue_opening_hours: "admin.audit.entity.venue_opening_hours",
  venue_managers: "admin.audit.entity.venue_managers",
  facility_blocks: "admin.audit.entity.facility_blocks",
  users: "admin.audit.entity.users",
}

const ACTION_LABEL: Record<AuditAction, TranslationKey> = {
  CREATE: "admin.audit.action.CREATE",
  UPDATE: "admin.audit.action.UPDATE",
  DELETE: "admin.audit.action.DELETE",
}

const ACTION_VARIANT: Record<AuditAction, BadgeProps["variant"]> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "destructive",
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Readable form of a logged value: minutes as HH:MM, a weekday by name,
 * an id shortened — the raw value stays in the database. */
function useValueFormatter() {
  const fmt = useFormatters()
  return (field: string, value: unknown): string => {
    if (value === null || value === undefined) return "∅"
    if (Array.isArray(value)) return value.length ? value.join(", ") : "[]"
    if (typeof value === "number" && field.endsWith("_minute")) return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
    if (typeof value === "number" && field === "weekday") return fmt.weekdayName(value)
    if (typeof value === "string" && UUID.test(value)) return value.slice(0, 8)
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return fmt.dateTime(value)
    return String(value)
  }
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const { t } = useTranslation()
  const fmt = useFormatters()
  const formatValue = useValueFormatter()
  const entityKey = ENTITY_LABEL[entry.entity_type as keyof typeof ENTITY_LABEL]
  return (
    <li className="flex flex-col gap-2 py-3">
      <span className="flex flex-wrap items-center gap-2 text-[13px]">
        <Badge variant={ACTION_VARIANT[entry.action]}>{t(ACTION_LABEL[entry.action])}</Badge>
        <span className="font-medium">{entityKey ? t(entityKey) : entry.entity_type}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{entry.entity_id.slice(0, 8)}</span>
        <span className="text-muted-foreground">
          · {entry.actor ? entry.actor.name : t("admin.audit.system")} · {fmt.dateTime(entry.created_at)}
        </span>
        {entry.request_id && (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground" title={t("admin.audit.requestId")}>
            {entry.request_id.slice(0, 12)}
          </span>
        )}
      </span>
      <dl className="grid gap-x-4 gap-y-0.5 font-mono text-xs sm:grid-cols-[minmax(8rem,auto)_1fr]">
        {Object.entries(entry.changes).map(([field, [before, after]]) => (
          <div key={field} className="contents">
            <dt className="text-muted-foreground">{field}</dt>
            <dd className="break-all">
              {entry.action === "CREATE"
                ? formatValue(field, after)
                : entry.action === "DELETE"
                  ? formatValue(field, before)
                  : `${formatValue(field, before)} → ${formatValue(field, after)}`}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  )
}

function AuditTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [entityType, setEntityType] = useState<(typeof ENTITY_TYPES)[number] | null>(null)
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["admin-audit-log", entityType],
    queryFn: ({ pageParam }) => api.listAuditLog(token!, { entity_type: entityType ?? undefined, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined),
  })
  const entries = data?.pages.flat() ?? []

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-foreground">{t("admin.audit.intro")}</p>
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={entityType === null} onClick={() => setEntityType(null)}>
          {t("admin.audit.filter.all")}
        </FilterChip>
        {ENTITY_TYPES.map((type) => (
          <FilterChip key={type} active={entityType === type} onClick={() => setEntityType(entityType === type ? null : type)}>
            {t(ENTITY_LABEL[type])}
          </FilterChip>
        ))}
      </div>

      {isError && <ErrorState onRetry={() => refetch()} />}
      {isLoading && <Skeleton className="h-64" />}
      {!isLoading && !isError && entries.length === 0 && (
        <EmptyState icon={ScrollText} title={t("admin.audit.empty.title")} description={t("admin.audit.empty.description")} />
      )}
      {entries.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-t-2 border-foreground">
          {entries.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
      {hasNextPage && (
        <Button variant="outline" className="self-center" isLoading={isFetchingNextPage} onClick={() => fetchNextPage()}>
          {t("admin.audit.loadMore")}
        </Button>
      )}
    </div>
  )
}

export { AuditTab }
