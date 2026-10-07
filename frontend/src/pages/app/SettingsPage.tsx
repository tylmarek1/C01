import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, Camera, Check, Copy, Globe, Monitor, Moon, Palette, RefreshCw, Sun, UserRound, CalendarSync } from "lucide-react"
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { compressImageFile } from "@/lib/image"
import { NOTIFICATION_CATEGORIES, useNotificationCategoryLabels } from "@/lib/notification-categories"
import { getExistingPushSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push"
import { useTheme } from "@/lib/theme"
import { ROLE_VARIANT, useRoleLabels } from "@/lib/user-role"
import { cn } from "@/lib/utils"
import type { NotificationType } from "@/types"

function formatKb(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** A settings section: label + description on the left, controls on the right (md+). */
function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string
  icon: typeof Bell
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-5 border-t border-border py-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-10">
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          <Icon className="size-4 text-muted-foreground" /> {title}
        </h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">{children}</div>
    </section>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string
  description?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-4 py-3 first:pt-0 last:pb-0", disabled && "cursor-not-allowed opacity-60")}>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium">{title}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-label={title} />
    </label>
  )
}

function AccountSection() {
  const { user, token, updateUser } = useAuth()
  const { t } = useTranslation()
  const roleLabels = useRoleLabels()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user?.name ?? "")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const saveNameMutation = useMutation({
    mutationFn: (nextName: string) => api.updateProfile(token!, nextName),
    onSuccess: (updated) => {
      updateUser(updated)
      toast.success(t("profile.toast.updated"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.updateFailed")),
  })

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const originalKb = formatKb(file.size)
      const compressed = await compressImageFile(file)
      const updated = await api.uploadAvatar(token!, compressed)
      return { updated, originalKb, compressedKb: formatKb(compressed.size) }
    },
    onSuccess: ({ updated, originalKb, compressedKb }) => {
      updateUser(updated)
      setAvatarPreview(null)
      toast.success(t("profile.toast.avatarUpdated", { from: originalKb, to: compressedKb }))
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t("profile.error.avatarFailed"))
      setAvatarPreview(null)
    },
  })

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    avatarMutation.mutate(file)
  }

  function handleNameSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length === 0) return
    saveNameMutation.mutate(name.trim())
  }

  if (!user) return null
  const nameChanged = name.trim() !== user.name && name.trim().length > 0

  return (
    <SettingsSection id="account" icon={UserRound} title={t("settings.account.title")} description={t("settings.account.description")}>
      <div className="flex items-center gap-4">
        <div className="relative">
          <UserAvatar name={user.name} avatarUrl={user.avatar_url} src={avatarPreview} size="xl" className={cn(avatarMutation.isPending && "opacity-60")} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarMutation.isPending}
            className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
            aria-label={t("profile.avatar.change")}
          >
            <Camera className="size-3.5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium">{avatarMutation.isPending ? t("profile.avatar.uploading") : t("profile.avatar.hint")}</span>
          <span className="text-xs text-muted-foreground">{t("profile.avatar.description")}</span>
        </div>
      </div>

      <form onSubmit={handleNameSubmit} className="flex flex-col gap-4 border-t border-border pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("auth.field.name")}</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} autoComplete="name" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("auth.field.email")}</Label>
            <Input id="email" value={user.email} disabled />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {t("profile.role.label")} <Badge variant={ROLE_VARIANT[user.role]}>{roleLabels[user.role]}</Badge>
          </span>
          <Button type="submit" size="sm" disabled={!nameChanged} isLoading={saveNameMutation.isPending}>
            {t("profile.save")}
          </Button>
        </div>
      </form>
    </SettingsSection>
  )
}

