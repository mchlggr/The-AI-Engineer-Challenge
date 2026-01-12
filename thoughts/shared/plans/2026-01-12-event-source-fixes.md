# Event Source Fixes Plan

**Date**: 2026-01-12
**Status**: Ready for implementation
**Priority**: P0 - All scraped sources are broken

## Summary

Investigation revealed code implementation errors causing failures across multiple event sources. This plan addresses each issue with specific fixes.

---

## 1. Firecrawl: ValidationError on `formats` Parameter

**File**: `api/services/firecrawl.py:150-184`
**Impact**: Breaks Posh, Luma, Partiful, Meetup, River, Facebook extractors
**Priority**: P0

### Problem

The `scrape()` method incorrectly constructs the `formats` parameter by embedding a schema dict inside the formats list:

```python
# Current (WRONG)
format_list.append({
    "type": "json",
    "schema": extract_schema  # Raw dict embedded in formats
})
result = await client.scrape(url, formats=format_list)
```

The Firecrawl SDK expects either:
- `formats=["extract"]` with separate `extract={"schema": ...}` parameter
- OR a Pydantic model class in the formats list (not a dict)

### Fix

Restructure to use separate `formats` and `extract` parameters:

```python
async def scrape(
    self,
    url: str,
    formats: list[str] | None = None,
    extract_schema: dict[str, Any] | None = None,
) -> dict[str, Any]:
    client = self._get_client()

    # Build formats list (strings only)
    format_list = list(formats) if formats else ["markdown"]

    # Build scrape options
    scrape_options: dict[str, Any] = {"formats": format_list}

    # Add extraction as separate parameter if schema provided
    if extract_schema:
        if "extract" not in format_list:
            format_list.append("extract")
        scrape_options["extract"] = {"schema": extract_schema}

    try:
        result = await client.scrape_url(url, params=scrape_options)
        return dict(result) if result else {}
    except Exception as e:
        logger.error("Firecrawl scrape error for %s: %s", url, e)
        raise
```

### Verification

```bash
# Test single scrape with extraction
python -c "
import asyncio
from api.services.firecrawl import get_posh_extractor

async def test():
    ext = get_posh_extractor()
    event = await ext.extract_event('https://posh.vip/e/test-event')
    print(event)

asyncio.run(test())
"
```

---

## 2. Firecrawl: crawl() Positional Argument Error

**File**: `api/services/firecrawl.py:206-220`
**Impact**: Breaks Posh `discover_events()` which uses crawl
**Priority**: P0

### Problem

The `crawl()` method passes `url` as positional argument, but `AsyncFirecrawl.crawl()` requires it as keyword-only:

```python
# Current (WRONG)
result = await client.crawl(
    url,  # Positional - causes "takes 1 positional argument but 2 were given"
    limit=limit,
    include_paths=include_patterns,
    exclude_paths=exclude_patterns,
)
```

### Fix

Change to keyword argument:

```python
async def crawl(
    self,
    url: str,
    limit: int = 10,
    include_patterns: list[str] | None = None,
    exclude_patterns: list[str] | None = None,
) -> list[dict[str, Any]]:
    client = self._get_client()

    try:
        result = await client.crawl(
            url=url,  # FIXED: keyword argument
            limit=limit,
            include_paths=include_patterns,
            exclude_paths=exclude_patterns,
        )
        if hasattr(result, 'data'):
            return list(result.data)
        return list(result) if result else []
    except Exception as e:
        logger.error("Firecrawl crawl error for %s: %s", url, e)
        raise
```

---

## 3. Exa Research: Schema Error with Union Types

**File**: `api/services/exa_research.py:32-82, 105-154`
**Impact**: Exa Research source fails with 400 Bad Request
**Priority**: P1

### Problem

The `EVENT_RESEARCH_SCHEMA` uses JSON Schema union types like `"type": ["string", "null"]` which are not supported by Gemini's function calling (used internally by Exa).

### Fix

Replace the raw dict schema with a Pydantic model:

```python
from pydantic import BaseModel, Field
from typing import Optional

class ResearchEventItem(BaseModel):
    """Single event extracted by Exa Research."""
    title: str = Field(description="Event title")
    start_date: str = Field(
        description="Date in 'Month Day, Year' format (e.g., 'January 15, 2026'). MUST include year."
    )
    start_time: Optional[str] = Field(
        default=None,
        description="Time with AM/PM (e.g., '7:00 PM')"
    )
    venue_name: Optional[str] = Field(
        default=None,
        description="Venue name or 'Online' for virtual events"
    )
    venue_address: Optional[str] = Field(
        default=None,
        description="Full address with city, state"
    )
    price: Optional[str] = Field(
        default=None,
        description="'Free' or price like '$25'"
    )
    url: str = Field(description="Event page URL")
    description: Optional[str] = Field(
        default=None,
        description="Brief event description"
    )


class ResearchEventsOutput(BaseModel):
    """Structured output from Exa Research for events."""
    events: list[ResearchEventItem] = Field(
        description="List of events found"
    )


# Update create_research_task to use Pydantic model
def _sync_create_research_task(
    self,
    query: str,
    output_schema: type[BaseModel] | None = None,
) -> Any:
    """Synchronous research task creation."""
    client = self._get_client()

    kwargs: dict[str, Any] = {"instructions": query}
    if output_schema:
        kwargs["output_schema"] = output_schema  # Pass class, not dict

    return client.research.create(**kwargs)


# Update adapter to use new model
async def research_events_adapter(profile: Any) -> list[ExaSearchResult]:
    # ... build query ...

    # Use Pydantic model instead of dict
    task_id = await client.create_research_task(
        query,
        output_schema=ResearchEventsOutput,  # Pydantic class
    )
```

