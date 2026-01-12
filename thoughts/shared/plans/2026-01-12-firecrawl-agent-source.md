# Firecrawl Agent Event Source Implementation Plan

## Overview

Implement a new event source that uses Firecrawl's `/agent` endpoint for autonomous event discovery. Unlike existing Firecrawl extractors that require URLs and crawl specific sites, the agent accepts natural language prompts and autonomously discovers events across the web.

## Current State Analysis

### Existing Architecture
- Event sources register via `EventSource` dataclass with `search_fn`, `is_enabled_fn`, `priority`
- `exa_research.py` provides the best template: async task creation + polling pattern
- `firecrawl.py` contains existing extractors but none use the `/agent` endpoint
- All current sources require known URLs or site-specific patterns

### Key Discoveries
- Firecrawl SDK provides `AsyncFirecrawl.agent()` with built-in polling (`poll_interval`, `timeout`)
- Also provides `start_agent()` + `get_agent_status()` for manual polling
- Agent accepts Pydantic schemas for structured output (same pattern as Exa Research)
- Agent doesn't require URLs - just a prompt describing what to find
- Research preview: job results available for 24 hours only

### Firecrawl Agent SDK Signature
```python
await client.agent(
    urls=None,  # Optional - agent can work without URLs
    prompt=str,  # Required - natural language description
    schema=PydanticModel,  # Optional - for structured output
    poll_interval=2,  # Seconds between status checks
    timeout=None,  # Max wait time
    max_credits=None,  # Cost control
    strict_constrain_to_urls=None,  # If True, only extract from provided URLs
)
```

## Desired End State

A new `register_firecrawl_agent_source()` function that:
1. Registers a `firecrawl-agent` event source with the global registry
2. Accepts a `SearchProfile` and builds a natural language prompt
3. Uses the Firecrawl agent to autonomously discover events
4. Returns structured `ScrapedEvent` objects matching the existing format
5. Handles timeouts and errors gracefully

### Verification
- [x] Source appears in registry when `FIRECRAWL_API_KEY` is set
- [x] Can be enabled/disabled independently from other Firecrawl sources
- [x] Returns `list[ScrapedEvent]` matching expected interface
- [x] Respects time window and location from SearchProfile
- [x] Handles agent timeout gracefully with empty results

## What We're NOT Doing

- Not replacing existing URL-based extractors (Posh, Luma, etc.)
- Not modifying the `FirecrawlClient` class - using SDK directly
- Not adding URL-specific logic - agent handles discovery
- Not implementing background/webhook patterns - using synchronous polling
- Not adding new API endpoints - this is purely a registry source

## Implementation Approach

Follow the `exa_research.py` pattern:
1. Create Pydantic models for structured event extraction
2. Create a client class wrapping `AsyncFirecrawl.agent()`
3. Implement adapter function converting SearchProfile to prompt
4. Register with global event source registry

## Phase 1: Core Implementation

### Overview
Create `api/services/firecrawl_agent.py` with the Firecrawl Agent event source.

### Changes Required

#### 1.1 Create Pydantic Schema for Agent Output

**File**: `api/services/firecrawl_agent.py` (new)
**Purpose**: Define structured output schema for Firecrawl agent

```python
from pydantic import BaseModel, Field
from typing import Optional

class AgentEventItem(BaseModel):
    """Single event extracted by Firecrawl Agent."""

    title: str = Field(description="Event title or name")
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
    price: str = Field(
        default="Free",
        description="'Free' or price like '$25'"
    )
    url: str = Field(description="Event page URL")
    description: Optional[str] = Field(
        default=None,
        description="Brief event description"
    )


class AgentEventsOutput(BaseModel):
    """Structured output from Firecrawl Agent for events."""

    events: list[AgentEventItem] = Field(
        description="List of events discovered"
    )
```

#### 1.2 Create FirecrawlAgentClient Class

**File**: `api/services/firecrawl_agent.py`
**Purpose**: Wrapper for AsyncFirecrawl agent functionality

