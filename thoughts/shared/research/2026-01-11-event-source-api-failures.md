---
date: 2026-01-11T20:55:11Z
researcher: Claude Code
git_commit: d0062a19e2b6f95759ae2aaea7b5643985329172
branch: main
repository: calendar-club-prototype
topic: "Event Source API Failures Investigation"
tags: [research, codebase, firecrawl, eventbrite, exa, event-sources, api-errors]
status: complete
last_updated: 2026-01-11
last_updated_by: Claude Code
---

# Research: Event Source API Failures Investigation

**Date**: 2026-01-11T20:55:11Z
**Researcher**: Claude Code
**Git Commit**: d0062a19e2b6f95759ae2aaea7b5643985329172
**Branch**: main
**Repository**: calendar-club-prototype

## Research Question

Why are all three event sources (Eventbrite, Exa, Posh/Firecrawl) failing to return events, resulting in empty search results?

## Summary

The investigation identified **three distinct root causes** for the empty search results:

1. **Firecrawl/Posh**: 400 Bad Request - The Firecrawl crawl API is rejecting the request, likely due to API changes, rate limiting, or the target site blocking crawlers
2. **Eventbrite**: 404 then 405 - The undocumented internal "destination API" has changed or been removed; the fallback endpoint rejects GET requests
3. **Exa**: No results - The search query includes a **past date (October 2023)** which is unlikely to return current event data

All three sources are failing independently, which is why no events are returned to the user.

## Detailed Findings

### 1. Firecrawl Service (Posh Events) - 400 Bad Request

**File**: `api/services/firecrawl.py`

**Error from logs**:
```
api.services.firecrawl - ERROR - Failed to discover Posh events for columbus: Client error '400 Bad Request' for url 'https://api.firecrawl.dev/v1/crawl'
```

**Root Cause Analysis**:

The `PoshExtractor.discover_events()` method at line 303-346 attempts to crawl `https://posh.vip/c/{city}` using Firecrawl's `/crawl` endpoint:

```python
# Line 320-327
city_url = urljoin(self.BASE_URL, f"/c/{city}")

pages = await self.client.crawl(
    url=city_url,
    max_depth=1,
    limit=limit + 5,
    include_patterns=["/e/*"],  # Only event pages
)
```

The `crawl()` method at lines 109-149 sends a POST to `/crawl` with:
- `url`: The target URL to crawl
- `maxDepth`: Crawl depth (1)
- `limit`: Number of pages (25)
- `includePaths`: URL patterns to include (`["/e/*"]`)

**Possible causes for 400 Bad Request**:
- Firecrawl API contract has changed (new required parameters)
- The `posh.vip/c/{city}` URL format is no longer valid
- Posh.vip may be blocking automated crawlers
- API key may be invalid or missing permissions
- Rate limiting or quota exceeded

**Code Reference**: `api/services/firecrawl.py:322-327`

---

### 2. Eventbrite Service - 404 then 405 METHOD NOT ALLOWED

**File**: `api/services/eventbrite.py`

**Error from logs**:
```
api.services.eventbrite - DEBUG - 404 on destination API, trying search endpoint
api.services.eventbrite - DEBUG - HTTP error | error=Client error '405 METHOD NOT ALLOWED' for url 'https://www.eventbrite.com/api/v3/destination/search/
```

**Root Cause Analysis**:

The code explicitly acknowledges in its docstring (lines 6-14) that this is using **undocumented internal APIs**:

```python
# Lines 6-14
"""
NOTE: The official Eventbrite Event Search API (/v3/events/search/) was
deprecated in December 2019 and turned off in February 2020. This client
attempts to use alternative endpoints, but functionality is limited.

See: https://github.com/Automattic/eventbrite-api/issues/83

Current approach:
1. Try the internal destination API (used by eventbrite.com website)
2. Fall back gracefully if unavailable
"""
```

The `_search_via_destination_api()` method (lines 146-262):
1. First tries: `GET /destination/events/{location_slug}/` - Returns **404**
2. Falls back to: `GET /destination/search/` - Returns **405 METHOD NOT ALLOWED**

The 405 error indicates the endpoint exists but doesn't accept GET requests. Eventbrite's internal API has likely changed:
- The endpoint may now require POST
- May require different authentication
- May have been removed entirely

**Code Reference**: `api/services/eventbrite.py:198-230`

---

### 3. Exa Service - No Results

**File**: `api/services/exa_client.py`

**Log from trace**:
```
api.services.exa_client - DEBUG - [Exa] No results | duration=1.63s
```

**Root Cause Analysis**:

The search query from logs shows:
```
time_window=start=datetime.datetime(2023, 10, 6, 17, 0, tzinfo=TzInfo(0)) end=datetime.datetime(2023, 10, 8, 23, 59, 59, tzinfo=TzInfo(0))
```

