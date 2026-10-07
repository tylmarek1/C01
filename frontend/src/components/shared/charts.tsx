import type { ReactNode } from "react"

import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Small, dependency-free chart marks for the admin dashboard. Single-series
 * only (no legend needed — the card title names the series), thin marks with
 * 4px rounded data-ends anchored to the baseline, a 2px gap between bars,
 * recessive gridlines, and a hover/focus tooltip on every mark. Text uses
 * text tokens, never the series colour. See DESIGN.md "Data visualisation".
 */

export interface BarDatum {
  key: string
  label: string
  value: number
  tooltip?: ReactNode
}

function niceMax(value: number): number {
  if (value <= 4) return 4
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((s) => value <= s * magnitude) ?? 10
  return step * magnitude
}

/** Vertical bars over a category axis (e.g. demand per hour). The peak bar
 * is drawn in the brand accent so the headline reads without a legend. */
function ColumnChart({
  data,
  height = 160,
  tickEvery = 1,
  highlightMax = true,
  ariaLabel,
}: {
  data: BarDatum[]
  height?: number
  tickEvery?: number
  highlightMax?: boolean
  ariaLabel: string
}) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const peak = Math.max(...data.map((d) => d.value))
  const gridlines = [1, 0.5, 0]

  return (
    <figure aria-label={ariaLabel} className="flex flex-col gap-2">
      <div className="relative flex gap-2" style={{ height }}>
        <div className="flex w-6 shrink-0 flex-col justify-between text-right font-mono text-[10px] text-subtle-foreground tabular">
          {gridlines.map((g) => (
            <span key={g} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {Math.round(max * g)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {gridlines.map((g) => (
            <div key={g} aria-hidden className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${g * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((datum) => {
              const pct = max > 0 ? (datum.value / max) * 100 : 0
              const isPeak = highlightMax && datum.value === peak && peak > 0
              return (
                <Tooltip key={datum.key} content={datum.tooltip ?? `${datum.label}: ${datum.value}`}>
                  <button
                    type="button"
                    aria-label={`${datum.label}: ${datum.value}`}
                    className="group/bar relative flex h-full flex-1 items-end outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <span
                      className={cn(
                        "w-full origin-bottom animate-[grow-y_600ms_var(--ease-out)_both] rounded-t-[4px] transition-colors",
                        datum.value === 0 ? "h-[2px] bg-border" : isPeak ? "bg-brand" : "bg-chart-1/85 group-hover/bar:bg-chart-1",
                      )}
                      style={datum.value === 0 ? undefined : { height: `${Math.max(2, pct)}%` }}
                    />
                  </button>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="w-6 shrink-0" />
        <div className="flex flex-1 gap-[2px]">
          {data.map((datum, index) => (
            <span key={datum.key} className="flex-1 text-center font-mono text-[10px] text-subtle-foreground tabular">
              {index % tickEvery === 0 ? datum.label : ""}
            </span>
          ))}
        </div>
      </div>
    </figure>
  )
}

/** Ranked horizontal bars — label, bar, value. For top-N lists and breakdowns. */
function BarList({
  data,
  ariaLabel,
  renderLabel,
  formatValue = (v) => String(v),
}: {
  data: BarDatum[]
  ariaLabel: string
  renderLabel?: (datum: BarDatum) => ReactNode
  formatValue?: (value: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-2.5">
      {data.map((datum) => (
        <li key={datum.key} className="grid grid-cols-[minmax(6rem,9rem)_1fr_3rem] items-center gap-3">
          <span className="truncate text-[13px] text-foreground">{renderLabel ? renderLabel(datum) : datum.label}</span>
          <Tooltip content={datum.tooltip ?? `${datum.label}: ${formatValue(datum.value)}`}>
            <span className="relative h-2 overflow-hidden rounded-full bg-chart-track" tabIndex={0} aria-label={`${datum.label}: ${formatValue(datum.value)}`}>
              <span
                className="absolute inset-y-0 left-0 origin-left animate-[grow-x_600ms_var(--ease-out)_both] rounded-full bg-chart-1"
                style={{ width: datum.value > 0 ? `${Math.max(2, (datum.value / max) * 100)}%` : 0 }}
              />
            </span>
          </Tooltip>
          <span className="text-right font-mono text-[12px] text-muted-foreground tabular">{formatValue(datum.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Sequential single-hue grid (day × hour occupancy). 0 is a neutral track. */
function Heatmap({
  rows,
  columns,
  value,
  tooltip,
  ariaLabel,
}: {
  rows: { key: string | number; label: string }[]
  columns: { key: string | number; label: string }[]
  value: (row: string | number, column: string | number) => number
  tooltip: (row: string | number, column: string | number, v: number) => string
  ariaLabel: string
}) {
  function cellClass(v: number) {
    if (v <= 0) return "bg-chart-track"
    if (v < 0.25) return "bg-heat/20"
    if (v < 0.5) return "bg-heat/45"
    if (v < 0.75) return "bg-heat/70"
    return "bg-heat"
  }
  return (
    <figure aria-label={ariaLabel} className="overflow-x-auto pb-1">
      <div className="grid min-w-[520px] gap-[3px]" style={{ gridTemplateColumns: `2.25rem repeat(${columns.length}, minmax(0, 1fr))` }}>
        <span />
        {columns.map((column) => (
          <span key={column.key} className="text-center font-mono text-[10px] text-subtle-foreground tabular">
            {column.label}
          </span>
        ))}
        {rows.map((row) => (
          <div key={row.key} className="contents">
            <span className="flex items-center font-mono text-[10.5px] text-muted-foreground">{row.label}</span>
            {columns.map((column) => {
              const v = value(row.key, column.key)
              return (
                <Tooltip key={column.key} content={tooltip(row.key, column.key, v)}>
                  <span tabIndex={0} aria-label={tooltip(row.key, column.key, v)} className={cn("aspect-square rounded-[3px] outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50", cellClass(v))} />
                </Tooltip>
              )
            })}
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[10px] text-subtle-foreground">
        0%
        {["bg-chart-track", "bg-heat/20", "bg-heat/45", "bg-heat/70", "bg-heat"].map((c) => (
          <span key={c} className={cn("size-3 rounded-[3px]", c)} />
        ))}
        100%
      </figcaption>
    </figure>
  )
}

export { BarList, ColumnChart, Heatmap }
