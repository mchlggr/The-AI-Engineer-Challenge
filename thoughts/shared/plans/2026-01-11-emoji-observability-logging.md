# Emoji-based Observability Logging Implementation Plan

## Overview

Add emoji-prefixed DEBUG-level logging throughout the API backend to provide human-readable observability of the event search and conversation flow. These logs help developers understand what's happening during request processing, including external API calls, async operations, and SSE streaming.

## Current State Analysis

The codebase uses standard Python `logging.getLogger(__name__)` pattern. Current logs are sparse and lack:
- Start/finish markers for external API calls
- Timing information for performance debugging
- Clear visual distinction between log types
- Visibility into SSE connection lifecycle

### Key Discoveries:
- Logging configured in `api/config.py:62-74` with `LOG_LEVEL` env var (default: INFO)
- No emoji in any current log statements
- Some result count logs exist but no start markers
- Error handling already uses `exc_info=True` for tracebacks

## Desired End State

After implementation, running the API with `LOG_LEVEL=DEBUG` will show logs like:

```
2026-01-11 14:30:01 - api.index - DEBUG - 💬 [Chat] Message received | session=abc123 length=42
2026-01-11 14:30:01 - api.index - DEBUG - 🤔 [Clarify] Agent processing | session=abc123
2026-01-11 14:30:02 - api.index - DEBUG - 🔍 [Search] Handoff triggered | categories=['tech'] time_window=this_weekend
2026-01-11 14:30:02 - api.services.eventbrite - DEBUG - 🌐 [Eventbrite] Starting search | location=Columbus, OH categories=['tech']
2026-01-11 14:30:03 - api.services.eventbrite - DEBUG - ✅ [Eventbrite] Complete | events=5 duration=0.82s
2026-01-11 14:30:03 - api.services.exa_client - DEBUG - 🌐 [Exa] Starting search | query="events Columbus Ohio tech"
2026-01-11 14:30:04 - api.services.exa_client - DEBUG - ✅ [Exa] Complete | results=8 duration=1.21s
2026-01-11 14:30:04 - api.agents.search - DEBUG - 📊 [Search] Merged results | total=13 after_dedup=10
2026-01-11 14:30:04 - api.index - DEBUG - 📤 [SSE] Streaming events | session=abc123 count=10
```

### Verification:
1. Set `LOG_LEVEL=DEBUG` and run the server
2. Make a chat request
3. Verify emoji-prefixed logs appear in console showing the full request lifecycle

## What We're NOT Doing

- Changing existing INFO/WARNING/ERROR logs (only adding DEBUG)
- Adding structured JSON logging (future enhancement)
- Logging full query content (truncate to 50 chars for readability)
- Adding rate limit header logging (out of scope)
- Modifying log format string (keeping standard format)

## Implementation Approach

Add `logger.debug()` calls with emoji prefixes at key lifecycle points:
- **🌐** External API call start
- **✅** Success completion (with timing)
- **❌** Error/failure
- **⚠️** Warning (partial failure, fallback)
- **📊** Statistics (counts, dedup)
- **💬** User message received
- **🤔** Processing/thinking
- **🔍** Search phase
- **📤** SSE streaming
- **📭** Empty results
- **🚀** Async task start
- **⏳** Polling
- **🎉** Async completion
- **🔌** SSE connection lifecycle

---

## Phase 1: External API Services

### Overview
Add start/finish logging with timing to Eventbrite and Exa API calls.

### Changes Required:

#### 1.1 Eventbrite API Logging

**File**: `api/services/eventbrite.py`

**Import time module** (add to imports at top):
```python
import time
```

**Add start/finish logs around the API call** in `_search_via_destination_api()` method.

Replace lines 197-234 (the try block) with logging wrapper:

