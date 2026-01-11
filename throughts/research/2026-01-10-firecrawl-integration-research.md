---
date: 2026-01-10T12:00:00-05:00
researcher: Claude
git_commit: c3b34ff72c86592ac018a3ef2d5ed72c23964039
branch: main
repository: mchlggr/calendar-club-prototype
topic: "Firecrawl Integration for Multi-Source Event Scraping"
tags: [research, codebase, firecrawl, scraping, events, eventbrite, meetup, luma, posh]
status: complete
last_updated: 2026-01-10
last_updated_by: Claude
---

# Research: Firecrawl Integration for Multi-Source Event Scraping

**Date**: 2026-01-10T12:00:00-05:00
**Researcher**: Claude
**Git Commit**: c3b34ff72c86592ac018a3ef2d5ed72c23964039
**Branch**: main
**Repository**: mchlggr/calendar-club-prototype

## Research Question

How should Firecrawl be integrated into this application to scrape events from Eventbrite, Luma, Posh, Meetup.com, and other event sources? What is the current architecture and how would Firecrawl fit in?

## Summary

The Calendar Club application currently has a **single event source** (Eventbrite) implemented via its official REST API. The architecture is designed around **API-first integration** with no existing web scraping infrastructure. The codebase uses `httpx.AsyncClient` for HTTP requests, Pydantic models for data validation, and a singleton pattern for service clients.

Firecrawl would provide a complementary capability to fetch events from sources that don't offer official APIs, or to augment API data with additional details scraped from event pages. The Python SDK (`firecrawl-py`) integrates cleanly with the existing async patterns and Pydantic-based configuration.

## Detailed Findings

### 1. Current Event Source Architecture

#### Entry Points

**Main Search Flow:**
1. User query → `/api/chat/stream` endpoint (`api/index.py:248`)
2. Search agent processes query (`api/agents/search.py:124`)
3. `search_events()` function calls `_fetch_eventbrite_events()`
4. `EventbriteClient.search_events()` fetches from Eventbrite API
5. Results transformed to `EventResult` model and returned

**Key Files:**
- `api/services/eventbrite.py:35-232` - EventbriteClient implementation
- `api/agents/search.py:64-121` - Event fetching and transformation
- `api/config.py:12-49` - Configuration via pydantic-settings

#### Current Event Data Models

**Backend Models:**

```python
# EventbriteEvent (api/services/eventbrite.py:18-33)
class EventbriteEvent(BaseModel):
    id: str
    title: str
    description: str
    start_time: datetime
    end_time: datetime | None = None
    venue_name: str | None = None
    venue_address: str | None = None
    category: str = "community"
    is_free: bool = True
    price_amount: int | None = None
    url: str | None = None
    logo_url: str | None = None

# EventResult (api/agents/search.py:23-36)
class EventResult(BaseModel):
    id: str
    title: str
    date: str  # ISO 8601 datetime string
    location: str
    category: str
    description: str
    is_free: bool
    price_amount: int | None = None
    distance_miles: float
    url: str | None = None
```

**Frontend Model:**

```typescript
// frontend/src/lib/api.ts:12-29
interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime?: Date;
    location?: string;
    url?: string;
    source: string;
    sourceUrl?: string;
    categories?: string[];
    imageUrl?: string;
    price?: {
        isFree: boolean;
        amount?: number;
        currency?: string;
    };
}
```

#### HTTP Client Pattern

The codebase uses `httpx.AsyncClient` with lazy initialization:

```python
# api/services/eventbrite.py:44-51
async def _get_client(self) -> httpx.AsyncClient:
    if self._client is None:
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=30.0,
        )
    return self._client
```

#### Configuration Pattern

Uses pydantic-settings for environment-based configuration:

```python
# api/config.py:12-43
class Settings(BaseSettings):
    openai_api_key: str = Field(default="", description="OpenAI API key")
    eventbrite_api_key: str = Field(default="", description="Eventbrite API key")
    # ...
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )
```

### 2. Existing Infrastructure (No Web Scraping)

**Current State:**
- No HTML scraping/parsing libraries installed (no BeautifulSoup, Scrapy, Playwright)
- Only `httpx` for HTTP requests to official REST APIs
- Single API integration: Eventbrite (official, authenticated)
- Architecture philosophy: API-first approach

**Dependencies (`requirements.txt`):**
- `httpx>=0.27.0` - HTTP client
- `pydantic>=2.0` - Data validation
- `pydantic-settings` - Environment configuration
- No scraping libraries present

