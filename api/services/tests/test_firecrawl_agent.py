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
        assert _parse_price("no cover") == (True, None)
        assert _parse_price("complimentary") == (True, None)
        assert _parse_price("donation") == (True, None)

    def test_paid_prices(self):
        assert _parse_price("$25") == (False, 2500)
        assert _parse_price("$10.50") == (False, 1050)
        assert _parse_price("25") == (False, 2500)
        assert _parse_price("$0") == (False, 0)


class TestParseDateTime:
    """Tests for datetime parsing."""

    def test_parse_valid_date(self):
        result = _parse_datetime("January 15, 2026", "7:00 PM")
        assert result is not None
        assert result.year == 2026
        assert result.month == 1
        assert result.day == 15

    def test_parse_date_only(self):
        result = _parse_datetime("January 15, 2026", None)
        assert result is not None
        assert result.year == 2026

    def test_parse_none_date(self):
        result = _parse_datetime(None, "7:00 PM")
        assert result is None


class TestAgentEventItem:
    """Tests for AgentEventItem Pydantic model."""

    def test_minimal_event(self):
        event = AgentEventItem(
            title="Test Event",
            start_date="January 15, 2026",
            url="https://example.com/event",
        )
        assert event.title == "Test Event"
        assert event.price == "Free"  # Default
        assert event.venue_name is None

    def test_full_event(self):
        event = AgentEventItem(
            title="Full Event",
            start_date="January 15, 2026",
            start_time="7:00 PM",
            venue_name="Test Venue",
            venue_address="123 Main St, Columbus, OH",
            price="$25",
            url="https://example.com/event",
            description="A great event",
        )
        assert event.title == "Full Event"
        assert event.venue_name == "Test Venue"
        assert event.price == "$25"


class TestAgentEventsOutput:
    """Tests for AgentEventsOutput Pydantic model."""

    def test_events_list(self):
        output = AgentEventsOutput(
            events=[
                AgentEventItem(
                    title="Event 1",
                    start_date="January 15, 2026",
                    url="https://example.com/1",
                ),
                AgentEventItem(
                    title="Event 2",
                    start_date="January 16, 2026",
                    url="https://example.com/2",
                ),
            ]
        )
        assert len(output.events) == 2
        assert output.events[0].title == "Event 1"


