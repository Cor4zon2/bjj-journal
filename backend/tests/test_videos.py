import pytest

from app.services.videos import (
    detect_source,
    youtube_embed_url,
    youtube_id,
    youtube_start_seconds,
)


@pytest.mark.parametrize(
    ("url", "source"),
    [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"),
        ("https://youtu.be/dQw4w9WgXcQ", "youtube"),
        ("https://m.youtube.com/shorts/dQw4w9WgXcQ", "youtube"),
        ("https://www.instagram.com/reel/C1a2b3c4d5e/", "instagram"),
        ("https://instagram.com/reel/C1a2b3c4d5e", "instagram"),
        ("https://vimeo.com/123", "other"),
    ],
)
def test_detect_source(url: str, source: str) -> None:
    assert detect_source(url) == source


@pytest.mark.parametrize(
    "url",
    [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30",
        "https://youtu.be/dQw4w9WgXcQ?si=abc",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "https://www.youtube.com/live/dQw4w9WgXcQ",
    ],
)
def test_youtube_id(url: str) -> None:
    assert youtube_id(url) == "dQw4w9WgXcQ"


def test_youtube_id_rejects_non_videos() -> None:
    assert youtube_id("https://www.youtube.com/@somechannel") is None
    assert youtube_id("https://www.instagram.com/reel/abc/") is None


@pytest.mark.parametrize(
    ("url", "seconds"),
    [
        ("https://youtu.be/dQw4w9WgXcQ", 0),
        ("https://youtu.be/dQw4w9WgXcQ?t=90", 90),
        ("https://youtu.be/dQw4w9WgXcQ?t=90s", 90),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s", 90),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s", 3723),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=nonsense", 0),
    ],
)
def test_youtube_start_seconds(url: str, seconds: int) -> None:
    assert youtube_start_seconds(url) == seconds


def test_youtube_embed_url() -> None:
    assert (
        youtube_embed_url("https://youtu.be/dQw4w9WgXcQ")
        == "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    )
    assert (
        youtube_embed_url("https://youtu.be/dQw4w9WgXcQ", 42)
        == "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42"
    )
    assert youtube_embed_url("https://vimeo.com/1") is None
