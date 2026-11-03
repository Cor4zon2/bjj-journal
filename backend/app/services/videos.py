"""Recognise YouTube and Instagram links and build YouTube embed URLs."""

import re
from urllib.parse import parse_qs, urlparse

from app.models.enums import VideoSource

_YOUTUBE_HOSTS = {"youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"}
_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_INSTAGRAM_HOSTS = {"instagram.com", "instagr.am"}


def _host(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    return host.removeprefix("www.")


def detect_source(url: str) -> VideoSource:
    host = _host(url)
    if host in _YOUTUBE_HOSTS or host == "youtu.be":
        return "youtube"
    if host in _INSTAGRAM_HOSTS:
        return "instagram"
    return "other"


def youtube_id(url: str) -> str | None:
    """Video id from watch, short (youtu.be), shorts, live and embed URLs."""
    parsed = urlparse(url)
    host = _host(url)
    candidate: str | None = None
    if host == "youtu.be":
        candidate = parsed.path.lstrip("/").split("/")[0]
    elif host in _YOUTUBE_HOSTS:
        parts = [p for p in parsed.path.split("/") if p]
        if parts[:1] == ["watch"]:
            candidate = parse_qs(parsed.query).get("v", [None])[0]
        elif len(parts) >= 2 and parts[0] in {"shorts", "embed", "live", "v"}:
            candidate = parts[1]
    if candidate and _YOUTUBE_ID.match(candidate):
        return candidate
    return None


def youtube_start_seconds(url: str) -> int:
    """`t=` / `start=` from a YouTube URL: `90`, `90s` or `1m30s`."""
    query = parse_qs(urlparse(url).query)
    raw = (query.get("t") or query.get("start") or ["0"])[0]
    if raw.isdigit():
        return int(raw)
    match = re.fullmatch(r"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?", raw)
    if not match:
        return 0
    hours, minutes, seconds = (int(g) if g else 0 for g in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def youtube_embed_url(url: str, start_seconds: int = 0) -> str | None:
    video_id = youtube_id(url)
    if video_id is None:
        return None
    embed = f"https://www.youtube-nocookie.com/embed/{video_id}"
    return f"{embed}?start={start_seconds}" if start_seconds > 0 else embed
