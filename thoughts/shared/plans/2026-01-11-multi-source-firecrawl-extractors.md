# Multi-Source Firecrawl Extractors Implementation Plan

## Overview

Add 5 new event source integrations using Firecrawl's hosted scraping infrastructure:
1. **Luma** (lu.ma/luma.com)
2. **Partiful** (partiful.com)
3. **Meetup** (meetup.com) - via scraping
4. **Facebook Events** (facebook.com/events)
5. **River** (getriver.io)

All extractors follow the `BaseExtractor` pattern established in `api/services/firecrawl.py`.

## Current State Analysis

### Existing Infrastructure
- **BaseExtractor** abstract class at `firecrawl.py:140-247` handles common crawl/extract logic
- **PoshExtractor** at `firecrawl.py:249-400` demonstrates the pattern
- **FirecrawlClient** at `firecrawl.py:43-137` wraps the Firecrawl API
- **Event Source Registry** at `base.py:48-124` enables parallel source querying
- **MeetupClient** at `meetup.py:104-283` - complete but registration commented out

### Key Discovery: Firecrawl Architecture
Firecrawl is a **hosted service** - their infrastructure handles:
- Headless browser rendering
- Proxy rotation
- Anti-bot bypass (Cloudflare, CAPTCHAs)
- JavaScript execution

This means all sources (including Facebook) can use the same simple pattern.

### URL Patterns Discovered

| Source | Discovery URL | Event URL |
|--------|--------------|-----------|
| Luma | `luma.com/{city}` | `luma.com/{slug}` |
| Partiful | `partiful.com/discover/{city}` | `partiful.com/e/{id}` |
| Meetup | `meetup.com/find/?location={city}` | `meetup.com/{group}/events/{id}` |
| Facebook | `facebook.com/events/search/?q={city}` | `facebook.com/events/{id}` |
| River | `app.getriver.io/discovery/communities` | `app.getriver.io/events/{slug}` |

## Desired End State

After implementation:
1. All 6 sources registered and queryable in parallel
2. Each source follows the `BaseExtractor` pattern
3. Live integration tests exist for each source
4. Search results include events from all enabled sources

### Verification
```bash
# All tests pass
pytest api/services/tests/ -v

# Integration tests (requires API keys)
pytest -m integration api/services/tests/test_live_sources.py -v

# Type checking
pyright api/services/
```

## What We're NOT Doing

- **Official APIs** for Luma/Partiful (require paid subscriptions)
- **Ticketmaster, Dice.fm, Bandsintown, SeatGeek** (future work)
- **Venue calendars** (future work)
- **Authentication flows** for any source
- **Caching layer** for scraped results
- **Parallel extraction within sources** (keeping sequential for now)

## Implementation Approach

Each new extractor follows this pattern:
1. Create extractor class extending `BaseExtractor`
2. Define `SOURCE_NAME`, `BASE_URL`, `EVENT_SCHEMA`
3. Implement `_extract_event_id()` and `_parse_extracted_data()`
4. Add `discover_events()` method with source-specific logic
5. Create adapter function for registry
6. Create registration function
7. Add to `index.py` startup
8. Add conversion function to `search.py`
9. Add live integration tests

---

## Phase 1: Luma Extractor

### Overview
Create `LumaExtractor` for scraping events from luma.com city pages.

### Changes Required

#### 2.1 Create LumaExtractor Class

**File**: `api/services/firecrawl.py`
**Changes**: Add after PoshExtractor class (around line 400)

