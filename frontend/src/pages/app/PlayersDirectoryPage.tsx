import { useNavigate } from "react-router-dom"

import { EmptyState } from "@/components/shared/empty-state"
import { PlayerSearch } from "@/components/shared/player-search"
import { useTranslation } from "@/lib/i18n"

function PlayersDirectoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-ink-navy">{t("playersDirectory.title")}</h1>
        <p className="text-sm text-slate-gray">{t("playersDirectory.hint")}</p>
      </div>

      <div className="max-w-md">
        <PlayerSearch autoFocus onSelect={(player) => navigate(`/app/players/${player.id}`)} />
      </div>

      <EmptyState title={t("playersDirectory.empty")} />
    </div>
  )
}

export { PlayersDirectoryPage }