```python
    try:
        # Try the destination events endpoint
        endpoint = f"/destination/events/{location_slug}/"
        logger.debug(
            "🌐 [Eventbrite] Starting search | endpoint=%s location=%s",
            endpoint,
            location or "Columbus--OH",
        )
        start_time = time.perf_counter()

        response = await client.get(endpoint, params=params)

        if response.status_code == 404:
            # Try alternative endpoint format
            logger.debug("⚠️ [Eventbrite] 404 on destination API, trying search endpoint")
            response = await client.get(
                "/destination/search/",
                params={**params, "q": location or "tech events"},
            )

        if response.status_code == 404:
            elapsed = time.perf_counter() - start_time
            logger.debug(
                "❌ [Eventbrite] API unavailable (404) | duration=%.2fs",
                elapsed,
            )
            logger.warning(
                "Eventbrite destination API not available (404). "
                "The internal API may have changed."
            )
            return []

        response.raise_for_status()
        data = response.json()

        events = []
        # Destination API returns events in "events" array
        for event_data in data.get("events", []):
            event = self._parse_destination_event(event_data)
            if event:
                events.append(event)

        elapsed = time.perf_counter() - start_time
        if events:
            logger.debug(
                "✅ [Eventbrite] Complete | events=%d duration=%.2fs",
                len(events),
                elapsed,
            )
        else:
            logger.debug(
                "📭 [Eventbrite] No events found | duration=%.2fs",
                elapsed,
            )
        return events

    except httpx.HTTPError as e:
        elapsed = time.perf_counter() - start_time if 'start_time' in locals() else 0
        logger.debug(
            "❌ [Eventbrite] HTTP error | error=%s duration=%.2fs",
            str(e)[:100],
            elapsed,
        )
        logger.warning("Eventbrite destination API error: %s", e)
        return []
```

#### 1.2 Exa API Logging

**File**: `api/services/exa_client.py`

**Import time module** (add to imports at top):
```python
import time
```

**Add start/finish logs** in `search()` method. Replace lines 122-137:

```python
    try:
        logger.debug(
            "🌐 [Exa] Starting search | query=%s num_results=%d",
            query[:50],
            num_results,
        )
        start_time = time.perf_counter()

        response = await client.post("/search", json=payload)
        response.raise_for_status()
        data = response.json()

        results = []
        for result_data in data.get("results", []):
            result = self._parse_search_result(result_data)
            if result:
                results.append(result)

        elapsed = time.perf_counter() - start_time
        if results:
            logger.debug(
                "✅ [Exa] Complete | results=%d duration=%.2fs",
                len(results),
                elapsed,
            )
        else:
            logger.debug(
                "📭 [Exa] No results | duration=%.2fs",
                elapsed,
            )
        return results

    except httpx.HTTPError as e:
        elapsed = time.perf_counter() - start_time if 'start_time' in locals() else 0
        logger.debug(
            "❌ [Exa] HTTP error | error=%s duration=%.2fs",
            str(e)[:100],
            elapsed,
        )
        logger.warning("Exa search API error: %s", e)
        return []
```

**Add logging to Webset methods** in `create_webset()` (lines 218-227):

```python
    try:
        logger.debug(
            "🚀 [Exa] Creating Webset | query=%s count=%d",
            query[:50],
            count,
        )
        response = await client.post("/websets", json=payload)
        response.raise_for_status()
        data = response.json()

        webset_id = data.get("id")
        if webset_id:
            logger.debug("✅ [Exa] Webset created | id=%s", webset_id)
        return webset_id

    except httpx.HTTPError as e:
        logger.debug("❌ [Exa] Webset creation failed | error=%s", str(e)[:100])
        logger.warning("Exa create webset error: %s", e)
        return None
```

**Add logging to `get_webset()`** (lines 244-266):

```python
    try:
        logger.debug("⏳ [Exa] Polling Webset | id=%s", webset_id)
        response = await client.get(f"/websets/{webset_id}")
        response.raise_for_status()
        data = response.json()

        results = None
        if data.get("results"):
            results = [
                result
                for result_data in data["results"]
                if (result := self._parse_search_result(result_data))
            ]

        status = data.get("status", "unknown")
        logger.debug(
            "📊 [Exa] Webset status | id=%s status=%s results=%s",
            webset_id,
            status,
            len(results) if results else 0,
        )

        return ExaWebset(
            id=data["id"],
            status=status,
            num_results=data.get("numResults"),
            results=results,
        )

    except httpx.HTTPError as e:
        logger.debug("❌ [Exa] Webset poll failed | id=%s error=%s", webset_id, str(e)[:100])
        logger.warning("Exa get webset error: %s", e)
        return None
```

### Success Criteria:

