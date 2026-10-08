import { useSearchParams } from "react-router-dom"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { usePendingApprovalCount } from "@/lib/queries"
import { useRoleLabels } from "@/lib/user-role"
import { AuditTab } from "@/pages/app/admin/AuditTab"
import { AvailabilityTab } from "@/pages/app/admin/AvailabilityTab"
import { ChallengesTab } from "@/pages/app/admin/ChallengesTab"
import { CourtsTab } from "@/pages/app/admin/CourtsTab"
import { OverviewTab } from "@/pages/app/admin/OverviewTab"
import { PaymentsTab } from "@/pages/app/admin/PaymentsTab"
import { ReservationsTab } from "@/pages/app/admin/ReservationsTab"
import { UsersTab } from "@/pages/app/admin/UsersTab"
import { VenuesTab } from "@/pages/app/admin/VenuesTab"

const TABS = ["overview", "reservations", "payments", "courts", "venues", "availability", "challenges", "users", "audit"] as const
type Tab = (typeof TABS)[number]

function AdminPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const roleLabels = useRoleLabels()
  const pending = usePendingApprovalCount()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("tab") as Tab | null
  const isAdmin = user?.role === "ADMIN"
  // The audit log spans every venue and every account — admins only (ADR-007).
  const tab: Tab = tabParam && TABS.includes(tabParam) && (tabParam !== "audit" || isAdmin) ? tabParam : "overview"

  function setTab(next: string) {
    // Switching tab drops tab-specific params (e.g. the reservations ?status filter).
    setSearchParams(next === "overview" ? {} : { tab: next }, { replace: true })
  }

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow={user ? `${t("admin.header.eyebrow")} · ${roleLabels[user.role]}` : t("admin.header.eyebrow")}
        title={t("admin.header.title")}
        description={t("admin.header.description")}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line">
          <TabsTrigger value="overview">{t("admin.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="reservations">
            {t("admin.tabs.reservations")}
            {pending > 0 && (
              <span className="rounded-full bg-brand px-1.5 font-mono text-[10px] font-semibold text-brand-foreground tabular">{pending}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments">{t("admin.tabs.payments")}</TabsTrigger>
          <TabsTrigger value="courts">{t("admin.tabs.courts")}</TabsTrigger>
          <TabsTrigger value="venues">{t("admin.tabs.venues")}</TabsTrigger>
          <TabsTrigger value="availability">{t("admin.tabs.availability")}</TabsTrigger>
          <TabsTrigger value="challenges">{t("admin.tabs.challenges")}</TabsTrigger>
          <TabsTrigger value="users">{t("admin.tabs.users")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="audit">{t("admin.tabs.audit")}</TabsTrigger>}
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="reservations">
          <ReservationsTab />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
        <TabsContent value="courts">
          <CourtsTab />
        </TabsContent>
        <TabsContent value="venues">
          <VenuesTab />
        </TabsContent>
        <TabsContent value="availability">
          <AvailabilityTab />
        </TabsContent>
        <TabsContent value="challenges">
          <ChallengesTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="audit">
            <AuditTab />
          </TabsContent>
        )}
      </Tabs>
    </PageContainer>
  )
}

export { AdminPage }
