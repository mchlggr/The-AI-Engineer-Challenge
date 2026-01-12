---
date: 2026-01-12T03:45:00Z
researcher: Claude
git_commit: ed6773a
branch: main
repository: calendarclub
topic: "Calendar Sheet Overlay with Next.js Parallel Routes + Event Date Analysis"
tags: [research, codebase, calendar, next.js, parallel-routes, event-dates, backend]
status: complete
last_updated: 2026-01-11
last_updated_by: Claude
---

# Research: Calendar Sheet Overlay with Next.js Parallel Routes + Event Date Analysis

**Date**: 2026-01-12T03:45:00Z
**Researcher**: Claude
**Git Commit**: ed6773a
**Branch**: main
**Repository**: calendarclub

## Research Questions

1. Why are all events appearing on Sunday? Trace the backend date extraction flow.
2. How can we implement a calendar sheet overlay using Next.js App Router patterns?

## Summary

### Backend Date Issue: ROOT CAUSE FOUND

**The problem**: Scraped events (Posh, Luma, Partiful, Meetup scraper) default to `datetime.now()` when date parsing fails. This means events with unparseable dates all appear on the CURRENT day, not Sunday specifically.

**Key code** (`api/agents/search.py:136`):
```python
date_str = datetime.now().isoformat()  # DEFAULT FALLBACK
if event.start_time:
    date_str = event.start_time.isoformat()
```

### Next.js Solution: Parallel + Intercepting Routes

Use **Parallel Routes** (`@modal` slot) combined with **Intercepting Routes** (`(.)week`) to create a URL-based modal overlay that:
- Has its own URL (`/week`)
- Preserves homepage state when opened
- Supports smooth slide-up animation
- Blurs background

---

## Part 1: Backend Event Date Analysis

### Data Flow Overview

```
Source APIs → Source Models → EventResult → API Response → Frontend
(datetime)    (datetime)      (ISO str)    (startTime)    (Date obj)
```

### Critical Finding: Date Default Fallback

**File**: `/api/agents/search.py:128-151`

Scraped events converter:
```python
def _convert_scraped_event(event: ScrapedEvent) -> EventResult:
    # Format date
    date_str = datetime.now().isoformat()  # ← DEFAULT TO NOW
    if event.start_time:
        date_str = event.start_time.isoformat()

    return EventResult(
        id=f"posh-{event.event_id}",
        date=date_str,  # May be current time if start_time is None
        ...
    )
```

**Also affects** (`search.py:103-105`):
```python
# Exa events
date_str = datetime.now().isoformat()  # Default
if result.published_date:
    date_str = result.published_date.isoformat()
```

### Why Dates Are Missing from Scraped Events

Each Firecrawl extractor uses `dateparser` to parse natural language dates:

**Posh** (`firecrawl.py:285-321`):
```python
def _parse_datetime(self, date_str, time_str):
    if not date_str:
        return None, None  # ← Returns None if date missing

    start_dt = dateparser.parse(
        combined,
        settings={"PREFER_DATES_FROM": "future"},
    )
    return start_dt, end_dt  # ← May return None on parse failure
```

**Failure modes**:
1. Firecrawl extraction schema doesn't capture date field
2. Website structure changed, date selector doesn't match
3. Date format is unparseable by dateparser (e.g., "Jan 15th @ 8pm")
4. Date string is empty or malformed

### Source Comparison: Date Handling

| Source | `start_time` | Missing Date Behavior |
|--------|--------------|----------------------|
| Eventbrite API | Required `datetime` | Event excluded |
| Meetup GraphQL | Required `datetime` | Event excluded |
| Posh (scraper) | Optional `datetime | None` | Defaults to now |
| Luma (scraper) | Optional `datetime | None` | Defaults to now |
| Partiful (scraper) | Optional `datetime | None` | Defaults to now |
| Exa (search) | Optional | Defaults to now |

**The inconsistency**: API sources **exclude** events without dates. Scrapers **include** them with current timestamp.

### Active Event Sources

**File**: `/api/index.py:51-59`

```python
register_eventbrite_source()
# register_meetup_source()  # ← Commented out (GraphQL API)
register_exa_source()
register_posh_source()
register_luma_source()
register_partiful_source()
register_meetup_scraper_source()  # ← Firecrawl scraper instead
register_exa_research_source()
```

Most active sources are **scrapers** that can have missing dates.

### Frontend Date Processing

**File**: `frontend/src/components/discovery/DiscoveryChat.tsx:61`

```typescript
const startTime = new Date(event.startTime);  // Parses ISO string
```

**File**: `frontend/src/components/calendar/WeekView.tsx:34`

```typescript
.filter((event) => isSameDay(event.startTime, date))
```

The frontend correctly parses and filters dates. The issue is upstream in the backend.

### Recommended Backend Fixes

**Option A**: Exclude events without dates (consistent with API sources)
```python
def _convert_scraped_event(event: ScrapedEvent) -> EventResult | None:
    if not event.start_time:
        return None  # Skip events without dates
    ...
```