#### Automated Verification:
- [x] Server starts without errors: `LOG_LEVEL=DEBUG uv run uvicorn api.index:app`
- [x] Type checking passes: `uv run mypy api/`
- [x] Linting passes: `uv run ruff check api/`

#### Manual Verification:
- [ ] With `LOG_LEVEL=DEBUG`, Eventbrite API calls show 🌐 start and ✅/❌ finish logs
- [ ] With `LOG_LEVEL=DEBUG`, Exa API calls show 🌐 start and ✅/❌ finish logs
- [ ] Duration is displayed in seconds with 2 decimal places
- [ ] At default INFO level, emoji logs do NOT appear

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Search Orchestration

### Overview
Add logging at the search orchestration level to show parallel fetch lifecycle and deduplication stats.

### Changes Required:

#### 2.1 Search Agent Logging

**File**: `api/agents/search.py`

**Import time module** (add to imports):
```python
import time
```

**Add logging around parallel fetch** in `search_events()` function. Enhance lines 220-289:

Before the `asyncio.gather()` call (around line 236):
```python
        logger.debug(
            "🔍 [Search] Starting parallel fetch | sources=%s",
            ", ".join(source_names),
        )
        start_time = time.perf_counter()
```

After gathering results (around line 237):
```python
        # Query API sources in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        fetch_elapsed = time.perf_counter() - start_time
        logger.debug(
            "📊 [Search] Parallel fetch complete | duration=%.2fs",
            fetch_elapsed,
        )
```

Enhance the per-source logging (lines 243-253):
```python
        for i, result in enumerate(results):
            source_name = source_names[i]
            if isinstance(result, BaseException):
                logger.debug(
                    "❌ [Search] Source failed | source=%s error=%s",
                    source_name,
                    str(result)[:100],
                )
                logger.warning("%s fetch failed: %s", source_name, result)
            elif isinstance(result, list):
                # Convert source-specific results to EventResult
                converted = _convert_source_results(source_name, result)
                if converted:
                    all_events.extend(converted)
                    successful_sources.append(source_name)
                    logger.debug(
                        "✅ [Search] Source complete | source=%s events=%d",
                        source_name,
                        len(converted),
                    )
                else:
                    logger.debug(
                        "📭 [Search] Source empty | source=%s",
                        source_name,
                    )
```

Add dedup stats logging (around line 264):
```python
        # Deduplicate merged results
        unique_events = _deduplicate_events(all_events)
        logger.debug(
            "📊 [Search] Deduplication | before=%d after=%d removed=%d",
            len(all_events),
            len(unique_events),
            len(all_events) - len(unique_events),
        )
```

### Success Criteria:

#### Automated Verification:
- [x] Server starts without errors: `LOG_LEVEL=DEBUG uv run uvicorn api.index:app`
- [x] Type checking passes: `uv run mypy api/`
- [x] Linting passes: `uv run ruff check api/`

#### Manual Verification:
- [ ] Search shows 🔍 start log with source names
- [ ] Each source shows ✅/❌/📭 completion status
- [ ] Deduplication stats show before/after counts

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Conversation Flow

### Overview
Add logging to the main conversation flow in `index.py` to track message receipt, agent phases, and SSE streaming.

### Changes Required:

#### 3.1 Main API Flow Logging

**File**: `api/index.py`

**Import time module** (add to imports):
```python
import time
```

**Add message received log** at the start of `stream_chat_response()` (after line 137):
```python
    # Register SSE connection for background event delivery
    if session_id:
        connection = await sse_manager.register(session_id)
        logger.debug(
            "💬 [Chat] Message received | session=%s length=%d msg=%s",
            session_id,
            len(message),
            message[:50],
        )
    else:
        logger.debug(
            "💬 [Chat] Message received | session=None length=%d msg=%s",
            len(message),
            message[:50],
        )
```

**Enhance agent processing log** (around line 141):
```python
        # Phase 1: Run ClarifyingAgent to gather/refine preferences
        logger.debug("🤔 [Clarify] Agent starting | session=%s", session_id or "None")
        clarify_start = time.perf_counter()
        result = await Runner.run(
            clarifying_agent,
            message,
            session=session,
        )
        clarify_elapsed = time.perf_counter() - clarify_start
        logger.debug(
            "✅ [Clarify] Agent complete | duration=%.2fs ready_to_search=%s",
            clarify_elapsed,
            result.final_output.ready_to_search if result.final_output else False,
        )
```

