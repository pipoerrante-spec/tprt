"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Compatibility props to match what Wizard passes
export type CalendarProps = {
  className?: string
  classNames?: any
  showOutsideDays?: boolean
  mode?: "single" | "range" | "default" | "multiple"
  selected?: Date | undefined
  onSelect?: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
  initialFocus?: boolean
}

export function Calendar({
  className,
  selected,
  onSelect,
  disabled,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  // Generate days based on Monday start (es locale default)
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)

  // Force start of week to Monday using locale es
  const startDate = startOfWeek(monthStart, { locale: es })
  const endDate = endOfWeek(monthEnd, { locale: es })

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  // Fixed headers for Spanish (Mon-Sun)
  const weekDays = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"]

  const handleSelect = (day: Date) => {
    if (onSelect) {
      onSelect(day);
    }
  };

  return (
    <div className={cn("p-4 bg-white select-none", className)}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-1">
        <span className="text-lg font-bold capitalize text-gray-900">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full border-gray-200 hover:bg-gray-100 hover:text-gray-900"
            onClick={previousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full border-gray-200 hover:bg-gray-100 hover:text-gray-900"
            onClick={nextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday Grid */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="h-8 flex items-center justify-center text-[0.8rem] font-semibold text-gray-400 uppercase tracking-wide">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 lg:gap-2">
        {calendarDays.map((day, dayIdx) => {
          const isSelected = selected ? isSameDay(day, selected) : false
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isDisabled = disabled ? disabled(day) : false
          const isDayToday = isToday(day)

          // If simple string comparison for disabled (e.g. past dates in wizard)
          // The Wizard passes pure Date object comparison, likely correctly handled here.

          return (
            <button
              key={day.toString()}
              onClick={() => {
                if (!isDisabled && isCurrentMonth) {
                  handleSelect(day)
                }
              }}
              disabled={isDisabled || !isCurrentMonth}
              className={cn(
                "group relative h-10 w-10 lg:h-11 lg:w-11 text-sm rounded-full flex items-center justify-center transition-all mx-auto focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                // Visibility logic for days outside month
                !isCurrentMonth && "opacity-0 pointer-events-none",

                // Base Interactive State
                isCurrentMonth && !isDisabled && !isSelected && "text-gray-700 hover:bg-gray-100 font-medium hover:scale-110",

                // Selected State
                isSelected && "bg-primary text-white shadow-lg shadow-primary/30 font-bold scale-105 z-10",

                // Today State (if not selected)
                isDayToday && !isSelected && "text-primary font-extrabold ring-1 ring-primary/30 bg-primary/5",

                // Disabled State
                isDisabled && isCurrentMonth && "text-gray-300 cursor-not-allowed line-through decoration-gray-300 opacity-60"
              )}
              aria-label={format(day, "PPPP", { locale: es })}
              aria-selected={isSelected}
            >
              <time dateTime={format(day, 'yyyy-MM-dd')}>
                {format(day, "d")}
              </time>

              {/* Optional: Indicator dot for available slots or similar logic could go here */}
              {isSelected && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full opacity-60"></span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
Calendar.displayName = "Calendar"