**Option B**: Add logging to identify failing extractors
```python
if not event.start_time:
    logger.warning(
        "Event missing date: source=%s title=%s url=%s",
        event.source, event.title, event.url
    )
```

**Option C**: Improve date parsing in extractors
- Add fallback date patterns
- Log parse failures with the original date string
- Use multiple extraction selectors per website

---

## Part 2: Next.js Parallel Routes for Calendar Sheet

### Architecture Overview

**Parallel Routes**: Render multiple pages simultaneously using "slots" (folders prefixed with `@`)

**Intercepting Routes**: Override navigation to show alternate content using conventions like `(.)`

**Combined**: Creates URL-based modals that preserve background state.

### File Structure for Calendar Sheet

```
app/
├── layout.tsx              # Root layout with calendar slot
├── page.tsx                # Homepage
├── @calendar/              # Parallel route slot
│   ├── default.tsx         # Returns null (hides modal by default)
│   └── (.)week/            # Intercepts /week route
│       └── page.tsx        # Calendar sheet modal
└── week/
    └── page.tsx            # Full-page calendar (direct access)
```

### Implementation Details

**1. Root Layout** (`app/layout.tsx`):
```tsx
export default function RootLayout({
  children,
  calendar,
}: {
  children: React.ReactNode
  calendar: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {calendar}
      </body>
    </html>
  )
}
```

**2. Default Slot** (`app/@calendar/default.tsx`):
```tsx
export default function Default() {
  return null  // Modal hidden by default
}
```

**3. Intercepted Route** (`app/@calendar/(.)week/page.tsx`):
```tsx
"use client"
import { CalendarSheet } from "@/components/calendar/CalendarSheet"

export default function WeekModal() {
  return <CalendarSheet />
}
```

**4. Full Page Fallback** (`app/week/page.tsx`):
```tsx
// Existing week page - shown on direct navigation or refresh
```

### Sheet Component with Animation

```tsx
"use client"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { WeekView } from "./WeekView"

export function CalendarSheet() {
  const router = useRouter()

  return (
    <>
      {/* Backdrop with blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => router.back()}
      />

      {/* Sheet sliding up from bottom */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 h-[85vh] bg-white rounded-t-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center py-3">
          <div className="h-1.5 w-12 rounded-full bg-gray-300" />
        </div>

        {/* Close button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 right-4"
        >
          Close
        </button>

        {/* Calendar content */}
        <WeekView ... />
      </motion.div>
    </>
  )
}
```

### How Navigation Works

| Action | Result |
|--------|--------|
| Click "View Week" on homepage | Modal opens, URL becomes `/week` |
| Click backdrop or close | `router.back()`, modal closes, URL returns to `/` |
| Press browser back | Modal closes naturally |
| Direct navigate to `/week` | Full page calendar (no modal) |
| Refresh while modal open | Full page calendar (can't restore modal state) |

### Key Benefits

1. **URL-based**: Calendar has shareable URL (`/week`)
2. **State preserved**: Homepage doesn't unmount when modal opens
3. **Natural navigation**: Browser back button closes modal
4. **Progressive enhancement**: Direct URL works as full page

### Alternative: Shadcn UI Sheet

If you want a pre-built solution:

```bash
npx shadcn@latest add sheet
```

```tsx
import { Sheet, SheetContent } from "@/components/ui/sheet"

export function CalendarSheet({ open, onClose }) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh]">
        <WeekView ... />
      </SheetContent>
    </Sheet>
  )
}
```

---

## Code References

### Backend Date Flow
| File | Line | Description |
|------|------|-------------|
| `api/agents/search.py` | 136 | Scraped event date fallback to `datetime.now()` |
| `api/agents/search.py` | 103-105 | Exa event date fallback |
| `api/services/firecrawl.py` | 285-321 | Posh date parsing |
| `api/services/firecrawl.py` | 555-603 | Luma date parsing |
| `api/services/firecrawl.py` | 798-842 | Partiful date parsing |
| `api/index.py` | 251 | `startTime: evt.date` in API response |

### Frontend Date Flow
| File | Line | Description |
|------|------|-------------|
| `DiscoveryChat.tsx` | 61 | `new Date(event.startTime)` parsing |
| `week/page.tsx` | 26 | Session storage date re-parsing |
| `WeekView.tsx` | 34 | `isSameDay()` filtering |

---

## Open Questions

1. **Which scrapers are failing?** Add logging to identify which sources return events without dates
2. **Dateparser settings?** Consider adding timezone settings to dateparser for consistency
3. **Framer Motion vs CSS?** Framer adds ~50KB - consider CSS animations for lighter bundle

---

## Sources

**Next.js Documentation**:
- [Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)
- [Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)

**Implementation Examples**:
- [wildpics Demo](https://github.com/JaleelB/wildpics) - Complete parallel routes modal
- [next-intercepting-routes-demo](https://github.com/krishnerkar/next-intercepting-routes-demo)

**Animation Resources**:
- [shadcn/ui Sheet](https://ui.shadcn.com/docs/components/sheet)
- [Framer Motion Drawer Tutorial](https://dev.to/morewings/lets-create-an-animated-drawer-using-react-and-tailwind-css-3ddp)