**Add search handoff logging** (around line 166):
```python
            # Phase 2: Handoff to search when ready
            if output.ready_to_search and output.search_profile:
                profile = output.search_profile
                logger.debug(
                    "🔍 [Search] Handoff | categories=%s time_window=%s keywords=%s",
                    profile.categories,
                    profile.time_window,
                    profile.keywords[:3] if profile.keywords else None,
                )
```

**Add SSE streaming log** (around line 187):
```python
                    yield sse_event("events", {"events": events_data})
                    logger.debug(
                        "📤 [SSE] Streaming events | session=%s count=%d",
                        session_id or "None",
                        len(events_data),
                    )
```

**Add empty results log** (around line 209):
```python
                else:
                    # No results found
                    logger.debug(
                        "📭 [Search] No results | session=%s",
                        session_id or "None",
                    )
```

**Add done event log** (around line 221):
```python
        logger.debug("✅ [SSE] Stream complete | session=%s", session_id or "None")
        yield sse_event("done", {})
```

### Success Criteria:

#### Automated Verification:
- [x] Server starts without errors: `LOG_LEVEL=DEBUG uv run uvicorn api.index:app`
- [x] Type checking passes: `uv run mypy api/`
- [x] Linting passes: `uv run ruff check api/`

#### Manual Verification:
- [ ] Chat request shows 💬 message received with truncated content
- [ ] Clarifying agent shows 🤔 start and ✅ completion with duration
- [ ] Search handoff shows 🔍 with profile summary
- [ ] SSE streaming shows 📤 with event count

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Background Tasks & SSE Connections

### Overview
Add logging to background Webset polling and SSE connection management.

### Changes Required:

#### 4.1 Background Tasks Logging

**File**: `api/services/background_tasks.py`

**Import time module** (add to imports):
```python
import time
```

**Add polling lifecycle logs** in `_poll_webset()` method (starting around line 112):

At the start of the polling loop:
```python
        logger.debug(
            "🚀 [Background] Webset polling started | session=%s webset=%s",
            task_info.session_id,
            task_info.webset_id,
        )
        poll_start = time.perf_counter()
```

Inside the while loop (around line 120):
```python
            while polls < WEBSET_MAX_POLLS:
                polls += 1
                logger.debug(
                    "⏳ [Background] Polling | webset=%s poll=%d/%d",
                    task_info.webset_id,
                    polls,
                    WEBSET_MAX_POLLS,
                )
                await asyncio.sleep(WEBSET_POLL_INTERVAL)
```

On completion (around line 143):
```python
                if webset.status == "completed":
                    poll_elapsed = time.perf_counter() - poll_start
                    if webset.results:
                        # ... existing code ...
                        logger.debug(
                            "🎉 [Background] Webset complete | session=%s events=%d duration=%.2fs",
                            task_info.session_id,
                            len(events_data),
                            poll_elapsed,
                        )
                    else:
                        logger.debug(
                            "📭 [Background] Webset empty | session=%s duration=%.2fs",
                            task_info.session_id,
                            poll_elapsed,
                        )
                    return
```

On failure/timeout:
```python
                elif webset.status == "failed":
                    poll_elapsed = time.perf_counter() - poll_start
                    logger.debug(
                        "❌ [Background] Webset failed | session=%s duration=%.2fs",
                        task_info.session_id,
                        poll_elapsed,
                    )
                    # ... existing warning log ...
                    return

            # Max polls reached
            poll_elapsed = time.perf_counter() - poll_start
            logger.debug(
                "⚠️ [Background] Polling timeout | session=%s polls=%d duration=%.2fs",
                task_info.session_id,
                polls,
                poll_elapsed,
            )
```

#### 4.2 SSE Connection Manager Logging

**File**: `api/services/sse_connections.py`

**Add connection lifecycle logs**:

In `register()` method (around line 41):
```python
        logger.debug(
            "🔌 [SSE] Connection registered | session=%s",
            session_id,
        )
```

In `unregister()` method (around line 50):
```python
        logger.debug(
            "🔌 [SSE] Connection unregistered | session=%s",
            session_id,
        )
```

