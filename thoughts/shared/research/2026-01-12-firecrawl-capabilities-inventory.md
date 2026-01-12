# Firecrawl Capabilities Inventory

**Date**: 2026-01-12
**Context**: Evaluating Firecrawl extraction options for event discovery
**Question**: Can we use prompts instead of just JSON schemas? What about the Firecrawl Agent?

---

## TL;DR

- **Yes, prompts are supported** - Both `/scrape` and `/extract` accept a `prompt` parameter alongside or instead of `schema`
- **Firecrawl Agent (`/agent`)** is the newest/recommended approach - takes natural language prompts, doesn't require URLs, autonomously discovers and extracts data
- **Our current implementation** only uses schema-based extraction via `/scrape` - we're missing the prompt capability entirely

---

## Firecrawl Endpoints Overview

| Endpoint | URLs Required? | Prompt Support | Schema Support | Multi-Page | Best For |
|----------|----------------|----------------|----------------|------------|----------|
| **`/scrape`** | Yes (1 URL) | ✓ via `formats` | ✓ via `formats` | No | Single page extraction |
| **`/extract`** | Yes (multiple, wildcards OK) | ✓ | ✓ | ✓ (pagination) | Batch extraction from known URLs |
| **`/agent`** | **No** (optional) | ✓ (primary input) | ✓ | ✓ (autonomous) | **Recommended** - autonomous discovery |
| **`/crawl`** | Yes (starting URL) | No | No | ✓ (follows links) | Site-wide content harvesting |

---

## Detailed Endpoint Analysis

### 1. `/scrape` - Single Page Extraction

**Current usage in our codebase**: `api/services/firecrawl.py:150-182`

**What we do now:**
```python
result = await client.scrape(url, formats=format_list)
# Where format_list includes {"type": "json", "schema": extract_schema}
```

**What we could do - add prompt:**
```python
result = await client.scrape(
    url,
    formats=[{
        "type": "json",
        "schema": EVENT_SCHEMA,
        "prompt": "Extract event details. For dates, always include the full year (2026). For prices, return 'Free' if no price is shown."
    }]
)
```

**Key insight**: The `formats` parameter accepts both `schema` AND `prompt` together. The prompt guides the LLM's extraction behavior.

### 2. `/extract` - Multi-URL Extraction

**Not currently used in our codebase.**

**Capabilities:**
- Accepts multiple URLs or wildcard patterns (e.g., `example.com/events/*`)
- Built-in FIRE-1 agent handles pagination
- Can enable web search to follow external links

**Example:**
```python
result = await client.extract(
    urls=["https://posh.vip/c/columbus/*"],
    prompt="Extract all upcoming events with title, date, venue, and price",
    schema=EventSchema
)
```

**When to use**: When you know the URL patterns but want Firecrawl to handle discovery within those patterns.

### 3. `/agent` - Autonomous Discovery (Recommended)

**Not currently used in our codebase.**

**This is the game-changer:**
- **No URLs required** - just describe what you want
- Autonomously searches the web, navigates sites, handles JS/forms/modals
- Returns structured data matching your schema

**Example:**
```python
from firecrawl import AsyncFirecrawl
from pydantic import BaseModel

class Event(BaseModel):
    title: str
    date: str
    venue: str | None
    price: str | None
    url: str

class EventResults(BaseModel):
    events: list[Event]

async def discover_events():
    client = AsyncFirecrawl(api_key="...")

    result = await client.agent(
        prompt="Find upcoming tech meetups and startup events in Columbus, Ohio for the next 2 weeks",
        schema=EventResults.model_json_schema()
    )
    return result.data
```

**Comparison - Current vs Agent:**

| Aspect | Current Pattern | Agent Pattern |
|--------|-----------------|---------------|
| Discovery | Manual: crawl → filter links → scrape each | Automatic: agent finds everything |
| URLs needed | Yes, must know site structure | No |
| Code complexity | High (extractors per source) | Low (single prompt) |
| Flexibility | Rigid per-source patterns | Natural language adapts |

### 4. `/crawl` - Site Spider

**Current usage in our codebase**: `api/services/firecrawl.py:184-218`, only used by `PoshExtractor`

**What it does:**
- Spiders a site following links
- Returns raw page data (markdown, HTML, links)
- Does NOT do extraction - just harvests content

**Our usage:**
```python
pages = await self.client.crawl(
    url=discovery_url,
    limit=limit,
    include_patterns=["/e/*"],
)
# Then we scrape each page individually
for page in pages:
    event = await self.extract_event(page.url)
```

**Problem**: This is inefficient - we make N+1 API calls (1 crawl + N scrapes).

---

## Extraction Approaches Comparison