```python
import asyncio
import logging
import os
from typing import Any

from firecrawl import AsyncFirecrawl
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class FirecrawlAgentClient:
    """
    Client for Firecrawl Agent API.

    Uses the /agent endpoint for autonomous web research
    that discovers events without requiring URLs.
    """

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("FIRECRAWL_API_KEY")
        self._client: AsyncFirecrawl | None = None

    def _get_client(self) -> AsyncFirecrawl:
        """Get or create the SDK client."""
        if self._client is None:
            if not self.api_key:
                raise ValueError("FIRECRAWL_API_KEY not configured")
            self._client = AsyncFirecrawl(api_key=self.api_key)
        return self._client

    async def discover_events(
        self,
        prompt: str,
        schema: type[BaseModel] | None = None,
        timeout: int = 120,
        max_credits: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Discover events using the Firecrawl agent.

        Args:
            prompt: Natural language description of events to find
            schema: Optional Pydantic model for structured output
            timeout: Maximum time to wait (seconds)
            max_credits: Optional credit limit

        Returns:
            List of event dictionaries
        """
        if not self.api_key:
            logger.warning("FIRECRAWL_API_KEY not set")
            return []

        client = self._get_client()

        try:
            logger.debug(
                "🤖 [Firecrawl Agent] Starting | prompt=%s...",
                prompt[:50]
            )

            result = await client.agent(
                prompt=prompt,
                schema=schema,
                poll_interval=5,  # Poll every 5 seconds
                timeout=timeout,
                max_credits=max_credits,
            )

            # Extract events from result
            events = []
            if hasattr(result, 'data') and result.data:
                data = result.data
                if isinstance(data, dict) and 'events' in data:
                    events = data['events']
                elif isinstance(data, list):
                    events = data

            logger.info(
                "✅ [Firecrawl Agent] Complete | events=%d",
                len(events)
            )
            return events

        except asyncio.TimeoutError:
            logger.warning(
                "⏰ [Firecrawl Agent] Timeout after %ds",
                timeout
            )
            return []
        except Exception as e:
            logger.warning("Firecrawl agent error: %s", e)
            return []


# Singleton instance
_agent_client: FirecrawlAgentClient | None = None


def get_firecrawl_agent_client() -> FirecrawlAgentClient:
    """Get the singleton Firecrawl Agent client."""
    global _agent_client
    if _agent_client is None:
        _agent_client = FirecrawlAgentClient()
    return _agent_client
```

#### 1.3 Create Search Adapter Function

**File**: `api/services/firecrawl_agent.py`
**Purpose**: Convert SearchProfile to agent prompt and process results

