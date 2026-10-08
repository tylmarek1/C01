import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HALF_HOURS } from "@/lib/time-of-day"

function TimeOfDaySelect({
  value,
  onValueChange,
  label,
  className,
  disabled,
}: {
  value: string
  onValueChange: (value: string) => void
  label: string
  className?: string
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className={className ?? "w-[6.5rem] font-mono tabular"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {HALF_HOURS.map((time) => (
          <SelectItem key={time} value={time} className="font-mono tabular">
            {time}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { TimeOfDaySelect }
