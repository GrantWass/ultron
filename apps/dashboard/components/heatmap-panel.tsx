'use client'

import type { HeatmapCell } from '@/app/api/errors/analytics/route'

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon–Sun
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface HeatmapPanelProps {
  cells: HeatmapCell[]
}

export function HeatmapPanel({ cells }: HeatmapPanelProps) {
  const cellMap = new Map<string, number>()
  for (const c of cells) cellMap.set(`${c.dow}:${c.hour}`, c.count)

  const maxCount = Math.max(...cells.map((c) => c.count), 1)

  function opacity(count: number): number {
    if (count === 0) return 0
    return 0.12 + (count / maxCount) * 0.88
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground mb-3">
        Error frequency heatmap <span className="font-normal">(UTC)</span>
      </p>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-2 min-w-max">
          {/* Day labels column */}
          <div className="flex flex-col gap-[3px]">
            {/* Spacer for the hour-label row */}
            <div className="h-4" />
            {DAY_ORDER.map((dow, i) => (
              <div key={dow} className="h-3.5 flex items-center justify-end pr-1">
                <span className="text-[9px] text-muted-foreground leading-none">{DAY_LABELS[i]}</span>
              </div>
            ))}
          </div>

          {/* Grid columns — one per hour */}
          <div className="flex flex-col gap-[3px]">
            {/* Hour labels */}
            <div className="flex gap-[3px]">
              {HOURS.map((h) => (
                <div key={h} className="w-3.5 h-4 flex items-start justify-center">
                  {h % 6 === 0 && (
                    <span className="text-[9px] text-muted-foreground leading-none">{h}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Rows */}
            {DAY_ORDER.map((dow, di) => (
              <div key={dow} className="flex gap-[3px]">
                {HOURS.map((hour) => {
                  const count = cellMap.get(`${dow}:${hour}`) ?? 0
                  return (
                    <div
                      key={hour}
                      className="w-3.5 h-3.5 rounded-[2px]"
                      style={{
                        backgroundColor: count === 0
                          ? 'hsl(var(--muted))'
                          : `hsl(var(--primary) / ${opacity(count).toFixed(2)})`,
                      }}
                      title={`${DAY_LABELS[di]} ${String(hour).padStart(2, '0')}:00 UTC — ${count.toLocaleString()} event${count !== 1 ? 's' : ''}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-1.5">
        <span className="text-[9px] text-muted-foreground">Less</span>
        {[0, 0.15, 0.35, 0.6, 0.85, 1].map((o, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-[2px]"
            style={{ backgroundColor: o === 0 ? 'hsl(var(--muted))' : `hsl(var(--primary) / ${o})` }}
          />
        ))}
        <span className="text-[9px] text-muted-foreground">More</span>
      </div>
    </div>
  )
}
