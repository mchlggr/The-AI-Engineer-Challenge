---
date: 2026-01-11T14:19:56-05:00
researcher: mchlggr
git_commit: b6f7950a423144da6c8e1d6845980ea0a0b35600
branch: main
repository: calendarclub
topic: "Emoji-based observability logging for event search and conversation flows"
tags: [research, codebase, logging, observability, api, events, search]
status: complete
last_updated: 2026-01-11
last_updated_by: mchlggr
---

# Research: Emoji-based Observability Logging for Event Search & Conversation

**Date**: 2026-01-11T14:19:56-05:00
**Researcher**: mchlggr
**Git Commit**: b6f7950a423144da6c8e1d6845980ea0a0b35600
**Branch**: main
**Repository**: calendarclub

## Research Question

Document current logging patterns, external API call locations, and conversation flows to inform an implementation plan for adding emoji-prefixed observability logging. The goal is human-readable console logs showing:
- When external API calls start/finish
- Async operation lifecycle
- Result counts and clean query representations
- Error messages surfaced clearly (not swallowed)

## Summary

The codebase uses standard Python `logging` module with `getLogger(__name__)` pattern across all API modules. There is **no emoji usage in logs currently**. External API calls (Eventbrite, Exa) happen in `api/services/` with basic info-level logging for results but **no start/finish markers**. The conversation flow streams through SSE with search handoff occurring when the clarifying agent determines sufficient preferences.

Key logging insertion points are well-defined:
1. **Eventbrite API**: `api/services/eventbrite.py:116-287`
2. **Exa API**: `api/services/exa_client.py:168-200`
3. **Search orchestration**: `api/agents/search.py:193-289`
4. **SSE streaming**: `api/index.py:119-251`
5. **Background tasks**: `api/services/background_tasks.py:70-169`

## Detailed Findings

### 1. Current Logging Configuration

**Central configuration** (`api/config.py:62-74`):
```python
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
```

**Key characteristics**:
- Standard format: `timestamp - module - level - message`
- Log level controlled via `LOG_LEVEL` env var (default: INFO)
- HTTP client logs suppressed: `httpx` and `httpcore` set to WARNING
- Each module creates own logger via `logger = logging.getLogger(__name__)`

**Files with loggers**:
- `api/index.py:35`
- `api/agents/search.py:27`
- `api/services/eventbrite.py:26`
- `api/services/exa_client.py:16`
- `api/services/background_tasks.py:16`
- `api/services/sse_connections.py:12`
- `api/services/firecrawl.py:18`
- `api/services/event_cache.py:18`

### 2. External API Call Locations

#### Eventbrite API (`api/services/eventbrite.py`)

**Entry point**: `search_eventbrite_async()` at line 96
**HTTP call**: Line 116 - POST to `https://www.eventbrite.com/api/v3/destination/search/`

```python
# Current state (line 116-142)
response = await client.post(
    "https://www.eventbrite.com/api/v3/destination/search/",
    json={...query params...}
)
```

**Current logging**: None for request start/finish
**Result processing**: Lines 166-287 parse `events` array from response
**Missing**: Start marker, finish marker, timing, result count log

#### Exa API (`api/services/exa_client.py`)

**Entry point**: `search_events()` at line 120
**HTTP call**: Lines 168-200 via Exa Python SDK

```python
# Current state (line 168-200)
result = self.client.search(
    query=query_text,
    type="neural",
    ...
)
```

**Current logging**:
- Line 96-97: Warning when API key not set
- No start/finish/timing logs

#### Registry-based Fetch (`api/agents/search.py`)

**Parallel execution** at line 237:
```python
results = await asyncio.gather(*fetch_tasks, return_exceptions=True)
```

**Current logging**:
- Line 253: `logger.info("%s returned %d events", source_name, len(converted))`
- Line 265-269: `logger.info("Merged %d events from %s, %d after dedup", ...)`
- Line 283: `logger.error("API source fetch error: %s", e, exc_info=True)`

**Missing**: Per-source start markers, timing, query representation

### 3. Conversation Flow Logging Points

**Stream entry** (`api/index.py:119-251`):

| Line | Current Log | Purpose |
|------|-------------|---------|
| 141 | `logger.info("Running ClarifyingAgent for message: %s", message[:50])` | Agent start |
| 167 | `logger.info("Handoff to search phase with profile: %s", profile)` | Search handoff |
| 244 | `logger.error("Stream error: %s", e, exc_info=True)` | Error handling |

**Background tasks** (`api/services/background_tasks.py`):

| Line | Current Log | Purpose |
|------|-------------|---------|
| 80-85 | `logger.info("Created Webset %s for session %s with query: %s", ...)` | Webset creation |
| 169 | `logger.info("Pushed %d Webset events to session %s", ...)` | Results push |

**SSE connections** (`api/services/sse_connections.py`):

| Line | Current Log | Purpose |
|------|-------------|---------|
| 41 | `logger.debug("Registered SSE connection for session: %s", ...)` | Connection start |
| 66 | `logger.debug("Pushed event to session %s: %s", ...)` | Event delivery |

### 4. Error Handling Patterns

**Current error surfacing** (`api/index.py:46-57`):
```python
def _format_user_error(error: Exception) -> str:
    """Format an exception into a user-friendly error message."""
    error_str = str(error).lower()
    if "api key" in error_str or "invalid" in error_str:
        return "There's a configuration issue. Please try again later."
    # ... other cases
```

**Important**: Errors are currently formatted for users but the **original error is logged separately** with `exc_info=True` at error handlers.

**Search error handling** (`api/agents/search.py:243-253`):
```python
for source_name, result in zip(sources_to_fetch, results):
    if isinstance(result, BaseException):
        logger.warning("Source %s failed: %s", source_name, result)
        continue
```