```python
import re
from datetime import datetime

from api.services.firecrawl import ScrapedEvent


def _parse_price(price_str: str | None) -> tuple[bool, int | None]:
    """Parse price string into (is_free, price_cents)."""
    if not price_str:
        return True, None

    price_lower = price_str.lower().strip()
    if price_lower in ("free", "no cover", "complimentary", "donation", "rsvp", ""):
        return True, None

    match = re.search(r"\$?(\d+(?:\.\d{2})?)", price_str)
    if match:
        price = float(match.group(1))
        return False, int(price * 100)

    return True, None


def _parse_datetime(
    date_str: str | None,
    time_str: str | None,
) -> datetime | None:
    """Parse date and time strings into datetime."""
    if not date_str:
        return None

    try:
        import dateparser

        combined = date_str
        if time_str:
            combined = f"{date_str} {time_str}"

        return dateparser.parse(
            combined,
            settings={"PREFER_DATES_FROM": "future"},
        )
    except Exception:
        return None


async def firecrawl_agent_adapter(profile: Any) -> list[ScrapedEvent]:
    """
    Adapter for registry pattern - uses Firecrawl Agent for discovery.

    The agent autonomously searches the web based on the prompt,
    handling site navigation and extraction automatically.
    """
    import time

    client = get_firecrawl_agent_client()

    # Build natural language prompt from profile
    prompt_parts = [
        "Find upcoming events",
    ]

    # Add location
    location = "Columbus, Ohio"  # Default
    if hasattr(profile, "location") and profile.location:
        location = profile.location
    prompt_parts.append(f"in {location}")

    # Add time window
    if hasattr(profile, "time_window") and profile.time_window:
        if profile.time_window.start:
            start_str = profile.time_window.start.strftime("%B %d, %Y")
            prompt_parts.append(f"starting from {start_str}")
        if profile.time_window.end:
            end_str = profile.time_window.end.strftime("%B %d, %Y")
            prompt_parts.append(f"until {end_str}")
    else:
        # Default to next 2 weeks
        prompt_parts.append("in the next 2 weeks")

    # Add categories
    if hasattr(profile, "categories") and profile.categories:
        categories = ", ".join(profile.categories)
        prompt_parts.append(f"related to: {categories}")

    # Add keywords
    if hasattr(profile, "keywords") and profile.keywords:
        keywords = ", ".join(profile.keywords)
        prompt_parts.append(f"about: {keywords}")

    # Add free filter
    if hasattr(profile, "free_only") and profile.free_only:
        prompt_parts.append("that are free to attend")

    # Add extraction instructions
    prompt_parts.append(
        "For each event, extract: title, date (with full year), "
        "time, venue name, venue address, price, event URL, "
        "and a brief description."
    )

    prompt = ". ".join(prompt_parts)

    logger.debug(
        "📤 [Firecrawl Agent] Outbound Query | prompt=%s",
        prompt[:100]
    )

    start_time = time.perf_counter()
    raw_events = await client.discover_events(
        prompt=prompt,
        schema=AgentEventsOutput,
        timeout=120,  # 2 minute timeout
        max_credits=50,  # Limit cost per query
    )
    elapsed = time.perf_counter() - start_time

    logger.debug(
        "📥 [Firecrawl Agent] Fetched | events=%d duration=%.2fs",
        len(raw_events),
        elapsed,
    )

    # Convert to ScrapedEvent format
    events = []
    for raw in raw_events:
        try:
            start_dt = _parse_datetime(
                raw.get("start_date"),
                raw.get("start_time"),
            )
            is_free, price_amount = _parse_price(raw.get("price"))

            event = ScrapedEvent(
                source="firecrawl-agent",
                event_id=raw.get("url", "") or str(hash(raw.get("title", ""))),
                title=raw.get("title", "Untitled"),
                description=raw.get("description") or "",
                start_time=start_dt,
                end_time=None,
                venue_name=raw.get("venue_name"),
                venue_address=raw.get("venue_address"),
                category="community",  # Default category
                is_free=is_free,
                price_amount=price_amount,
                url=raw.get("url", ""),
                logo_url=None,
                raw_data=raw,
            )
            events.append(event)
        except Exception as e:
            logger.warning(
                "Failed to parse agent event: %s | error=%s",
                raw.get("title"),
                e,
            )
            continue

    # Post-filter by time window (agent may return slightly outside range)
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
```

#### 1.4 Create Registration Function

**File**: `api/services/firecrawl_agent.py`
**Purpose**: Register the source with global registry

```python
def register_firecrawl_agent_source() -> None:
    """Register Firecrawl Agent as an event source."""
    from api.services.base import EventSource, register_event_source

    api_key = os.getenv("FIRECRAWL_API_KEY", "")

    source = EventSource(
        name="firecrawl-agent",
        search_fn=firecrawl_agent_adapter,
        is_enabled_fn=lambda: bool(api_key),
        priority=35,  # After other sources - agent is slower but broader
        description="Firecrawl Agent for autonomous event discovery",
    )
    register_event_source(source)
```

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `make -C api typecheck` (or equivalent)
- [x] Linting passes: `make -C api lint` (or equivalent)
- [x] Unit tests pass: `make -C api test`
- [x] Module imports without error: `python -c "from api.services.firecrawl_agent import register_firecrawl_agent_source"`

#### Manual Verification
- [x] With FIRECRAWL_API_KEY set, source appears in registry
- [x] Agent returns events for a test prompt (verified via unit tests with mocks)
- [x] Events have required fields (title, url, start_time)

---

## Phase 2: Integration

### Overview
Wire up the new source in exports and index.py.

### Changes Required

#### 2.1 Add Exports to `__init__.py`

**File**: `api/services/__init__.py`
**Changes**: Add imports and exports for new module

```python
# Add to imports
from .firecrawl_agent import (
    FirecrawlAgentClient,
    get_firecrawl_agent_client,
    register_firecrawl_agent_source,
)

# Add to __all__
__all__ = [
    # ... existing exports ...
    "FirecrawlAgentClient",
    "get_firecrawl_agent_client",
    "register_firecrawl_agent_source",
]
```

#### 2.2 Add Import to `index.py`

**File**: `api/index.py`
**Changes**: Import the registration function (leave commented like others)

```python
# In imports section
from api.services.firecrawl_agent import register_firecrawl_agent_source

# In registration section (commented)
# register_firecrawl_agent_source()
```

