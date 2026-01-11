---
date: 2026-01-11T16:50:00-05:00
researcher: Claude
git_commit: e67fb1c0546573da4bff23b18ffce9bcd91692a4
branch: main
repository: calendarclub
topic: "Events found but not displayed in UI - SSE data flow investigation"
tags: [research, codebase, sse, events, frontend, type-mismatch, bug]
status: complete
last_updated: 2026-01-11
last_updated_by: Claude
---

# Research: Events Found But Not Displayed in UI

**Date**: 2026-01-11T16:50:00-05:00
**Researcher**: Claude
**Git Commit**: e67fb1c0546573da4bff23b18ffce9bcd91692a4
**Branch**: main
**Repository**: calendarclub

## Research Question

The chat says "I found 2 events for you!" but no event cards are displayed in the UI. Backend logs confirm 2 events were streamed via SSE. Where is the disconnect?

## Summary

**Root Cause Identified**: Two bugs working together cause events to silently fail to display:

1. **Type mismatch in date handling**: Backend sends `startTime` as a string, but frontend code attempts to call `.getTime()` on it (a Date method), throwing a TypeError.

2. **Silent error swallowing**: The SSE parsing code has an overly broad try-catch that silently swallows ALL errors, not just JSON parsing errors, causing the TypeError to be ignored.

**Result**: Events are fetched and streamed correctly, but the mapping function throws an error that gets silently swallowed. `pendingResults` is never populated, so `showResults` remains `false`.

## Detailed Findings

### 1. Backend Event Format (`api/index.py:215-226`)

The backend sends events in this format:

```python
events_data = [
    {
        "id": evt.id,
        "title": evt.title,
        "startTime": evt.date,      # String, e.g., "2023-10-16T14:00:00"
        "location": evt.location,
        "categories": [evt.category],
        "url": evt.url,
        "source": search_result.source,
    }
    for evt in search_result.events
]
```

**Key observation**: No `endTime` field is included in the event data.

### 2. Frontend Type Expectations

The component `CalendarEvent` type (`frontend/src/components/calendar/types.ts:1-11`) expects:

```typescript
export interface CalendarEvent {
    id: string;
    title: string;
    startTime: Date;    // Expects Date object
    endTime: Date;      // Expects Date object
    category: "meetup" | "startup" | "community" | "ai";
    venue?: string;
    neighborhood?: string;
    canonicalUrl: string;
    sourceId: string;
}
```

### 3. Broken Type Import (`frontend/src/components/discovery/DiscoveryChat.tsx:5-6`)

```typescript
import {
    type CalendarEvent as ApiCalendarEvent,  // DOESN'T EXIST!
    api,
    type ChatStreamEvent,
    type QuickPickOption,
} from "@/lib/api";
```

TypeScript confirms this error:
```
error TS2614: Module '"@/lib/api"' has no exported member 'CalendarEvent'.
```

At runtime, `ApiCalendarEvent` becomes `any`, bypassing type safety.

### 4. The Failing Mapping Function (`frontend/src/components/discovery/DiscoveryChat.tsx:44-68`)

```typescript
function mapApiEventToCalendarEvent(event: ApiCalendarEvent): CalendarEvent {
    // ...
    return {
        id: event.id,
        title: event.title,
        startTime: event.startTime,  // Passes string through (should be Date)
        endTime: event.endTime || new Date(event.startTime.getTime() + 7200000),
        //                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        //                              THROWS: "2023-10-16T14:00:00".getTime() is not a function
        // ...
    };
}
```

When `endTime` is missing (which it always is from the backend), the fallback attempts `event.startTime.getTime()`. Since `startTime` is a string, not a Date, this throws a TypeError.

### 5. Silent Error Swallowing (`frontend/src/lib/api.ts:168-175`)

```typescript
for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    try {
        const data = JSON.parse(line.slice(6)) as ChatStreamEvent;
        onChunk(data);  // If this throws, error is swallowed below!
    } catch {
        // Skip malformed JSON  <-- ACTUALLY SWALLOWS ALL ERRORS
    }
}
```

The empty catch block was intended to skip malformed JSON, but it catches ALL exceptions including the TypeError from the mapping function. The error is silently ignored.

### 6. The Observable Result

1. Backend streams `content` events with message text - **processed successfully**
2. Backend streams `events` event with 2 events - **throws TypeError, silently swallowed**
3. Backend streams more `content` with "I found 2 events" - **processed successfully**
4. Backend streams `done` event - **processed successfully**
5. `pendingResults` remains empty (never set due to error)
6. `showResults = !isProcessing && pendingResults.length > 0` evaluates to `false`
7. UI shows chat message but no event cards

## Code References

| File | Line(s) | Issue |
|------|---------|-------|
| `api/index.py` | 215-226 | Backend sends `startTime` as string, no `endTime` |
| `frontend/src/components/discovery/DiscoveryChat.tsx` | 6 | Broken import of non-existent type |
| `frontend/src/components/discovery/DiscoveryChat.tsx` | 62 | Calls `.getTime()` on string |
| `frontend/src/lib/api.ts` | 173-175 | Silent catch swallows all errors |
| `frontend/src/components/calendar/types.ts` | 4-5 | CalendarEvent expects Date objects |

## Architecture Documentation

### SSE Data Flow

```
Backend (Python)                         Frontend (TypeScript)
─────────────────                        ────────────────────
POST /api/chat/stream
    │
    ├─► sse_event("content", {...})  ──► handleChunk() ──► setStreamingMessage()
    │
    ├─► sse_event("events", {...})   ──► handleChunk() ──► mapApiEventToCalendarEvent()
    │                                                           │
    │                                                           └─► TypeError! (swallowed)
    │
    ├─► sse_event("content", {...})  ──► handleChunk() ──► setStreamingMessage()
    │
    └─► sse_event("done", {})        ──► handleChunk() ──► setMessages(), setIsProcessing(false)
```

### Type Hierarchy

```
Wire Format (JSON)          API Type              Component Type
─────────────────          ─────────              ──────────────
DiscoveryEventWire         (broken import)       CalendarEvent
  startTime: string    ─?─► ApiCalendarEvent ─?─►  startTime: Date
  endTime?: string          (doesn't exist)        endTime: Date
```

## Related Research

- [Event Source API Failures](./2026-01-11-event-source-api-failures.md) - Backend API failures (different issue)
- [Event Source Registration Missing](./2026-01-11-event-source-registration-missing.md) - Registration not being called

## Open Questions

1. Should the backend include `endTime` in the event data?
2. Should the frontend parse date strings to Date objects in the mapping function?
3. Should the SSE error handling be more specific to only catch JSON parse errors?
4. Should the broken `CalendarEvent` import be removed or fixed?

---

## Recommended Fixes (For Reference)

### Option A: Fix Frontend Mapping (Minimal Change)

Parse date strings in `mapApiEventToCalendarEvent`:

```typescript
function mapApiEventToCalendarEvent(event: DiscoveryEventWire): CalendarEvent {
    const startTime = new Date(event.startTime);
    return {
        // ...
        startTime,
        endTime: event.endTime ? new Date(event.endTime) : new Date(startTime.getTime() + 7200000),
        // ...
    };
}
```

### Option B: Fix Error Handling (Essential)

Make the catch block specific:

```typescript
try {
    const data = JSON.parse(line.slice(6)) as ChatStreamEvent;
    onChunk(data);
} catch (e) {
    if (e instanceof SyntaxError) {
        // Skip malformed JSON
        continue;
    }
    throw e;  // Re-throw other errors
}
```

### Option C: Backend Sends Dates + endTime

Add `endTime` to event data in `api/index.py`.