The user is searching for events in **October 2023** - a date over 2 years in the past.

The `search_events_adapter()` function (lines 353-405) builds the query:

```python
# Lines 366-379
query_parts = ["events", "Columbus Ohio"]

if hasattr(profile, "categories") and profile.categories:
    query_parts.extend(profile.categories)  # Adds "tech"

if hasattr(profile, "time_window") and profile.time_window:
    if profile.time_window.start:
        query_parts.append(profile.time_window.start.strftime("%B %Y"))  # "October 2023"

query = " ".join(query_parts)  # "events Columbus Ohio tech October 2023"
```

Additionally, lines 382-386 set date filters:
```python
start_date = None
end_date = None
if hasattr(profile, "time_window") and profile.time_window:
    start_date = profile.time_window.start  # October 2023
    end_date = profile.time_window.end
```

These are passed to `search()` as `start_published_date` and `end_published_date`, which filter by when pages were **published**, not when events occur. Searching for pages published in October 2023 about events in October 2023 is unlikely to return useful results.

**Code Reference**: `api/services/exa_client.py:366-405`

---

### 4. Search Orchestration

**File**: `api/agents/search.py`

The `search_events()` function (lines 223-344) correctly orchestrates parallel fetching from all enabled sources and handles failures gracefully. The orchestration itself is working correctly - all three sources are being queried in parallel, and their failures are being logged and handled.

**Code Reference**: `api/agents/search.py:266-279`

## Code References

| File | Line(s) | Description |
|------|---------|-------------|
| `api/services/firecrawl.py` | 303-346 | `PoshExtractor.discover_events()` - Posh event discovery |
| `api/services/firecrawl.py` | 109-149 | `FirecrawlClient.crawl()` - Firecrawl crawl API |
| `api/services/eventbrite.py` | 6-14 | Docstring noting deprecated API |
| `api/services/eventbrite.py` | 146-262 | `_search_via_destination_api()` - Internal API usage |
| `api/services/exa_client.py` | 353-405 | `search_events_adapter()` - Query building |
| `api/agents/search.py` | 223-344 | `search_events()` - Parallel source orchestration |

## Root Cause Summary

| Source | Error | Root Cause |
|--------|-------|------------|
| Firecrawl/Posh | 400 Bad Request | Firecrawl API rejection - API changes, site blocking, or auth issues |
| Eventbrite | 404, 405 | Undocumented internal API has changed or been removed |
| Exa | No results | Query uses past date (October 2023), unlikely to return current events |

## Remediation Recommendations

### Immediate Actions

1. **Verify API Keys**: Check that `FIRECRAWL_API_KEY`, `EVENTBRITE_API_KEY`, and `EXA_API_KEY` are correctly set and valid

2. **Test with Current Dates**: The October 2023 date in the test query is 2+ years old. Test with current dates to verify Exa functionality

3. **Check Firecrawl Status**:
   - Verify Firecrawl API is operational
   - Check if `posh.vip/c/{city}` URL pattern still works manually
   - Review Firecrawl API documentation for any breaking changes

### Short-term Fixes

4. **Eventbrite Alternative**: The undocumented destination API approach is inherently fragile. Consider:
   - Using Eventbrite's official Partner/Organization APIs if you have partner access
   - Removing Eventbrite as a source until a stable API is available
   - Investigating if Eventbrite has new public APIs

5. **Exa Date Handling**: The `start_published_date`/`end_published_date` filters apply to page publication date, not event date. This may not be appropriate for event discovery. Consider:
   - Removing date filters from Exa queries
   - Using only the text query for date context

6. **Firecrawl Crawl vs Scrape**: The current implementation uses `/crawl` which is for multi-page site crawling. For event discovery, consider:
   - Using `/scrape` for single-page extraction instead
   - Direct HTTP requests to Posh.vip if the event listing page has predictable structure

### Long-term Recommendations

7. **Source Resilience**: Add health checks and circuit breakers for each event source so failures don't silently return empty results

8. **Monitoring**: Add metrics/alerts for source failure rates to catch API changes early

9. **Alternative Sources**: Consider adding more reliable event sources:
   - Meetup API
   - Lu.ma API
   - Google Events API
   - Direct RSS feeds from local event calendars

## Related Research

- [Event Source Registration Missing](./2026-01-11-event-source-registration-missing.md) - Previous research on registration not being called (now fixed)

## Open Questions

1. Why was the test query using October 2023 dates? Is this a test case or production traffic?
2. Does the team have Eventbrite partner/organization API access?
3. Is Posh.vip still a viable event source, or has their site structure changed?
4. What is the expected Firecrawl usage pattern - is the current API key valid and within quota?
