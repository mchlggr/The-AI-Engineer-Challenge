---
date: 2026-01-12T03:32:34Z
researcher: Claude
git_commit: ed6773a
branch: main
repository: calendarclub
topic: "Calendar Event Distribution and Day Styling"
tags: [research, codebase, calendar, weekview, styling]
status: complete
last_updated: 2026-01-11
last_updated_by: Claude
---

# Research: Calendar Event Distribution and Day Styling

**Date**: 2026-01-12T03:32:34Z
**Researcher**: Claude
**Git Commit**: ed6773a
**Branch**: main
**Repository**: calendarclub

## Research Question
1. Why are all events appearing on Sunday instead of being distributed across the week?
2. How can we highlight only the current day (not weekends)?
3. Why is the grid pattern missing on weekends?

## Summary

The calendar system uses JavaScript Date objects and compares dates using year/month/day. Events appear on specific days based on their `startTime` property. Two issues were identified:

1. **Grid pattern on weekends**: The `weekend-column` CSS class applies a **solid background** that covers the parent's grid pattern
2. **Day highlighting**: Both weekends AND today receive special styling - the current implementation highlights weekends with a yellow tint

## Detailed Findings

### Event Date Distribution Logic

**File**: `frontend/src/components/calendar/WeekView.tsx:32-36`

Events are filtered to each day using `isSameDay()`:

```typescript
function getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events
    .filter((event) => isSameDay(event.startTime, date))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
```

The `isSameDay()` function compares year, month, and day:

```typescript
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
```

**If events appear on Sunday**, it means the `startTime` dates on those events all have the same date value when compared. Possible causes:
- Events from backend all have the same date
- Timezone conversion issue (UTC dates falling on different local days)
- Events stored in sessionStorage losing date fidelity

### Week Start Calculation

**File**: `frontend/src/app/week/page.tsx:7-13`

```typescript
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();  // 0=Sunday, 6=Saturday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
```

Week always starts on **Sunday** (index 0).

### Day Column Generation

**File**: `frontend/src/components/calendar/WeekView.tsx:72-76`

```typescript
const days = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + i);
  return date;
});
```

Generates 7 dates: Sunday (index 0) through Saturday (index 6).

### Grid Pattern Issue (IDENTIFIED)

**File**: `frontend/src/components/calendar/WeekView.tsx:94`

The grid is applied to the **parent container**:
```typescript
<div className="grid grid-cols-7 bg-grid-paper">
```

**File**: `frontend/src/components/calendar/DayColumn.tsx:27`

But day columns have **conditional backgrounds**:
```typescript
className={cn(
  "flex min-h-[220px] flex-col gap-2 border-r-2 border-text-primary p-3 last:border-r-0",
  isWeekend ? "weekend-column" : "bg-transparent",  // ← HERE
  isToday && "today-column",
  hasHighDensity && "density-high",
  className,
)}
```

**File**: `frontend/src/styles/globals.css:580-582`

```css
.weekend-column {
  background-color: color-mix(in oklab, var(--color-accent-yellow) 12%, white);
}
```

**Problem**: For weekdays, `bg-transparent` lets the grid show through. For weekends, `weekend-column` applies a **solid white+yellow background** that **covers** the grid pattern.

### Today Highlighting (CURRENT BEHAVIOR)

**File**: `frontend/src/styles/globals.css:584-588`

```css
.today-column {
  outline: 2px solid var(--color-accent-orange);
  outline-offset: -2px;
  background-color: color-mix(in oklab, var(--color-accent-yellow) 8%, white);
}
```

**File**: `frontend/src/components/calendar/WeekHeader.tsx:55-56`

Today also gets an orange dot indicator:
```typescript
{isToday && (
  <span className="h-2 w-2 rounded-full border border-text-primary bg-accent-orange" />
)}
```

### Weekend Detection

**File**: `frontend/src/components/calendar/WeekView.tsx:28-30`

```typescript
function isWeekend(dayIndex: number): boolean {
  return dayIndex === 0 || dayIndex === 6;  // Sunday or Saturday
}
```

## Code References

| File | Line | Description |
|------|------|-------------|
| `WeekView.tsx` | 20-26 | `isSameDay()` date comparison function |
| `WeekView.tsx` | 28-30 | `isWeekend()` detection (index 0 or 6) |
| `WeekView.tsx` | 32-36 | `getEventsForDay()` filters events by date |
| `WeekView.tsx` | 94 | `bg-grid-paper` on container |
| `DayColumn.tsx` | 27 | Weekend column gets solid background |
| `globals.css` | 181-186 | `.bg-grid-paper` definition |
| `globals.css` | 580-582 | `.weekend-column` solid background |
| `globals.css` | 584-588 | `.today-column` outline + background |
| `week/page.tsx` | 7-13 | `getWeekStart()` calculation |
| `week/page.tsx` | 19-42 | Session storage date parsing |

## Architecture Documentation

### Data Flow: Backend → Frontend

1. **Backend** (`api/agents/search.py:86`): `date=event.start_time.isoformat()` - sends ISO string
2. **Frontend API** (`lib/api.ts:13-30`): `startTime: string` - receives as string
3. **Mapping** (`DiscoveryChat.tsx:61`): `new Date(event.startTime)` - parses to Date
4. **Storage** (`week/page.tsx:20`): JSON stringify loses Date type → re-parse on load
5. **Display** (`WeekView.tsx:34`): `isSameDay(event.startTime, date)` - compares

### Styling Hierarchy

```
.bg-grid-paper (container)
  └── DayColumn
        ├── weekday: bg-transparent (grid shows through)
        └── weekend: .weekend-column (solid background covers grid)
              └── if today: .today-column (outline + background)
```

## Fixes Required

### Fix 1: Grid Pattern on All Days

Change `DayColumn.tsx:27` to not apply a solid background on weekends. Instead, dim weekends with opacity or use a semi-transparent overlay.

**Current**:
```typescript
isWeekend ? "weekend-column" : "bg-transparent",
```

**Option A**: Use transparent background for all days, add opacity for weekend dimming
**Option B**: Add grid background to each column instead of parent

### Fix 2: Only Highlight Current Day

Remove or modify weekend highlighting so only today gets the visual emphasis.

**Current styling**:
- Weekends: 12% yellow tint + orange date numbers
- Today: 8% yellow tint + orange outline

**User's desired behavior**:
- All days: Same grid pattern
- Today only: Some form of highlight
- Weekends: Dimmed but still showing grid

## Open Questions

1. **Why events on Sunday?** Need to inspect actual event data being returned from backend. Could be:
   - Backend returning events all with same date
   - UTC→local timezone conversion placing events on wrong day
   - Browser/system timezone differences

2. **Desired weekend styling?** Should weekends be dimmed with opacity, or just have the same styling as weekdays?