---

## 4. Eventbrite: 405 METHOD NOT ALLOWED

**File**: `api/services/eventbrite.py:198-262`
**Impact**: Eventbrite source returns 0 events
**Priority**: P1

### Problem

The internal destination API endpoints have changed or been deprecated:
- `/destination/events/{slug}/` returns 404
- `/destination/search/` returns 405 (wrong HTTP method)

The official Eventbrite Event Search API was deprecated in December 2019.

### Options

**Option A: Disable Eventbrite source (recommended short-term)**

```python
def register_eventbrite_source() -> None:
    """Register Eventbrite as an event source."""
    from api.services.base import EventSource, register_event_source

    # DISABLED: Internal API no longer works
    # TODO: Implement Firecrawl-based scraping as alternative
    logger.warning("Eventbrite source disabled - API endpoints deprecated")

    # Don't register the source
    return
```

**Option B: Convert to Firecrawl scraping (longer-term)**

Create an `EventbriteExtractor` class similar to Posh/Luma extractors that scrapes eventbrite.com pages directly.

### Recommendation

Disable for now (Option A), create a follow-up task to implement Firecrawl-based scraping.

---

## 5. Facebook: Blocked by Firecrawl

**File**: `api/services/firecrawl.py:1163-1327`
**Impact**: Facebook source always fails
**Priority**: P2

### Problem

Firecrawl explicitly does not support Facebook scraping without enterprise plan activation.

### Fix

Disable the Facebook source registration:

```python
def register_facebook_source() -> None:
    """Register Facebook as an event source."""
    # DISABLED: Facebook scraping requires Firecrawl enterprise plan
    # See: https://docs.firecrawl.dev/features/scrape#blocked-websites
    logger.info("Facebook source disabled - requires Firecrawl enterprise")
    return  # Don't register
```

---

## Implementation Order

1. **Phase 1: Restore Firecrawl sources** (P0)
   - [x] Fix `scrape()` formats parameter (Issue #1)
   - [x] Fix `crawl()` keyword argument (Issue #2)
   - [ ] Test Posh, Luma, Partiful, Meetup, River extractors

2. **Phase 2: Fix Exa Research** (P1)
   - [x] Create Pydantic models for research output
   - [x] Update `create_research_task()` to use models
   - [ ] Test research adapter

3. **Phase 3: Disable broken sources** (P1-P2)
   - [x] Disable Eventbrite registration with warning
   - [x] Disable Facebook registration with info log
   - [ ] Create follow-up tasks for Firecrawl-based alternatives

4. **Phase 4: Verification**
   - [x] Run full search with all sources (automated tests pass: 85 passed)
   - [x] Verify deduplication still works (tests pass)
   - [x] Check logs for any remaining errors (pyright shows 0 errors on modified files)
   - [ ] Manual testing of live sources (requires API keys and live web access)

---

## Files to Modify

| File | Changes |
|------|---------|
| `api/services/firecrawl.py` | Fix `scrape()` and `crawl()` methods |
| `api/services/exa_research.py` | Replace dict schema with Pydantic models |
| `api/services/eventbrite.py` | Disable source registration |

---

## Testing Commands

```bash
# Run live source tests
cd /Users/michaelgeiger/gt/calendarclub/mayor/rig
python -m pytest api/services/tests/test_live_sources.py -v

# Test individual extractors
python -c "
import asyncio
from api.services.firecrawl import get_posh_extractor

async def test():
    ext = get_posh_extractor()
    events = await ext.discover_events(city='columbus', limit=5)
    print(f'Found {len(events)} events')
    for e in events[:2]:
        print(f'  - {e.title}')

asyncio.run(test())
"

# Test Exa Research
python -c "
import asyncio
from api.services.exa_research import get_exa_research_client

async def test():
    client = get_exa_research_client()
    task_id = await client.create_research_task(
        'Find tech events in Columbus Ohio January 2026'
    )
    print(f'Task created: {task_id}')

asyncio.run(test())
"
```

---

## Rollback Plan

If fixes cause regressions:
1. Revert commits for affected files
2. Disable all Firecrawl-based sources temporarily
3. Fall back to Exa search only (without research)