### 3. Event Platform API Landscape

Based on existing research documents:

| Platform | API Type | Access | Rate Limits |
|----------|----------|--------|-------------|
| **Eventbrite** | REST | Public API key | 2,000/hour, 48,000/day |
| **Meetup** | GraphQL | Public (Feb 2025) | Documented in schema |
| **Luma** | REST | Luma Plus subscription required | Varies by plan |
| **Posh** | Webhooks | Developer access | Event-driven |
| **LinkedIn** | REST | Whitelisted partners only | Restricted |

**Source**: `throughts/research/Key Event API Sources and Their Limits.md`

### 4. Firecrawl API Overview

#### Core Capabilities

1. **`/scrape`** - Single page content extraction
   - Returns: markdown, HTML, JSON-LD, screenshots
   - Credit cost: 1 per page

2. **`/crawl`** - Multi-page website crawling
   - Follows links, discovers pages
   - Async with webhook support
   - Credit cost: 1 per page

3. **`/map`** - URL discovery
   - Finds all URLs on a site without scraping content
   - Useful for understanding site structure
   - Credit cost: 1 per page

4. **`/search`** - Web search + scrape
   - Search the web and extract results
   - Credit cost: 2 per 10 results

5. **`/extract`** - AI-powered structured extraction
   - Schema-based or natural language prompts
   - Uses FIRE-1 agent for complex pages

#### Python SDK

```python
# Installation
pip install firecrawl-py

# Basic usage
from firecrawl import Firecrawl, AsyncFirecrawl

# Sync
firecrawl = Firecrawl(api_key="fc-YOUR_API_KEY")
result = firecrawl.scrape("https://example.com", formats=["markdown"])

# Async (matches existing codebase pattern)
async def scrape():
    firecrawl = AsyncFirecrawl(api_key="fc-YOUR-API-KEY")
    doc = await firecrawl.scrape("https://example.com", formats=["markdown"])
```

#### Pricing

| Plan | Credits/Month | Cost | Concurrent Requests |
|------|---------------|------|---------------------|
| Free | 500 (one-time) | $0 | 2 |
| Hobby | 3,000 | $16/mo | 5 |
| Standard | 100,000 | $83/mo | 50 |
| Growth | 500,000 | $333/mo | 100 |

### 5. Integration Points

#### Where Firecrawl Would Fit

**Option A: Parallel Source** (alongside Eventbrite API)
- Add new service client: `api/services/firecrawl.py`
- Implement site-specific extractors
- Aggregate results in search agent

**Option B: Enrichment Layer** (enhance API results)
- Scrape additional details from event URLs
- Extract JSON-LD structured data
- Fetch images, full descriptions

**Option C: Fallback Source** (when APIs unavailable)
- Use when no API key configured
- Scrape public event pages directly

#### Recommended File Locations

```
api/
├── services/
│   ├── eventbrite.py      # Existing
│   ├── firecrawl.py       # NEW: Firecrawl client wrapper
│   ├── scrapers/          # NEW: Site-specific extractors
│   │   ├── __init__.py
│   │   ├── base.py        # Base scraper class
│   │   ├── meetup.py
│   │   ├── luma.py
│   │   └── posh.py
│   └── __init__.py        # Update exports
├── config.py              # Add firecrawl_api_key
```

#### Configuration Addition

```python
# api/config.py (addition)
class Settings(BaseSettings):
    # ... existing fields
    firecrawl_api_key: str = Field(default="", description="Firecrawl API key")
```

```bash
# .env.example (addition)
FIRECRAWL_API_KEY=fc-...
```

### 6. Site-Specific Extraction Strategies

#### Eventbrite (Enhancement)
- Already has official API
- Firecrawl could: extract full description, scrape organizer details
- Use JSON-LD when present (Schema.org Event)

#### Meetup
- Has GraphQL API (Feb 2025+)
- Firecrawl useful for: groups without API access, historical pages
- Target: `/events/` URLs, extract JSON-LD

#### Luma
- API requires Luma Plus subscription
- Firecrawl alternative: scrape public event pages
- Target: `lu.ma/*` event URLs

#### Posh
- Webhook-based (event-driven, not polling)
- Firecrawl useful for: initial event discovery, page details
- Target: `posh.vip/e/*` event URLs

#### General Strategy