```python
class LumaExtractor(BaseExtractor):
    """
    Extractor for Luma (luma.com) events.

    Luma is a modern event platform popular for tech meetups,
    conferences, and community gatherings.
    """

    SOURCE_NAME = "luma"
    BASE_URL = "https://luma.com"
    DEFAULT_CATEGORY = "tech"

    # City slugs supported by Luma
    CITY_SLUGS = {
        "columbus": "columbus",  # May not exist - will gracefully fail
        "new york": "nyc",
        "san francisco": "sf",
        "los angeles": "la",
        "chicago": "chicago",
        "boston": "boston",
        "austin": "austin",
        "seattle": "seattle",
        "denver": "denver",
        "miami": "miami",
        "atlanta": "atlanta",
        "toronto": "toronto",
        "london": "london",
        "berlin": "berlin",
    }

    EVENT_SCHEMA = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Event title"},
            "description": {"type": "string", "description": "Event description"},
            "start_date": {"type": "string", "description": "Start date (e.g., 'January 15, 2026')"},
            "start_time": {"type": "string", "description": "Start time (e.g., '6:00 PM')"},
            "end_time": {"type": "string", "description": "End time if available"},
            "location": {"type": "string", "description": "Full venue address"},
            "venue_name": {"type": "string", "description": "Venue name"},
            "host_name": {"type": "string", "description": "Event host/organizer"},
            "price": {"type": "string", "description": "Ticket price or 'Free'"},
            "guest_count": {"type": "integer", "description": "Number of attendees"},
            "cover_image": {"type": "string", "description": "Event cover image URL"},
        },
        "required": ["title"],
    }

    def _extract_event_id(self, url: str) -> str:
        """Extract event ID from Luma URL."""
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        # Luma URLs are like /eventslug or /abc123xy
        return path or url

    def _parse_extracted_data(
        self,
        url: str,
        extracted: dict[str, Any],
    ) -> ScrapedEvent | None:
        """Parse Luma extracted data into ScrapedEvent."""
        import dateparser

        # Parse datetime
        start_dt = None
        end_dt = None
        date_str = extracted.get("start_date", "")
        time_str = extracted.get("start_time", "")

        if date_str:
            combined = f"{date_str} {time_str}".strip()
            start_dt = dateparser.parse(
                combined,
                settings={"PREFER_DATES_FROM": "future"},
            )

        # Parse price
        price_str = extracted.get("price", "")
        is_free = True
        price_amount = None
        if price_str:
            price_lower = price_str.lower()
            if price_lower not in ("free", ""):
                is_free = False
                match = re.search(r"\$?(\d+(?:\.\d{2})?)", price_str)
                if match:
                    price_amount = int(float(match.group(1)) * 100)

        return ScrapedEvent(
            source=self.SOURCE_NAME,
            event_id=self._extract_event_id(url),
            title=extracted.get("title", "Untitled"),
            description=extracted.get("description", ""),
            start_time=start_dt,
            end_time=end_dt,
            venue_name=extracted.get("venue_name"),
            venue_address=extracted.get("location"),
            category=self.DEFAULT_CATEGORY,
            is_free=is_free,
            price_amount=price_amount,
            url=url,
            logo_url=extracted.get("cover_image"),
            raw_data=extracted,
        )

    async def discover_events(
        self,
        city: str = "sf",
        limit: int = 20,
    ) -> list[ScrapedEvent]:
        """
        Discover Luma events for a city.

        Args:
            city: City slug (e.g., 'sf', 'nyc', 'austin')
            limit: Maximum number of events to return

        Returns:
            List of discovered events
        """
        # Normalize city to Luma slug
        city_slug = self.CITY_SLUGS.get(city.lower(), city.lower())
        discovery_url = f"{self.BASE_URL}/{city_slug}"

        logger.info("Discovering Luma events for %s at %s", city, discovery_url)

        # Luma event links have various patterns, scrape the page and extract
        try:
            # First, get all links from the city page
            data = await self.client.scrape(
                url=discovery_url,
                formats=["links", "markdown"],
            )

            links = data.get("links", [])

            # Filter to event links (exclude static pages)
            event_urls = []
            static_paths = {"/discover", "/about", "/pricing", "/login", "/signup", "/help"}
            for link in links:
                href = link if isinstance(link, str) else link.get("href", "")
                if not href:
                    continue
                parsed = urlparse(href)
                path = parsed.path.strip("/")
                # Luma event URLs are short slugs or 8-char codes
                if (
                    path
                    and "/" not in path  # No nested paths
                    and path not in static_paths
                    and not path.startswith(("discover", "about", "help"))
                    and len(path) <= 50  # Reasonable slug length
                ):
                    full_url = f"{self.BASE_URL}/{path}"
                    if full_url not in event_urls:
                        event_urls.append(full_url)

            logger.info("Found %d potential Luma event URLs", len(event_urls))

            # Extract events from URLs
            events = []
            for url in event_urls[:limit + 5]:  # Buffer for failures
                event = await self.extract_event(url)
                if event:
                    events.append(event)
                    if len(events) >= limit:
                        break

            logger.info("Discovered %d Luma events", len(events))
            return events

        except Exception as e:
            logger.error("Failed to discover Luma events: %s", e)
            return []


# Singleton for LumaExtractor
_luma_extractor: LumaExtractor | None = None


def get_luma_extractor() -> LumaExtractor:
    """Get the singleton Luma extractor."""
    global _luma_extractor
    if _luma_extractor is None:
        _luma_extractor = LumaExtractor()
    return _luma_extractor


async def search_luma_adapter(profile: Any) -> list[ScrapedEvent]:
    """Adapter for registry pattern - searches Luma events."""
    extractor = get_luma_extractor()

    # TODO: Extract city from profile.location when available
    city = "sf"  # Default to SF for now

    events = await extractor.discover_events(city=city, limit=20)

    # Post-filter by time window if provided
    filtered = []
    for event in events:
        if hasattr(profile, "time_window") and profile.time_window:
            if profile.time_window.start and event.start_time:
                if event.start_time < profile.time_window.start:
                    continue
            if profile.time_window.end and event.start_time:
                if event.start_time > profile.time_window.end:
                    continue

        if hasattr(profile, "free_only") and profile.free_only:
            if not event.is_free:
                continue

        filtered.append(event)

    return filtered


def register_luma_source() -> None:
    """Register Luma as an event source."""
    api_key = os.getenv("FIRECRAWL_API_KEY", "")

    source = EventSource(
        name="luma",
        search_fn=search_luma_adapter,
        is_enabled_fn=lambda: bool(api_key),
        priority=26,
        description="Luma events via Firecrawl scraping",
    )
    register_event_source(source)
```