class TestFirecrawlAgentClient:
    """Tests for FirecrawlAgentClient."""

    def test_no_api_key(self):
        with patch.dict("os.environ", {}, clear=True):
            client = FirecrawlAgentClient(api_key=None)
            assert client.api_key is None

    def test_with_api_key(self):
        client = FirecrawlAgentClient(api_key="test-key")
        assert client.api_key == "test-key"

    @pytest.mark.asyncio
    async def test_discover_events_no_key(self):
        with patch.dict("os.environ", {}, clear=True):
            client = FirecrawlAgentClient(api_key=None)
            result = await client.discover_events("test prompt")
            assert result == []

    @pytest.mark.asyncio
    async def test_discover_events_success(self):
        """Test successful event discovery."""
        client = FirecrawlAgentClient(api_key="test-key")

        # Mock the SDK client
        mock_sdk = MagicMock()
        mock_result = MagicMock()
        mock_result.data = {
            "events": [
                {
                    "title": "Test Event",
                    "start_date": "January 15, 2026",
                    "url": "https://example.com",
                }
            ]
        }
        mock_sdk.agent = AsyncMock(return_value=mock_result)
        client._client = mock_sdk

        result = await client.discover_events("Find events")

        assert len(result) == 1
        assert result[0]["title"] == "Test Event"

    @pytest.mark.asyncio
    async def test_discover_events_list_response(self):
        """Test when response is a list instead of dict."""
        client = FirecrawlAgentClient(api_key="test-key")

        mock_sdk = MagicMock()
        mock_result = MagicMock()
        mock_result.data = [
            {
                "title": "Event A",
                "start_date": "January 15, 2026",
                "url": "https://example.com/a",
            }
        ]
        mock_sdk.agent = AsyncMock(return_value=mock_result)
        client._client = mock_sdk

        result = await client.discover_events("Find events")

        assert len(result) == 1
        assert result[0]["title"] == "Event A"

    @pytest.mark.asyncio
    async def test_discover_events_timeout(self):
        """Test timeout handling."""
        import asyncio

        client = FirecrawlAgentClient(api_key="test-key")

        mock_sdk = MagicMock()
        mock_sdk.agent = AsyncMock(side_effect=asyncio.TimeoutError())
        client._client = mock_sdk

        result = await client.discover_events("Find events")
        assert result == []

    @pytest.mark.asyncio
    async def test_discover_events_exception(self):
        """Test general exception handling."""
        client = FirecrawlAgentClient(api_key="test-key")

        mock_sdk = MagicMock()
        mock_sdk.agent = AsyncMock(side_effect=Exception("API Error"))
        client._client = mock_sdk

        result = await client.discover_events("Find events")
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
        assert "Columbus, Ohio" in call_kwargs["prompt"]

    @pytest.mark.asyncio
    async def test_adapter_with_keywords(self):
        """Test adapter includes keywords in prompt."""
        mock_client = MagicMock()
        mock_client.discover_events = AsyncMock(return_value=[])

        profile = MagicMock()
        profile.location = "Columbus, Ohio"
        profile.time_window = None
        profile.categories = None
        profile.keywords = ["jazz", "music"]
        profile.free_only = False

        with patch(
            "api.services.firecrawl_agent.get_firecrawl_agent_client",
            return_value=mock_client,
        ):
            await firecrawl_agent_adapter(profile)

        call_kwargs = mock_client.discover_events.call_args[1]
        assert "jazz" in call_kwargs["prompt"]
        assert "music" in call_kwargs["prompt"]

    @pytest.mark.asyncio
    async def test_adapter_with_free_only(self):
        """Test adapter includes free filter in prompt."""
        mock_client = MagicMock()
        mock_client.discover_events = AsyncMock(return_value=[])

        profile = MagicMock()
        profile.location = "Columbus, Ohio"
        profile.time_window = None
        profile.categories = None
        profile.keywords = None
        profile.free_only = True

        with patch(
            "api.services.firecrawl_agent.get_firecrawl_agent_client",
            return_value=mock_client,
        ):
            await firecrawl_agent_adapter(profile)

        call_kwargs = mock_client.discover_events.call_args[1]
        assert "free to attend" in call_kwargs["prompt"]

    @pytest.mark.asyncio
    async def test_adapter_converts_to_scraped_event(self):
        """Test that adapter converts raw events to ScrapedEvent."""
        mock_client = MagicMock()
        mock_client.discover_events = AsyncMock(
            return_value=[
                {
                    "title": "Test Event",
                    "start_date": "January 15, 2026",
                    "start_time": "7:00 PM",
                    "venue_name": "Test Venue",
                    "venue_address": "123 Main St",
                    "price": "$25",
                    "url": "https://example.com/event",
                    "description": "A test event",
                }
            ]
        )

        profile = MagicMock()
        profile.location = "Columbus, Ohio"
        profile.time_window = None
        profile.categories = None
        profile.keywords = None
        profile.free_only = False

        with patch(
            "api.services.firecrawl_agent.get_firecrawl_agent_client",
            return_value=mock_client,
        ):
            events = await firecrawl_agent_adapter(profile)

        assert len(events) == 1
        event = events[0]
        assert event.title == "Test Event"
        assert event.source == "firecrawl-agent"
        assert event.venue_name == "Test Venue"
        assert event.is_free is False
        assert event.price_amount == 2500

    @pytest.mark.asyncio
    async def test_adapter_filters_by_time_window(self):
        """Test that adapter filters events outside time window."""
        mock_client = MagicMock()
        mock_client.discover_events = AsyncMock(
            return_value=[
                {
                    "title": "Past Event",
                    "start_date": "January 1, 2020",
                    "url": "https://example.com/past",
                },
                {
                    "title": "Future Event",
                    "start_date": "January 15, 2026",
                    "url": "https://example.com/future",
                },
            ]
        )

        profile = MagicMock()
        profile.location = "Columbus, Ohio"
        profile.time_window = MagicMock()
        profile.time_window.start = datetime(2026, 1, 1)
        profile.time_window.end = datetime(2026, 12, 31)
        profile.categories = None
        profile.keywords = None
        profile.free_only = False

        with patch(
            "api.services.firecrawl_agent.get_firecrawl_agent_client",
            return_value=mock_client,
        ):
            events = await firecrawl_agent_adapter(profile)

        # Only the future event should be included
        assert len(events) == 1
        assert events[0].title == "Future Event"

    @pytest.mark.asyncio
    async def test_adapter_filters_by_free_only(self):
        """Test that adapter filters paid events when free_only is True."""
        mock_client = MagicMock()
        mock_client.discover_events = AsyncMock(
            return_value=[
                {
                    "title": "Free Event",
                    "start_date": "January 15, 2026",
                    "price": "Free",
                    "url": "https://example.com/free",
                },
                {
                    "title": "Paid Event",
                    "start_date": "January 15, 2026",
                    "price": "$25",
                    "url": "https://example.com/paid",
                },
            ]
        )

        profile = MagicMock()
        profile.location = "Columbus, Ohio"
        profile.time_window = None
        profile.categories = None
        profile.keywords = None
        profile.free_only = True

        with patch(
            "api.services.firecrawl_agent.get_firecrawl_agent_client",
            return_value=mock_client,
        ):
            events = await firecrawl_agent_adapter(profile)

        # Only the free event should be included
        assert len(events) == 1
        assert events[0].title == "Free Event"