In `push_event()` method (around line 66):
```python
        logger.debug(
            "📤 [SSE] Event pushed | session=%s type=%s",
            session_id,
            event.get("type", "unknown"),
        )
```

### Success Criteria:

#### Automated Verification:
- [x] Server starts without errors: `LOG_LEVEL=DEBUG uv run uvicorn api.index:app`
- [x] Type checking passes: `uv run mypy api/`
- [x] Linting passes: `uv run ruff check api/`

#### Manual Verification:
- [ ] Background task shows 🚀 start and 🎉/❌ completion
- [ ] Polling shows ⏳ progress logs (not too verbose - one per poll)
- [ ] SSE connections show 🔌 register/unregister

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Documentation

### Overview
Update the API README to document how to enable debug logging.

### Changes Required:

#### 5.1 README Update

**File**: `api/README.md`

**Add new section after "Running the Server"** (after line 49):

```markdown
## Debug Logging

The API includes emoji-prefixed debug logs for observability. These logs show:
- External API calls (Eventbrite, Exa) with timing
- Search orchestration and deduplication stats
- Conversation flow and agent processing
- Background task lifecycle
- SSE connection management

### Enabling Debug Logs

Set the `LOG_LEVEL` environment variable to `DEBUG`:

```bash
LOG_LEVEL=DEBUG uv run uvicorn api.index:app --reload
```

### Example Debug Output

```
💬 [Chat] Message received | session=abc123 length=42 msg=Find tech events this weekend
🤔 [Clarify] Agent starting | session=abc123
✅ [Clarify] Agent complete | duration=1.23s ready_to_search=True
🔍 [Search] Handoff | categories=['tech'] time_window=this_weekend
🌐 [Eventbrite] Starting search | endpoint=/destination/events/Columbus--OH/
🌐 [Exa] Starting search | query="events Columbus Ohio tech" num_results=10
✅ [Eventbrite] Complete | events=5 duration=0.82s
✅ [Exa] Complete | results=8 duration=1.21s
📊 [Search] Deduplication | before=13 after=10 removed=3
📤 [SSE] Streaming events | session=abc123 count=10
✅ [SSE] Stream complete | session=abc123
```

### Emoji Legend

| Emoji | Meaning |
|-------|---------|
| 💬 | User message received |
| 🤔 | Agent processing |
| 🔍 | Search phase |
| 🌐 | External API call start |
| ✅ | Success/completion |
| ❌ | Error/failure |
| ⚠️ | Warning (fallback, timeout) |
| 📊 | Statistics (counts) |
| 📤 | SSE streaming |
| 📭 | Empty results |
| 🚀 | Async task start |
| ⏳ | Polling |
| 🎉 | Async completion |
| 🔌 | SSE connection lifecycle |
```

### Success Criteria:

#### Automated Verification:
- [x] README renders correctly in markdown preview
- [x] No broken links or formatting issues

#### Manual Verification:
- [ ] Documentation accurately describes the logging behavior
- [ ] Example output matches actual log format
- [ ] Emoji legend is complete

---

## Testing Strategy

### Unit Tests:
- No new unit tests required (logging is observational)

### Integration Tests:
- Verify logs appear at DEBUG level
- Verify logs do NOT appear at INFO level

### Manual Testing Steps:
1. Start server with `LOG_LEVEL=DEBUG uv run uvicorn api.index:app --reload`
2. Send a chat message requesting events
3. Verify the full emoji log chain appears in console:
   - 💬 message received
   - 🤔 clarify start → ✅ complete
   - 🔍 search handoff
   - 🌐 API calls start → ✅/❌ complete
   - 📊 dedup stats
   - 📤 SSE streaming
   - ✅ stream complete
4. Restart server WITHOUT `LOG_LEVEL=DEBUG`
5. Verify emoji logs do NOT appear

## Performance Considerations

- DEBUG logs use lazy string formatting (`%s` not f-strings) to avoid string construction when logging is disabled
- Timing uses `time.perf_counter()` which has minimal overhead
- Message truncation (`[:50]`) prevents large payloads in logs

## Migration Notes

No migration required. This is purely additive logging.

## References

- Research document: `thoughts/shared/research/2026-01-11-emoji-observability-logging-research.md`
- Python logging best practices: https://docs.python.org/3/howto/logging.html