| Approach | How It Works | Consistency | Flexibility | Use Case |
|----------|--------------|-------------|-------------|----------|
| **Schema Only** | JSON Schema defines exact output fields | High | Low | Production pipelines needing strict structure |
| **Prompt Only** | Natural language description | Medium | High | Exploratory extraction, variable content |
| **Schema + Prompt** | Schema for structure, prompt for guidance | Medium-High | High | Complex extraction - best of both |

### Schema Example (what we have now)
```python
BASE_EVENT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Event title"},
        "start_date": {"type": "string", "description": "Event date in 'Month Day, Year' format"},
        # ...
    }
}
```

### Prompt Example
```python
prompt = """
Extract event information from this page:
- Title: The main event name/headline
- Date: Full date including year (infer year if not shown)
- Price: Return 'Free' if no price displayed or RSVP-only
- Venue: Return 'Online' for virtual events
"""
```

### Combined Example (recommended)
```python
result = await client.scrape(
    url,
    formats=[{
        "type": "json",
        "schema": EVENT_SCHEMA,
        "prompt": "Extract event details. Always include full year in dates. If price is not shown, assume Free."
    }]
)
```

---

## Current Codebase Inventory

### What We Have (`api/services/firecrawl.py`)

| Component | Lines | Uses Crawl? | Uses Prompt? | Status |
|-----------|-------|-------------|--------------|--------|
| `FirecrawlClient` | 124-218 | ✓ | No | Core wrapper |
| `BaseExtractor` | 221-403 | Via subclass | No | Abstract base |
| `PoshExtractor` | 406-479 | **Yes** | No | Only crawl user |
| `LumaExtractor` | 589-725 | No (scrape+links) | No | Disabled |
| `PartifulExtractor` | 801-926 | No (scrape+links) | No | Disabled |
| `MeetupExtractor` | 991-1095 | No (scrape+links) | No | Disabled |
| `FacebookExtractor` | 1160-1262 | No (scrape+links) | No | Permanently disabled |
| `RiverExtractor` | 1322-1430 | No (scrape+links) | No | Disabled |

### Key Observation

All extractors use **schema-only** extraction. None use prompts. The `BASE_EVENT_SCHEMA` has detailed descriptions in each field, but adding a top-level prompt could improve extraction quality significantly.

---

## Migration Options

| Option | Effort | Benefit | Risk |
|--------|--------|---------|------|
| **1. Add prompts to existing scrape calls** | Low | Better extraction quality, no restructuring | Minimal |
| **2. Switch to `/extract` with wildcards** | Medium | Batch processing, fewer API calls | Need to understand URL patterns |
| **3. Switch to `/agent`** | Medium | No URLs needed, autonomous discovery | Agent is in "Research Preview" |
| **4. Hybrid: Agent for discovery, scrape for details** | Medium | Best reliability + flexibility | More complex |

### Recommended Path

**Phase 1 (Quick win)**: Add prompts to existing `scrape()` calls
```python
# In BaseExtractor.extract_event()
data = await self.client.scrape(
    url=url,
    formats=[{
        "type": "json",
        "schema": self.EVENT_SCHEMA,
        "prompt": self.EXTRACTION_PROMPT  # New: per-extractor prompt
    }]
)
```

**Phase 2 (If needed)**: Evaluate `/agent` for discovery
- Test with a single source (e.g., Luma)
- Compare quality and latency to current approach
- If successful, could replace multiple extractors with one agent call

---

## Agent Caveats

The `/agent` endpoint is in **Research Preview**:
- May have rough edges
- Job results only available for **24 hours** after completion
- Pricing may differ from standard endpoints
- Best for discovery, not necessarily production extraction

---

## Code Change Locations

To add prompt support to existing extractors:

1. **Add prompt to `FirecrawlClient.scrape()`**: `api/services/firecrawl.py:150-182`
2. **Add `EXTRACTION_PROMPT` class variable to `BaseExtractor`**: `api/services/firecrawl.py:221`
3. **Override prompt in each extractor as needed**
4. **Pass prompt in `extract_event()` call**: `api/services/firecrawl.py:332-357`

---

## References

- [Firecrawl Extract Documentation](https://docs.firecrawl.dev/features/extract)
- [Firecrawl Agent Documentation](https://docs.firecrawl.dev/features/agent)
- [Firecrawl Scrape Documentation](https://docs.firecrawl.dev/features/scrape)
- [JSON Mode / LLM Extract](https://docs.firecrawl.dev/features/llm-extract)
- [Python SDK](https://docs.firecrawl.dev/sdks/python)
- [Introducing /agent Blog Post](https://www.firecrawl.dev/blog/introducing-agent)
- [Mastering Extract Endpoint](https://www.firecrawl.dev/blog/mastering-firecrawl-extract-endpoint)
