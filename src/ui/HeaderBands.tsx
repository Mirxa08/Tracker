import { memo } from 'react'
import type { DayColumn, MonthSpan } from '../domain/time'

function HeaderBandsImpl({ days, months }: { days: DayColumn[]; months: MonthSpan[] }) {
  return (
    <div className="bands">
      <div className="bands__months">
        {months.map((m) => (
          <div
            key={m.key}
            className="month-span"
            data-testid="month-span"
            style={{ left: m.x, width: m.width }}
          >
            <span className="month-span__label">{m.label}</span>
          </div>
        ))}
      </div>
      <div className="bands__days">
        {days.map((d) => (
          <div
            key={d.date.toISOString()}
            className={[
              'day-column',
              d.isWeekend ? 'day-column--weekend' : '',
              d.isToday ? 'day-column--today' : '',
            ].join(' ').trim()}
            style={{ left: d.x }}
          >
            <span className="day-column__weekday">{d.weekday}</span>
            {d.day}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Memoised: the clock ticks every second but the bands only change when the days do. */
export const HeaderBands = memo(HeaderBandsImpl)
