import { useSearchParams } from "react-router-dom"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { usePendingApprovalCount } from "@/lib/queries"
import { useRoleLabels } from "@/lib/user-role"
import { AvailabilityTab } from "@/pages/app/admin/AvailabilityTab"
import { ChallengesTab } from "@/pages/app/admin/ChallengesTab"
import { CourtsTab } from "@/pages/app/admin/CourtsTab"
import { OverviewTab } from "@/pages/app/admin/OverviewTab"
import { ReservationsTab } from "@/pages/app/admin/ReservationsTab"
import { UsersTab } from "@/pages/app/admin/UsersTab"

const TABS = ["overview", "reservations", "courts", "availability", "challenges", "users"] as const
type Tab = (typeof TABS)[number]

function AdminPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const roleLabels = useRoleLabels()
  const pending = usePendingApprovalCount()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("tab") as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "overview"

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
          <TabsTrigger value="courts">{t("admin.tabs.courts")}</TabsTrigger>
          <TabsTrigger value="availability">{t("admin.tabs.availability")}</TabsTrigger>
          <TabsTrigger value="challenges">{t("admin.tabs.challenges")}</TabsTrigger>
          <TabsTrigger value="users">{t("admin.tabs.users")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="reservations">
          <ReservationsTab />
        </TabsContent>
        <TabsContent value="courts">
          <CourtsTab />
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
      </Tabs>
    </PageContainer>
  )
}

export { AdminPage }
