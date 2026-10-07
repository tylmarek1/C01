import { FilterChip } from "@/components/shared/filter-chip"
import { useSportLabels } from "@/components/shared/sport-icon"
import { useTranslation } from "@/lib/i18n"
import type { SportType } from "@/types"

const SPORT_TYPES: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]

/** Single-choice sport chips with an "any sport" option (team forms, discovery filters). */
function SportPicker({ value, onChange }: { value: SportType | "ANY"; onChange: (value: SportType | "ANY") => void }) {
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  return (
    <div className="flex flex-wrap gap-1.5">
      <FilterChip active={value === "ANY"} onClick={() => onChange("ANY")}>
        {t("teams.field.sport.any")}
      </FilterChip>
      {SPORT_TYPES.map((option) => (
        <FilterChip key={option} active={value === option} onClick={() => onChange(option)}>
          {sportLabels[option]}
        </FilterChip>
      ))}
    </div>
  )
}

export { SportPicker }
