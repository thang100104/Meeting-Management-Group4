"""Existing meeting columns store Vietnam wall time without an offset.
Normalize offset-aware API input to that convention before database comparisons.
"""
from datetime import datetime, timedelta, timezone

VIETNAM_TZ = timezone(timedelta(hours=7))


def local_meeting_time(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(VIETNAM_TZ).replace(tzinfo=None)
    return value


def meeting_now() -> datetime:
    return datetime.now(VIETNAM_TZ).replace(tzinfo=None)