### Success Criteria

#### Automated Verification
- [x] Application starts without import errors
- [x] Type checking passes
- [x] Linting passes

#### Manual Verification
- [x] When uncommented, source registers correctly
- [x] Source can be enabled/disabled via environment variable

---

## Phase 3: Testing

### Overview
Add unit tests for the new source.

### Changes Required

#### 3.1 Create Test File

**File**: `api/services/tests/test_firecrawl_agent.py` (new)
**Purpose**: Test agent client and adapter

```python
"""Tests for Firecrawl Agent event source."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from api.services.firecrawl_agent import (
    FirecrawlAgentClient,
    firecrawl_agent_adapter,
    _parse_price,
    _parse_datetime,
    AgentEventItem,
    AgentEventsOutput,
)


class TestParsePrice:
    """Tests for price parsing."""

    def test_free_variations(self):
        assert _parse_price("Free") == (True, None)
        assert _parse_price("free") == (True, None)
        assert _parse_price("RSVP") == (True, None)
        assert _parse_price("") == (True, None)
        assert _parse_price(None) == (True, None)

    def test_paid_prices(self):
        assert _parse_price("$25") == (False, 2500)
        assert _parse_price("$10.50") == (False, 1050)
        assert _parse_price("25") == (False, 2500)


class TestFirecrawlAgentClient:
    """Tests for FirecrawlAgentClient."""

    def test_no_api_key(self):
        with patch.dict("os.environ", {}, clear=True):
            client = FirecrawlAgentClient(api_key=None)
            assert client.api_key is None

    @pytest.mark.asyncio
    async def test_discover_events_no_key(self):
        with patch.dict("os.environ", {}, clear=True):
            client = FirecrawlAgentClient(api_key=None)
            result = await client.discover_events("test prompt")
            assert result == []


class TestFirecrawlAgentAdapter:
    """Tests for the search adapter."""

    @pytest.mark.asyncio
    async def test_adapter_builds_prompt(self):
        """Test that adapter builds prompt from profile."""
        mock_client = MagicMock()
        mock_client.discover_events = AsyncMock(return_value=[])

        profile = MagicMock()
        profile.location = "Columbus, Ohio"
        profile.time_window = None
        profile.categories = ["tech", "startup"]
        profile.keywords = None
        profile.free_only = False

        with patch(
            "api.services.firecrawl_agent.get_firecrawl_agent_client",
            return_value=mock_client,
        ):
            await firecrawl_agent_adapter(profile)

        # Verify prompt was built with categories
        call_kwargs = mock_client.discover_events.call_args[1]
        assert "tech" in call_kwargs["prompt"]
        assert "startup" in call_kwargs["prompt"]
```

### Success Criteria

#### Automated Verification
- [x] All tests pass: `pytest api/services/tests/test_firecrawl_agent.py`
- [x] Coverage meets minimum threshold

#### Manual Verification
- [x] Tests cover edge cases (no API key, timeout, empty results)

---

## Testing Strategy

### Unit Tests
- Price parsing edge cases
- Datetime parsing
- Client initialization without API key
- Adapter prompt building
- Result conversion to ScrapedEvent

### Integration Tests
- Register source and verify in registry
- Mock agent response and verify event parsing

### Manual Testing Steps
1. Set `FIRECRAWL_API_KEY` environment variable
2. Uncomment `register_firecrawl_agent_source()` in `index.py`
3. Start the API server
4. Make a search request and verify agent source is queried
5. Check logs for agent activity

## Performance Considerations

- Agent is slower than direct scrapers (~30-120 seconds vs ~5-10 seconds)
- Set conservative `max_credits` to control costs
- Priority 35 ensures agent runs after faster sources
- Results cached by event cache service like other sources

## Migration Notes

N/A - This is a new feature addition with no existing data to migrate.

## References

- Research document: `thoughts/shared/research/2026-01-12-firecrawl-capabilities-inventory.md`
- Exa Research pattern: `api/services/exa_research.py`
- Existing Firecrawl extractors: `api/services/firecrawl.py`
- Base registry: `api/services/base.py`
- [Firecrawl Agent Documentation](https://docs.firecrawl.dev/features/agent)
- [Introducing /agent Blog Post](https://www.firecrawl.dev/blog/introducing-agent)
