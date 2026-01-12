---
date: 2026-01-12T06:46:45Z
researcher: michaelgeiger
git_commit: 730aba30a3d8aca4c808097fe68079b9ce78d9d9
branch: main
repository: calendar-club-prototype
topic: "Firecrawl Scraper Configuration Failure - Root Cause Analysis"
tags: [research, codebase, firecrawl, validation-error, scraping, root-cause]
status: complete
last_updated: 2026-01-12
last_updated_by: michaelgeiger
---

# Research: Firecrawl Scraper Configuration Failure - Root Cause Analysis

**Date**: 2026-01-12T06:46:45Z
**Researcher**: michaelgeiger
**Git Commit**: 730aba30a3d8aca4c808097fe68079b9ce78d9d9
**Branch**: main
**Repository**: calendar-club-prototype

## Research Question

Debug the Firecrawl validation error blocking scraping for Luma, Meetup, and Partiful sources. Identify why `formats=['extract', {'type': 'json', ...}]` triggers a pydantic.ValidationError.

## Summary

**Root Cause Identified**: The `BaseExtractor.extract_event()` method passes `formats=["extract"]` to the scrape method, but `"extract"` is NOT a valid format string in Firecrawl SDK v4.12.0+. The valid formats are: `'markdown'`, `'html'`, `'rawHtml'`, `'links'`, `'images'`, `'screenshot'`, `'summary'`, `'changeTracking'`, `'json'`, `'attributes'`, `'branding'`, `'raw_html'`, `'change_tracking'`.

**Impact**: 100% failure rate on all event extraction via Firecrawl (Luma, Meetup, Partiful, Posh, River).

## Detailed Findings

### The Bug Location

**File**: `api/services/firecrawl.py:343-346`

The `BaseExtractor.extract_event()` method passes an invalid format:

```python
async def extract_event(self, url: str) -> ScrapedEvent | None:
    ...
    data = await self.client.scrape(
        url=url,
        formats=["extract"],  # <-- BUG: "extract" is NOT a valid format
        extract_schema=self.EVENT_SCHEMA,
    )
```

### The Propagation Path

1. `BaseExtractor.extract_event()` calls `self.client.scrape()` with `formats=["extract"]`

2. `FirecrawlClient.scrape()` at lines 169-177 processes this:
```python
format_list: list[Any] = list(formats) if formats else ["markdown"]
if extract_schema:
    format_list.append({"type": "json", "schema": extract_schema})
```

3. Result: `format_list = ["extract", {"type": "json", "schema": {...}}]`

4. This is passed to `client.scrape(url, formats=format_list)` which hits the SDK's Pydantic validation

5. **Validation fails** because `"extract"` is not in the allowed literals

### Valid Formats in Firecrawl SDK v4.12.0+

According to the SDK's Pydantic model for `ScrapeOptions`, valid format strings are:
- `'markdown'`
- `'html'`
- `'rawHtml'` / `'raw_html'`
- `'links'`
- `'images'`
- `'screenshot'`
- `'summary'`
- `'changeTracking'` / `'change_tracking'`
- `'json'`
- `'attributes'`
- `'branding'`

### Correct API Usage

Per Firecrawl documentation, structured extraction with JSON schema should use:

```python
# Option 1: formats with JSON schema object
formats=[{"type": "json", "schema": {...}}]

# Option 2: Combine markdown + JSON extraction
formats=["markdown", {"type": "json", "schema": {...}}]

# Option 3: Use the dedicated extract() method
app.extract(urls=['...'], schema=PydanticModel)
```

The string `"extract"` was likely a legacy convention or misunderstanding - it was never a valid format.

### Affected Extractors

All extractors that call `BaseExtractor.extract_event()` are affected:
- `PoshExtractor` - `api/services/firecrawl.py:407`
- `LumaExtractor` - `api/services/firecrawl.py:590`
- `PartifulExtractor` - `api/services/firecrawl.py:802`
- `MeetupExtractor` - `api/services/firecrawl.py:992`
- `FacebookExtractor` - `api/services/firecrawl.py:1161` (disabled)
- `RiverExtractor` - `api/services/firecrawl.py:1323`

## Code References

- `api/services/firecrawl.py:343-346` - Bug location in `extract_event()`
- `api/services/firecrawl.py:169-177` - `FirecrawlClient.scrape()` format list construction
- `requirements.txt:11` - `firecrawl-py>=4.12.0` version constraint

## Root Cause

**Incorrect format string**: The code assumes `"extract"` is a valid format for triggering LLM extraction, but in Firecrawl SDK v4.12.0+, LLM extraction is controlled by including a `{"type": "json", "schema": ...}` object in the formats list, not by a string literal.

## Fix

In `api/services/firecrawl.py`, change line 345:

**From:**
```python
data = await self.client.scrape(
    url=url,
    formats=["extract"],
    extract_schema=self.EVENT_SCHEMA,
)
```

**To:**
```python
data = await self.client.scrape(
    url=url,
    extract_schema=self.EVENT_SCHEMA,
)
```

The `FirecrawlClient.scrape()` method already defaults to `["markdown"]` when `formats` is `None` and automatically appends the JSON schema when `extract_schema` is provided. Simply removing the invalid `formats=["extract"]` parameter will fix the issue.

## Related Research

- `thoughts/shared/plans/2026-01-11-exa-firecrawl-sdk-migration.md` - Original SDK migration plan

## Open Questions

None - root cause is definitive.