### 5. Emoji Usage Audit

**Current state**: **No emoji in any log statements**

Searched patterns:
- Common emoji characters
- Unicode emoji ranges
- The word "emoji"

**Result**: Only found emoji-regex npm package in node_modules. Zero emoji in application code or logs.

### 6. Telemetry Context (Frontend)

**HyperDX** (`frontend/src/lib/telemetry.ts:26`):
- `consoleCapture: true` - automatically captures console.log/error/warn
- Structured event tracking via `HyperDX.addAction()`

**Implication**: Console logs from frontend are captured, but backend logs require explicit observation setup (likely viewing server stdout).

## Recommended Logging Insertion Points

### External API Calls

**Pattern for each API call**:
```python
# START marker
logger.info("🌐 [Eventbrite] Starting search | query=%s location=%s", query, location)

# ... API call ...

# FINISH marker with timing and count
logger.info("✅ [Eventbrite] Complete | events=%d duration=%.2fs", len(events), elapsed)

# or on error
logger.warning("❌ [Eventbrite] Failed | error=%s duration=%.2fs", str(e), elapsed)
```

**Files requiring changes**:
1. `api/services/eventbrite.py` - Around lines 96-166
2. `api/services/exa_client.py` - Around lines 120-200
3. `api/agents/search.py` - Around lines 222-253 (orchestration level)

### Conversation Flow

**Pattern for phase transitions**:
```python
logger.info("💬 [Chat] User message received | session=%s length=%d", session_id, len(msg))
logger.info("🤔 [Clarify] Agent processing | session=%s", session_id)
logger.info("🔍 [Search] Handoff triggered | profile=%s", profile_summary)
logger.info("📤 [SSE] Streaming results | session=%s events=%d", session_id, count)
```

**Files requiring changes**:
1. `api/index.py` - Around lines 140-220

### Background Tasks

**Pattern for async operations**:
```python
logger.info("🚀 [Background] Starting Webset discovery | session=%s query=%s", ...)
logger.info("⏳ [Background] Polling Webset | webset=%s poll=%d/60", ...)
logger.info("🎉 [Background] Discovery complete | session=%s events=%d", ...)
```

**Files requiring changes**:
1. `api/services/background_tasks.py` - Around lines 70-169

### Empty Results

**Pattern for no-results cases**:
```python
logger.info("📭 [Search] No results | sources=%s query=%s", sources, query_repr)
```

## Code References

### Core Files
- `api/config.py:62-74` - Logging configuration
- `api/index.py:35` - Main API logger
- `api/index.py:119-251` - Stream chat response (conversation flow)
- `api/index.py:295-328` - Chat stream endpoint

### External API Services
- `api/services/eventbrite.py:96-287` - Eventbrite search implementation
- `api/services/exa_client.py:120-226` - Exa search implementation
- `api/agents/search.py:193-289` - Search orchestration

### Supporting Services
- `api/services/background_tasks.py:41-169` - Background discovery
- `api/services/sse_connections.py:31-68` - SSE connection management

### Current Logging Statements
- `api/agents/search.py:253` - Source result count
- `api/agents/search.py:265-269` - Merged event count
- `api/agents/search.py:283` - API error with traceback
- `api/index.py:141` - Clarifying agent start
- `api/index.py:167` - Search handoff
- `api/services/background_tasks.py:80-85` - Webset creation
- `api/services/background_tasks.py:169` - Webset results push

## Architecture Documentation

### Logging Architecture (Current)

```
┌─────────────────┐
│ logging.basicConfig() │  (api/config.py)
│ format: timestamp-module-level-message
└────────┬────────┘
         │
    ┌────▼────┐
    │ getLogger(__name__) │  (each module)
    └────┬────┘
         │
    ┌────▼────┐
    │ stdout/stderr │  (server console)
    └─────────┘
```

### Search Flow (with logging gaps marked)

```
User Message
    │
    ▼
[LOG: agent start] ─────────► ClarifyingAgent
    │
    ▼
ready_to_search?
    │
    ▼ yes
[LOG: handoff] ─────────────► search_events()
    │
    ├─[NO LOG: start]──────► Eventbrite API
    │       │
    │       └─[NO LOG: finish]
    │
    ├─[NO LOG: start]──────► Exa API
    │       │
    │       └─[NO LOG: finish]
    │
    ▼
[LOG: result counts] ──────► Dedupe & Sort
    │
    ▼
[NO LOG: streaming] ───────► SSE to frontend
```

## Suggested Emoji Vocabulary

| Emoji | Meaning | Usage |
|-------|---------|-------|
| 🌐 | External API call start | HTTP requests to third parties |
| ✅ | Success completion | API calls, search phases |
| ❌ | Error/failure | API failures, empty results |
| ⏱️ | Timing/duration | Performance metrics |
| 📊 | Count/statistics | Result counts, dedup stats |
| 💬 | User message | Chat input received |
| 🤔 | Processing/thinking | Agent deliberation |
| 🔍 | Search | Search phase start |
| 📤 | Sending/streaming | SSE event emission |
| 📭 | Empty/no results | Zero results returned |
| 🚀 | Async task start | Background jobs |
| ⏳ | Waiting/polling | Background task polling |
| 🎉 | Async completion | Background task done |
| ⚠️ | Warning | Non-fatal issues |

## Related Research

None currently in `thoughts/shared/research/`.

## Open Questions

1. **Log level for emoji logs**: Should observability logs be INFO or DEBUG?
2. **Structured logging**: Consider adding JSON logging option for log aggregation tools
3. **Timing precision**: Use `time.perf_counter()` vs `time.time()` for duration measurement
4. **Query sanitization**: How much of user query to log (PII concerns)?
5. **Rate limit awareness**: Should we log rate limit headers from APIs?