#### 2.2 Update Exports

**File**: `api/services/__init__.py`
**Changes**: Add Luma exports

```python
from .firecrawl import (
    FirecrawlClient,
    LumaEvent,
    LumaExtractor,
    PoshExtractor,
    ScrapedEvent,
    get_firecrawl_client,
    get_luma_extractor,
    get_posh_extractor,
    register_luma_source,
    register_posh_source,
)
```

#### 2.3 Register at Startup

**File**: `api/index.py`
**Changes**: Add registration call

```python
from api.services.firecrawl import register_posh_source, register_luma_source

# In registration section
register_posh_source()
register_luma_source()
```

#### 2.4 Add Live Tests

**File**: `api/services/tests/test_live_sources.py`
**Changes**: Add Luma test class

```python
from api.services.firecrawl import LumaExtractor

@pytest.fixture
async def luma_extractor():
    """Create LumaExtractor with cleanup."""
    skip_if_no_firecrawl_key()
    extractor = LumaExtractor()
    yield extractor
    await extractor.close()


@pytest.mark.integration
class TestLumaExtractorLive:
    """Live integration tests for LumaExtractor."""

    @pytest.mark.asyncio
    async def test_discover_events_sf(self, luma_extractor):
        """Test discovering events for San Francisco."""
        events = await luma_extractor.discover_events(
            city="sf",
            limit=5,
        )

        assert isinstance(events, list)
        for event in events:
            assert isinstance(event, ScrapedEvent)
            assert event.source == "luma"
            assert event.title
            assert event.url

    @pytest.mark.asyncio
    async def test_discover_events_nyc(self, luma_extractor):
        """Test discovering events for NYC."""
        events = await luma_extractor.discover_events(
            city="nyc",
            limit=3,
        )

        assert isinstance(events, list)
        for event in events:
            assert isinstance(event, ScrapedEvent)
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pyright api/services/firecrawl.py` (pre-existing issue on line 126 unrelated to this work)
- [x] Unit tests pass: `pytest api/services/tests/ -v`
- [ ] Integration tests pass: `pytest -m integration -k Luma api/services/tests/test_live_sources.py -v`