function PublicProfileSection() {
  const { user, token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({
    queryKey: ["player-profile", user?.id],
    queryFn: () => api.getPlayerProfile(token!, user!.id),
    enabled: Boolean(token && user),
  })
  const updateMutation = useMutation({
    mutationFn: (payload: { bio?: string; profile_public?: boolean }) => api.updateMyProfile(token!, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["player-profile", updated.user.id], updated)
      toast.success(t("profile.toast.updated"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.updateFailed")),
  })

  return (
    <SettingsSection id="public-profile" icon={Globe} title={t("playerProfile.visibility.title")} description={t("settings.publicProfile.description")}>
      {isLoading || !profile ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <ToggleRow
            title={t("playerProfile.visibility.publicToggle")}
            description={t("playerProfile.visibility.publicToggleHint")}
            checked={profile.profile_public}
            disabled={updateMutation.isPending}
            onCheckedChange={(next) => updateMutation.mutate({ profile_public: next })}
          />
          <BioForm
            key={profile.bio ?? ""}
            initialBio={profile.bio ?? ""}
            profileUserId={profile.user.id}
            isSaving={updateMutation.isPending}
            onSave={(bio) => updateMutation.mutate({ bio })}
          />
        </>
      )}
    </SettingsSection>
  )
}

function BioForm({
  initialBio,
  profileUserId,
  isSaving,
  onSave,
}: {
  initialBio: string
  profileUserId: string
  isSaving: boolean
  onSave: (bio: string) => void
}) {
  const { t } = useTranslation()
  const [bio, setBio] = useState(initialBio)
  return (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              onSave(bio)
            }}
            className="flex flex-col gap-2 border-t border-border pt-4"
          >
            <Label htmlFor="bio">{t("playerProfile.visibility.bioLabel")}</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={300}
              placeholder={t("playerProfile.visibility.bioPlaceholder")}
              rows={3}
            />
            <div className="flex items-center justify-between gap-3">
              <Link to={`/app/players/${profileUserId}`} className="text-xs font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground">
                {t("playerProfile.visibility.viewPublic")}
              </Link>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-subtle-foreground tabular">{bio.length}/300</span>
                <Button type="submit" size="sm" disabled={bio === initialBio} isLoading={isSaving}>
                  {t("profile.save")}
                </Button>
              </div>
            </div>
          </form>
  )
}

function NotificationsSection() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const labels = useNotificationCategoryLabels()

  const { data: notificationPrefs, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.getNotificationPreferences(token!),
    enabled: Boolean(token),
  })
  const mutedTypes = notificationPrefs?.muted_types ?? []

  const prefsMutation = useMutation({
    mutationFn: (nextMuted: NotificationType[]) => api.updateNotificationPreferences(token!, nextMuted),
    onMutate: async (nextMuted) => {
      // Optimistic — a switch should move the instant it's clicked.
      const previous = queryClient.getQueryData(["notification-preferences"])
      queryClient.setQueryData(["notification-preferences"], { muted_types: nextMuted })
      return { previous }
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(["notification-preferences"], context?.previous)
      toast.error(error instanceof ApiError ? error.message : t("notificationPrefs.error"))
    },
    onSuccess: (result) => queryClient.setQueryData(["notification-preferences"], result),
  })

  const pushSupported = isPushSupported()
  const { data: isPushSubscribed } = useQuery({
    queryKey: ["push-subscription-status"],
    queryFn: async () => Boolean(await getExistingPushSubscription()),
    enabled: pushSupported,
  })
  const pushMutation = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) await subscribeToPush(token!)
      else await unsubscribeFromPush(token!)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["push-subscription-status"] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : t("notificationPrefs.push.error")),
  })

  function toggleCategory(types: NotificationType[], enabled: boolean) {
    const next = enabled ? mutedTypes.filter((type) => !types.includes(type)) : [...new Set([...mutedTypes, ...types])]
    prefsMutation.mutate(next)
  }

  return (
    <SettingsSection id="notifications" icon={Bell} title={t("notificationPrefs.title")} description={t("settings.notifications.description")}>
      <div className="flex flex-col divide-y divide-border">
        {pushSupported ? (
          <ToggleRow
            title={t("notificationPrefs.push.title")}
            description={t("notificationPrefs.push.description")}
            checked={Boolean(isPushSubscribed)}
            disabled={pushMutation.isPending}
            onCheckedChange={(next) => pushMutation.mutate(next)}
          />
        ) : (
          <p className="pb-3 text-xs text-muted-foreground">{t("settings.notifications.pushUnsupported")}</p>
        )}
      </div>
      <div className="flex flex-col divide-y divide-border border-t border-border pt-4">
        <span className="eyebrow pb-2">{t("settings.notifications.categories")}</span>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="my-2 h-9" />)
          : NOTIFICATION_CATEGORIES.map(({ key, types }) => (
              <ToggleRow
                key={key}
                title={labels[key].title}
                description={labels[key].description}
                checked={!types.every((type) => mutedTypes.includes(type))}
                onCheckedChange={(next) => toggleCategory(types, next)}
              />
            ))}
      </div>
    </SettingsSection>
  )
}

