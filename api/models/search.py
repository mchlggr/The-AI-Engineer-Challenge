"""Search profile models for event discovery."""

from datetime import datetime

from pydantic import BaseModel, Field


class TimeWindow(BaseModel):
    """Time window for event search."""

    start: datetime | None = Field(default=None, description="Start of time window")
    end: datetime | None = Field(default=None, description="End of time window")


class SearchProfile(BaseModel):
    """User preferences and constraints for event search."""

    time_window: TimeWindow | None = Field(
        default=None, description="When the user is looking for events"
    )
    categories: list[str] = Field(
        default_factory=list, description="Event categories of interest (ai, meetup, startup, community)"
    )
    max_distance_miles: float | None = Field(
        default=None, description="Maximum distance in miles from user"
    )
    free_only: bool = Field(default=False, description="Only show free events")
    keywords: list[str] = Field(
        default_factory=list, description="Keywords or topics of interest"
    )