#### Manual Verification:
- [ ] Luma events appear in search results
- [ ] Events have correct titles, dates, and URLs
- [ ] Events link back to luma.com correctly

---

## Phase 2: Partiful Extractor

### Overview
Create `PartifulExtractor` for scraping events from partiful.com city pages.

### Changes Required

#### 3.1 Create PartifulExtractor Class

**File**: `api/services/firecrawl.py`
**Changes**: Add after LumaExtractor class

```python
class PartifulExtractor(BaseExtractor):
    """
    Extractor for Partiful (partiful.com) events.

    Partiful is a social events platform popular for parties,
    gatherings, and community events.
    """

    SOURCE_NAME = "partiful"
    BASE_URL = "https://partiful.com"
    DEFAULT_CATEGORY = "social"

    # City codes supported by Partiful
    CITY_CODES = {
        "new york": "nyc",
        "los angeles": "la",
        "san francisco": "sf",
        "boston": "bos",
        "washington dc": "dc",
        "chicago": "chi",
        "miami": "mia",
        "london": "lon",
    }

    EVENT_SCHEMA = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Event title"},
            "description": {"type": "string", "description": "Event description"},
            "date": {"type": "string", "description": "Event date (e.g., 'Sunday, January 25, 2026')"},
            "time": {"type": "string", "description": "Event time (e.g., '9:30 AM PT')"},
            "location": {"type": "string", "description": "Full venue address"},
            "host_name": {"type": "string", "description": "Event host name"},
            "guest_count": {"type": "string", "description": "Number of guests (e.g., '45 going')"},
            "category": {"type": "string", "description": "Event category"},
            "cover_image": {"type": "string", "description": "Event banner image URL"},
        },
        "required": ["title"],
    }

    def _extract_event_id(self, url: str) -> str:
        """Extract event ID from Partiful URL."""
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        # Partiful URLs are like /e/abc123xyz
        if path.startswith("e/"):
            return path[2:]
        return path or url

    def _parse_extracted_data(
        self,
        url: str,
        extracted: dict[str, Any],
    ) -> ScrapedEvent | None:
        """Parse Partiful extracted data into ScrapedEvent."""
        import dateparser

        # Parse datetime
        start_dt = None
        date_str = extracted.get("date", "")
        time_str = extracted.get("time", "")

        if date_str:
            combined = f"{date_str} {time_str}".strip()
            start_dt = dateparser.parse(
                combined,
                settings={"PREFER_DATES_FROM": "future"},
            )

        # Partiful events are generally free (RSVP-based)
        is_free = True
        price_amount = None

        # Map category
        category = extracted.get("category", "").lower()
        if not category or category == "community":
            category = self.DEFAULT_CATEGORY

        return ScrapedEvent(
            source=self.SOURCE_NAME,
            event_id=self._extract_event_id(url),
            title=extracted.get("title", "Untitled"),
            description=extracted.get("description", ""),
            start_time=start_dt,
            end_time=None,
            venue_name=None,  # Partiful combines venue into location
            venue_address=extracted.get("location"),
            category=category,
            is_free=is_free,
            price_amount=price_amount,
            url=url,
            logo_url=extracted.get("cover_image"),
            raw_data=extracted,
        )

    async def discover_events(
        self,
        city: str = "nyc",
        limit: int = 20,
    ) -> list[ScrapedEvent]:
        """
        Discover Partiful events for a city.

        Args:
            city: City code (e.g., 'nyc', 'sf', 'la')
            limit: Maximum number of events to return

        Returns:
            List of discovered events
        """
        # Normalize city to Partiful code
        city_code = self.CITY_CODES.get(city.lower(), city.lower())
        discovery_url = f"{self.BASE_URL}/discover/{city_code}"

        logger.info("Discovering Partiful events for %s at %s", city, discovery_url)

        try:
            # Get links from discovery page
            data = await self.client.scrape(
                url=discovery_url,
                formats=["links", "markdown"],
            )

            links = data.get("links", [])

            # Filter to event links (/e/...)
            event_urls = []
            for link in links:
                href = link if isinstance(link, str) else link.get("href", "")
                if not href:
                    continue
                if "/e/" in href:
                    # Ensure full URL
                    if href.startswith("/"):
                        href = f"{self.BASE_URL}{href}"
                    elif not href.startswith("http"):
                        href = f"{self.BASE_URL}/{href}"
                    if href not in event_urls:
                        event_urls.append(href)

            logger.info("Found %d Partiful event URLs", len(event_urls))

            # Extract events
            events = []
            for url in event_urls[:limit + 5]:
                event = await self.extract_event(url)
                if event:
                    events.append(event)
                    if len(events) >= limit:
                        break

            logger.info("Discovered %d Partiful events", len(events))
            return events

        except Exception as e:
            logger.error("Failed to discover Partiful events: %s", e)
            return []


# Singleton
_partiful_extractor: PartifulExtractor | None = None


def get_partiful_extractor() -> PartifulExtractor:
    """Get the singleton Partiful extractor."""
    global _partiful_extractor
    if _partiful_extractor is None:
        _partiful_extractor = PartifulExtractor()
    return _partiful_extractor


async def search_partiful_adapter(profile: Any) -> list[ScrapedEvent]:
    """Adapter for registry pattern - searches Partiful events."""
    extractor = get_partiful_extractor()
    city = "nyc"  # Default
    events = await extractor.discover_events(city=city, limit=20)

    # Post-filter
    filtered = []
    for event in events:
        if hasattr(profile, "time_window") and profile.time_window:
            if profile.time_window.start and event.start_time:
                if event.start_time < profile.time_window.start:
                    continue
            if profile.time_window.end and event.start_time:
                if event.start_time > profile.time_window.end:
                    continue
        filtered.append(event)

    return filtered


def register_partiful_source() -> None:
    """Register Partiful as an event source."""
    api_key = os.getenv("FIRECRAWL_API_KEY", "")

    source = EventSource(
        name="partiful",
        search_fn=search_partiful_adapter,
        is_enabled_fn=lambda: bool(api_key),
        priority=27,
        description="Partiful social events via Firecrawl scraping",
    )
    register_event_source(source)
```

