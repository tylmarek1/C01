import type { LucideIcon } from "lucide-react"

interface StatTileProps {
  label: string
  value: string | number
  icon: LucideIcon
}

function StatTile({ label, value, icon: Icon }: StatTileProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-hairline bg-card p-5 shadow-card">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e6f0ff] text-signal-blue">
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-ink-navy">{value}</span>
        <span className="text-sm text-slate-gray">{label}</span>
      </div>
    </div>
  )
}

export { StatTile }