1. **Check for JSON-LD first** - Most event pages embed Schema.org Event
2. **Fall back to HTML extraction** - Use Firecrawl's markdown output
3. **Use `/map` for discovery** - Find event URLs on venue/organizer sites
4. **Search + scrape** - Use `/search` for event discovery by topic/location

### 7. Existing Codebase Patterns to Follow

#### Error Handling Pattern

```python
# From api/services/eventbrite.py:146-149
except httpx.HTTPError as e:
    logger.warning("Eventbrite API error: %s", e)
    return []  # Graceful degradation
```

#### Source Attribution Pattern

```python
# From api/agents/search.py:54-61
class SearchResult(BaseModel):
    events: list[EventResult]
    source: str = Field(description="Data source: 'eventbrite' or 'unavailable'")
    message: str | None = None
```

#### Singleton Client Pattern

```python
# From api/services/eventbrite.py:222-231
_client: EventbriteClient | None = None

def get_eventbrite_client() -> EventbriteClient:
    global _client
    if _client is None:
        _client = EventbriteClient()
    return _client
```

### 8. Potential Challenges

1. **ToS Compliance**
   - Existing research warns: "Eventbrite ToS explicitly prohibits scraping"
   - Use official APIs where available
   - Firecrawl respects robots.txt

2. **Rate Limiting**
   - Firecrawl has credit-based limits
   - Need to implement backoff logic (codebase already has pattern)

3. **Data Normalization**
   - Multiple sources → unified EventResult model
   - Need consistent category mapping
   - Deduplication by (title, start_time, venue)

4. **Cost Management**
   - 1 credit per page scraped
   - Use `/map` strategically before `/crawl`
   - Cache scraped results

## Code References

- `api/services/eventbrite.py:35-232` - Current event client pattern to follow
- `api/agents/search.py:64-121` - Event transformation logic
- `api/agents/search.py:124-165` - Search function with source attribution
- `api/config.py:12-49` - Configuration pattern for API keys
- `api/index.py:38-50` - User-friendly error formatting

## Architecture Documentation

**Current Data Flow:**
```
User Query → Chat Endpoint → Search Agent → EventbriteClient → Eventbrite API
                                    ↓
                              EventResult[] ← EventbriteEvent[]
```

**Proposed Data Flow (with Firecrawl):**
```
User Query → Chat Endpoint → Search Agent → Event Aggregator
                                    ↓
              ┌─────────────────────┼─────────────────────┐
              ↓                     ↓                     ↓
      EventbriteClient      FirecrawlClient       MeetupClient
              ↓                     ↓                     ↓
       Eventbrite API    Firecrawl Scraping      Meetup GraphQL
              ↓                     ↓                     ↓
              └─────────────────────┼─────────────────────┘
                                    ↓
                              EventResult[] (normalized, deduplicated)
```

## Related Research

- `throughts/research/Key Event API Sources and Their Limits.md` - API landscape
- `throughts/research/Safe Polling and Ranking for Event Crawlers.md` - Crawling best practices
- `throughts/research/Connectors, ICS, and ToS Boundaries.md` - Legal considerations
- `throughts/research/Building a Standard Event Schema.md` - Schema design

## Open Questions

1. **Which platforms to prioritize?** (Meetup, Luma, Posh - all three?)
2. **Firecrawl tier selection?** (Hobby at $16/mo for 3K credits may suffice initially)
3. **JSON-LD extraction priority?** (Should be primary extraction method)
4. **Caching strategy?** (How long to cache scraped event data?)
5. **Deduplication approach?** (When same event appears on multiple platforms)

## Sources

### Firecrawl Documentation
- [Firecrawl Quickstart](https://docs.firecrawl.dev/introduction)
- [Python SDK](https://docs.firecrawl.dev/sdks/python)
- [Scrape Endpoint](https://www.firecrawl.dev/blog/mastering-firecrawl-scrape-endpoint)
- [Crawl Endpoint](https://www.firecrawl.dev/blog/mastering-the-crawl-endpoint-in-firecrawl)
- [Pricing](https://www.firecrawl.dev/pricing)
- [Rate Limits](https://docs.firecrawl.dev/rate-limits)

### Event Platform APIs
- [Eventbrite Rate Limits](https://www.eventbrite.com/platform/docs/rate-limits)
- [Meetup GraphQL API](https://www.meetup.com/graphql/guide/)
- [Luma API](https://help.luma.com/p/luma-api)
- [Posh Webhooks](https://university.posh.vip/university/post/a-guide-to-webhooks-at-posh)