#### 3.2 Update Exports and Registration

**File**: `api/services/__init__.py` and `api/index.py`
**Changes**: Similar to Luma - add exports and registration call

#### 3.3 Add Live Tests

**File**: `api/services/tests/test_live_sources.py`
**Changes**: Add PartifulExtractor test class (similar pattern to Luma)

### Success Criteria

#### Automated Verification:
- [x] Type checking passes
- [x] Unit tests pass
- [ ] Integration tests pass: `pytest -m integration -k Partiful`

#### Manual Verification:
- [ ] Partiful events appear in search results
- [ ] Events have correct data and link to partiful.com

---

## Phase 3: Meetup Scraper

### Overview
Create `MeetupExtractor` for scraping events from meetup.com search pages.

### Changes Required

#### 3.1 Create MeetupExtractor Class

**File**: `api/services/firecrawl.py`
**Changes**: Add MeetupExtractor

```python
class MeetupExtractor(BaseExtractor):
    """
    Extractor for Meetup (meetup.com) events via Firecrawl scraping.

    Scrapes public event listings from meetup.com/find/ pages.
    """

    SOURCE_NAME = "meetup"
    BASE_URL = "https://www.meetup.com"
    DEFAULT_CATEGORY = "community"

    EVENT_SCHEMA = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Event title"},
            "description": {"type": "string", "description": "Event description"},
            "date_time": {"type": "string", "description": "Date and time"},
            "venue_name": {"type": "string", "description": "Venue name"},
            "venue_address": {"type": "string", "description": "Venue address"},
            "group_name": {"type": "string", "description": "Meetup group name"},
            "attendee_count": {"type": "string", "description": "Number of attendees"},
            "price": {"type": "string", "description": "Event price"},
            "event_type": {"type": "string", "description": "Online or in-person"},
        },
        "required": ["title"],
    }

    def _extract_event_id(self, url: str) -> str:
        """Extract event ID from Meetup URL."""
        # URL like /group-name/events/12345/
        parsed = urlparse(url)
        parts = parsed.path.strip("/").split("/")
        if "events" in parts:
            idx = parts.index("events")
            if idx + 1 < len(parts):
                return parts[idx + 1]
        return parsed.path

    def _parse_extracted_data(
        self,
        url: str,
        extracted: dict[str, Any],
    ) -> ScrapedEvent | None:
        """Parse Meetup extracted data into ScrapedEvent."""
        import dateparser

        start_dt = None
        date_str = extracted.get("date_time", "")
        if date_str:
            start_dt = dateparser.parse(
                date_str,
                settings={"PREFER_DATES_FROM": "future"},
            )

        # Check if online
        event_type = extracted.get("event_type", "").lower()
        if "online" in event_type:
            return None  # Skip online events

        # Parse price
        price_str = extracted.get("price", "")
        is_free = not price_str or "free" in price_str.lower()
        price_amount = None
        if not is_free:
            match = re.search(r"\$?(\d+(?:\.\d{2})?)", price_str)
            if match:
                price_amount = int(float(match.group(1)) * 100)

        return ScrapedEvent(
            source=self.SOURCE_NAME,
            event_id=self._extract_event_id(url),
            title=extracted.get("title", "Untitled"),
            description=extracted.get("description", ""),
            start_time=start_dt,
            end_time=None,
            venue_name=extracted.get("venue_name"),
            venue_address=extracted.get("venue_address"),
            category=self.DEFAULT_CATEGORY,
            is_free=is_free,
            price_amount=price_amount,
            url=url,
            logo_url=None,
            raw_data=extracted,
        )

    async def discover_events(
        self,
        location: str = "Columbus, OH",
        limit: int = 20,
    ) -> list[ScrapedEvent]:
        """Discover Meetup events for a location."""
        from urllib.parse import quote_plus

        encoded_location = quote_plus(location)
        discovery_url = f"{self.BASE_URL}/find/?location={encoded_location}&eventType=inPerson"

        logger.info("Discovering Meetup events at %s", discovery_url)

        try:
            data = await self.client.scrape(
                url=discovery_url,
                formats=["links", "markdown"],
            )

            links = data.get("links", [])

            # Filter to event links
            event_urls = []
            for link in links:
                href = link if isinstance(link, str) else link.get("href", "")
                if "/events/" in href and href not in event_urls:
                    if not href.startswith("http"):
                        href = f"{self.BASE_URL}{href}"
                    event_urls.append(href)

            events = []
            for url in event_urls[:limit + 5]:
                event = await self.extract_event(url)
                if event:
                    events.append(event)
                    if len(events) >= limit:
                        break

            return events

        except Exception as e:
            logger.error("Failed to discover Meetup events: %s", e)
            return []
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes
- [ ] Integration tests pass

#### Manual Verification:
- [ ] Meetup events appear in search results
- [ ] Only in-person events are returned
- [ ] Events link correctly to meetup.com

---

## Phase 4: Facebook Events Extractor

### Overview
Create `FacebookExtractor` for scraping public Facebook events.

### Changes Required

#### 4.1 Create FacebookExtractor Class

**File**: `api/services/firecrawl.py`

```python
class FacebookExtractor(BaseExtractor):
    """
    Extractor for Facebook Events via scraping.

    Scrapes public events from facebook.com/events/search.
    Firecrawl handles anti-bot measures on their infrastructure.
    """

    SOURCE_NAME = "facebook"
    BASE_URL = "https://www.facebook.com"
    DEFAULT_CATEGORY = "community"

    EVENT_SCHEMA = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Event name"},
            "description": {"type": "string", "description": "Event description"},
            "date": {"type": "string", "description": "Event date"},
            "time": {"type": "string", "description": "Event time"},
            "location": {"type": "string", "description": "Venue/location"},
            "host": {"type": "string", "description": "Event host/organizer"},
            "interested_count": {"type": "string", "description": "People interested"},
            "going_count": {"type": "string", "description": "People going"},
        },
        "required": ["title"],
    }

    def _extract_event_id(self, url: str) -> str:
        """Extract event ID from Facebook URL."""
        parsed = urlparse(url)
        parts = parsed.path.strip("/").split("/")
        if "events" in parts:
            idx = parts.index("events")
            if idx + 1 < len(parts):
                return parts[idx + 1]
        return parsed.path

    def _parse_extracted_data(
        self,
        url: str,
        extracted: dict[str, Any],
    ) -> ScrapedEvent | None:
        """Parse Facebook extracted data into ScrapedEvent."""
        import dateparser

        start_dt = None
        date_str = extracted.get("date", "")
        time_str = extracted.get("time", "")
        if date_str:
            combined = f"{date_str} {time_str}".strip()
            start_dt = dateparser.parse(
                combined,
                settings={"PREFER_DATES_FROM": "future"},
            )

        return ScrapedEvent(
            source=self.SOURCE_NAME,
            event_id=self._extract_event_id(url),
            title=extracted.get("title", "Untitled"),
            description=extracted.get("description", ""),
            start_time=start_dt,
            end_time=None,
            venue_name=None,
            venue_address=extracted.get("location"),
            category=self.DEFAULT_CATEGORY,
            is_free=True,  # Facebook doesn't show pricing in search
            price_amount=None,
            url=url,
            logo_url=None,
            raw_data=extracted,
        )

    async def discover_events(
        self,
        query: str = "Columbus",
        limit: int = 20,
    ) -> list[ScrapedEvent]:
        """Discover Facebook events by search query."""
        from urllib.parse import quote_plus

        encoded_query = quote_plus(query)
        discovery_url = f"{self.BASE_URL}/events/search/?q={encoded_query}"

        logger.info("Discovering Facebook events at %s", discovery_url)

        try:
            data = await self.client.scrape(
                url=discovery_url,
                formats=["links", "markdown"],
            )

            links = data.get("links", [])

            event_urls = []
            for link in links:
                href = link if isinstance(link, str) else link.get("href", "")
                # Facebook event URLs contain /events/ followed by numeric ID
                if "/events/" in href and any(c.isdigit() for c in href):
                    if not href.startswith("http"):
                        href = f"{self.BASE_URL}{href}"
                    # Remove tracking params
                    parsed = urlparse(href)
                    clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                    if clean_url not in event_urls:
                        event_urls.append(clean_url)

            events = []
            for url in event_urls[:limit + 5]:
                event = await self.extract_event(url)
                if event:
                    events.append(event)
                    if len(events) >= limit:
                        break

            return events

        except Exception as e:
            logger.error("Failed to discover Facebook events: %s", e)
            return []
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes
- [ ] Integration tests pass (may be flaky due to Facebook's protections)

#### Manual Verification:
- [ ] Facebook events appear when available
- [ ] Graceful degradation when Facebook blocks requests

---

## Phase 5: River Extractor

### Overview
Create `RiverExtractor` for scraping River community events.

### Changes Required

#### 5.1 Create RiverExtractor Class

**File**: `api/services/firecrawl.py`

```python
class RiverExtractor(BaseExtractor):
    """
    Extractor for River (getriver.io) community events.

    River organizes events by community (e.g., All-In Podcast, MFM).
    We scrape the discovery page and filter by city from venue data.
    """

    SOURCE_NAME = "river"
    BASE_URL = "https://app.getriver.io"
    DEFAULT_CATEGORY = "community"

    EVENT_SCHEMA = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Event title"},
            "description": {"type": "string", "description": "Event description"},
            "date": {"type": "string", "description": "Event date"},
            "time": {"type": "string", "description": "Event time"},
            "location": {"type": "string", "description": "Full location/venue"},
            "city": {"type": "string", "description": "City name"},
            "community_name": {"type": "string", "description": "River community name"},
            "host_name": {"type": "string", "description": "Event host"},
        },
        "required": ["title"],
    }

    def _extract_event_id(self, url: str) -> str:
        """Extract event ID from River URL."""
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        if path.startswith("events/"):
            return path[7:]  # Remove 'events/'
        return path

    def _parse_extracted_data(
        self,
        url: str,
        extracted: dict[str, Any],
    ) -> ScrapedEvent | None:
        """Parse River extracted data into ScrapedEvent."""
        import dateparser

        start_dt = None
        date_str = extracted.get("date", "")
        time_str = extracted.get("time", "")
        if date_str:
            combined = f"{date_str} {time_str}".strip()
            start_dt = dateparser.parse(
                combined,
                settings={"PREFER_DATES_FROM": "future"},
            )

        return ScrapedEvent(
            source=self.SOURCE_NAME,
            event_id=self._extract_event_id(url),
            title=extracted.get("title", "Untitled"),
            description=extracted.get("description", ""),
            start_time=start_dt,
            end_time=None,
            venue_name=extracted.get("community_name"),
            venue_address=extracted.get("location"),
            category=self.DEFAULT_CATEGORY,
            is_free=True,  # River events are typically free
            price_amount=None,
            url=url,
            logo_url=None,
            raw_data=extracted,
        )

    async def discover_events(
        self,
        city_filter: str | None = None,
        limit: int = 20,
    ) -> list[ScrapedEvent]:
        """
        Discover River events.

        Args:
            city_filter: Optional city to filter by (from venue address)
            limit: Maximum number of events

        Returns:
            List of events (filtered by city if specified)
        """
        discovery_url = f"{self.BASE_URL}/discovery/communities"

        logger.info("Discovering River events at %s", discovery_url)

        try:
            data = await self.client.scrape(
                url=discovery_url,
                formats=["links", "markdown"],
            )

            links = data.get("links", [])

            # River event URLs contain /events/
            event_urls = []
            for link in links:
                href = link if isinstance(link, str) else link.get("href", "")
                if "/events/" in href:
                    if not href.startswith("http"):
                        href = f"{self.BASE_URL}{href}"
                    if href not in event_urls:
                        event_urls.append(href)

            events = []
            for url in event_urls[:limit + 10]:
                event = await self.extract_event(url)
                if event:
                    # Filter by city if specified
                    if city_filter:
                        location = (event.venue_address or "").lower()
                        if city_filter.lower() not in location:
                            continue
                    events.append(event)
                    if len(events) >= limit:
                        break

            return events

        except Exception as e:
            logger.error("Failed to discover River events: %s", e)
            return []
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes
- [ ] Integration tests pass

#### Manual Verification:
- [ ] River events appear when available
- [ ] Events are properly filtered by city

---

## Testing Strategy

### Unit Tests
- Mock Firecrawl responses for each extractor
- Test URL parsing and event ID extraction
- Test date/time parsing edge cases
- Test price parsing

### Integration Tests
Located in `api/services/tests/test_live_sources.py`:
- Each extractor has a test class
- Tests marked with `@pytest.mark.integration`
- Skipped if `FIRECRAWL_API_KEY` not set

### Manual Testing Steps
1. Set `FIRECRAWL_API_KEY` in environment
2. Run: `pytest -m integration api/services/tests/test_live_sources.py -v`
3. Check logs for successful event discovery
4. Verify events in search results via UI

---

## Future Sources (Not in This Plan)

Document for future implementation:
- **Ticketmaster** - Discovery API (public)
- **Dice.fm** - Music/nightlife events
- **Bandsintown** - Artist events
- **SeatGeek** - Sports/concerts
- **Venue Calendars** - Local venue scraping

---

## References

- Existing pattern: `api/services/firecrawl.py:249-400` (PoshExtractor)
- Registry: `api/services/base.py:48-124`
- Research: `thoughts/shared/research/2026-01-11-firecrawl-multi-source-expansion.md`
- Luma Firecrawl example: https://github.com/alexfazio/firecrawl-quickstarts/blob/main/events-scout-examples/luma.ipynb
