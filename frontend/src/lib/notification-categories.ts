import { useTranslation } from "@/lib/i18n"
import type { NotificationType } from "@/types"

interface NotificationCategory {
  key: string
  types: NotificationType[]
}

// The backend mutes/unmutes individual NotificationType values, but toggling
// 19 of them one by one isn't a settings UI anyone wants — these are the
// user-facing groups shown instead. Every NotificationType must appear in
// exactly one group.
export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: "reservations",
    types: [
      "RESERVATION_CREATED",
      "RESERVATION_CONFIRMED",
      "RESERVATION_CANCELLED",
      "RESERVATION_CHANGED",
      "RESERVATION_EXPIRED",
      "RESERVATION_REJECTED",
    ],
  },
  { key: "reminders", types: ["RESERVATION_REMINDER"] },
  { key: "approvals", types: ["APPROVAL_REQUESTED"] },
  { key: "facility", types: ["FACILITY_UNAVAILABLE"] },
  { key: "waitlist", types: ["WAITLIST_JOINED", "WAITLIST_SLOT_OFFERED"] },
  { key: "achievements", types: ["ACHIEVEMENT_UNLOCKED", "CHALLENGE_COMPLETED"] },
  { key: "joinRequests", types: ["JOIN_REQUEST_RECEIVED", "JOIN_REQUEST_ACCEPTED", "JOIN_REQUEST_DECLINED"] },
  { key: "social", types: ["NEW_FOLLOWER"] },
  { key: "teams", types: ["TEAM_MEMBER_ADDED"] },
  { key: "matches", types: ["MATCH_RESULT_REPORTED"] },
]

export function useNotificationCategoryLabels(): Record<string, { title: string; description: string }> {
  const { t } = useTranslation()
  return {
    reservations: {
      title: t("notificationPrefs.reservations.title"),
      description: t("notificationPrefs.reservations.description"),
    },
    reminders: {
      title: t("notificationPrefs.reminders.title"),
      description: t("notificationPrefs.reminders.description"),
    },
    approvals: {
      title: t("notificationPrefs.approvals.title"),
      description: t("notificationPrefs.approvals.description"),
    },
    facility: {
      title: t("notificationPrefs.facility.title"),
      description: t("notificationPrefs.facility.description"),
    },
    waitlist: {
      title: t("notificationPrefs.waitlist.title"),
      description: t("notificationPrefs.waitlist.description"),
    },
    achievements: {
      title: t("notificationPrefs.achievements.title"),
      description: t("notificationPrefs.achievements.description"),
    },
    joinRequests: {
      title: t("notificationPrefs.joinRequests.title"),
      description: t("notificationPrefs.joinRequests.description"),
    },
    social: {
      title: t("notificationPrefs.social.title"),
      description: t("notificationPrefs.social.description"),
    },
    teams: {
      title: t("notificationPrefs.teams.title"),
      description: t("notificationPrefs.teams.description"),
    },
    matches: {
      title: t("notificationPrefs.matches.title"),
      description: t("notificationPrefs.matches.description"),
    },
  }
}