function CalendarSection() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const calendarTokenMutation = useMutation({
    mutationFn: () => api.issueCalendarToken(token!),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.calendar.error")),
  })
  const feedUrl = calendarTokenMutation.data ? api.getCalendarFeedUrl(calendarTokenMutation.data.calendar_token) : null

  function copyFeedUrl() {
    if (!feedUrl) return
    navigator.clipboard.writeText(feedUrl).then(() => {
      setCopied(true)
      toast.success(t("profile.calendar.copied"))
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <SettingsSection id="calendar" icon={CalendarSync} title={t("profile.calendar.title")} description={t("profile.calendar.description")}>
      {feedUrl ? (
        <div className="flex animate-fade-in flex-col gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted p-1 pl-3">
            <code className="flex-1 truncate font-mono text-xs text-muted-foreground">{feedUrl}</code>
            <Button size="sm" variant={copied ? "secondary" : "default"} onClick={copyFeedUrl}>
              {copied ? <Check /> : <Copy />} {copied ? t("profile.calendar.copied") : t("profile.calendar.copy")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("profile.calendar.hint")}</p>
          <Button size="sm" variant="ghost" className="w-fit" isLoading={calendarTokenMutation.isPending} onClick={() => calendarTokenMutation.mutate()}>
            {!calendarTokenMutation.isPending && <RefreshCw />} {t("profile.calendar.regenerate")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-[13px] text-muted-foreground">{t("settings.calendar.cta")}</p>
          <Button size="sm" isLoading={calendarTokenMutation.isPending} onClick={() => calendarTokenMutation.mutate()}>
            {t("profile.calendar.generate")}
          </Button>
        </div>
      )}
    </SettingsSection>
  )
}

function AppearanceSection() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const options = [
    { value: "light" as const, label: t("settings.appearance.light"), icon: Sun },
    { value: "dark" as const, label: t("settings.appearance.dark"), icon: Moon },
  ]
  return (
    <SettingsSection id="appearance" icon={Palette} title={t("settings.appearance.title")} description={t("settings.appearance.description")}>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium">{t("settings.appearance.theme")}</span>
        <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              onClick={() => theme !== option.value && toggleTheme()}
              className={cn(
                "flex flex-col items-start gap-3 rounded-lg border p-3 text-left text-[13px] font-medium transition-[border-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                theme === option.value ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-border-strong",
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-full items-end gap-1 rounded-md border p-1.5",
                  option.value === "dark" ? "border-panel-foreground/10 bg-panel" : "border-panel/10 bg-panel-foreground",
                )}
              >
                <span className={cn("h-full w-1/4 rounded-sm", option.value === "dark" ? "bg-panel-foreground/10" : "bg-panel/10")} />
                <span className="flex h-full flex-1 flex-col gap-1">
                  <span className={cn("h-1.5 w-2/3 rounded-full", option.value === "dark" ? "bg-panel-foreground/30" : "bg-panel/25")} />
                  <span className="h-1.5 w-1/3 rounded-full bg-brand" />
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <option.icon className="size-3.5" /> {option.label}
              </span>
            </button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Monitor className="size-3.5" /> {t("settings.appearance.systemHint")}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-[13px] font-medium">{t("nav.language")}</span>
        <LanguageSwitcher />
      </div>
    </SettingsSection>
  )
}

function SettingsPage() {
  const { t } = useTranslation()
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    const el = document.getElementById(location.hash.slice(1))
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }))
  }, [location.hash])

  const sections = [
    { id: "account", label: t("settings.account.title") },
    { id: "public-profile", label: t("playerProfile.visibility.title") },
    { id: "notifications", label: t("notificationPrefs.title") },
    { id: "calendar", label: t("profile.calendar.title") },
    { id: "appearance", label: t("settings.appearance.title") },
  ]

  return (
    <PageContainer>
      <PageHeader title={t("nav.settings")} description={t("settings.description")}>
        <nav aria-label={t("settings.sectionsNav")} className="-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-none">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                location.hash === `#${section.id}`
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {section.label}
            </a>
          ))}
        </nav>
      </PageHeader>
      <div className="flex flex-col">
        <AccountSection />
        <PublicProfileSection />
        <NotificationsSection />
        <CalendarSection />
        <AppearanceSection />
      </div>
    </PageContainer>
  )
}

export { SettingsPage }
