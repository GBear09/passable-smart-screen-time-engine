"""Constants for Passable Smart Screen Time Engine."""

from __future__ import annotations

DOMAIN = "passable_smart_screen_time_engine"
STORAGE_KEY = "passable_smart_screen_time_engine"
STORAGE_VERSION = 1

CONF_DEVICES = "devices"
CONF_GLOBAL_RESTRICTIONS = "global_restrictions"
CONF_DEFAULT_DAILY_LIMIT = "default_daily_limit"

DEFAULT_DAILY_LIMIT = 120  # minutes (2 hours)
DEFAULT_TIMER_DURATION = 20  # minutes ("One More Show")

RECURRENCE_WEEKLY = "weekly"
RECURRENCE_BIWEEKLY = "biweekly"

DAYS_OF_WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
DAYS_OF_WEEK_FULL = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
]

DEVICE_TYPE_MEDIA_PLAYER = "media_player"
DEVICE_TYPE_NETWORK_SWITCH = "network_switch"

SIGNAL_DEVICE_UPDATED = "passable_screen_time_device_updated"
SIGNAL_ENGINE_UPDATED = "passable_screen_time_engine_updated"
SIGNAL_STORAGE_UPDATED = "passable_screen_time_storage_updated"

FRONTEND_URL_PATH = "/passable_screen_time_frontend/passable-screen-time-card.js"

# Known streaming application packages & source names
APP_MAPPINGS: dict[str, str] = {
    "com.netflix.ninja": "Netflix",
    "netflix": "Netflix",
    "com.disney.disneyplus": "Disney+",
    "disney": "Disney+",
    "disney+": "Disney+",
    "com.google.android.youtube.tv": "YouTube",
    "youtube": "YouTube",
    "com.google.android.apps.youtube.kids": "YouTube Kids",
    "youtube kids": "YouTube Kids",
    "com.amazon.amazonvideo.livingroom": "Prime Video",
    "prime video": "Prime Video",
    "amazon video": "Prime Video",
    "com.plexapp.android": "Plex",
    "plex": "Plex",
    "com.apple.atve.androidtv.appletv": "Apple TV",
    "apple tv": "Apple TV",
    "com.pbs.video": "PBS KIDS",
    "pbs kids": "PBS KIDS",
    "pbs": "PBS KIDS",
    "com.hulu.livingroomplus": "Hulu",
    "hulu": "Hulu",
    "com.max.android": "Max",
    "max": "Max",
    "hbo": "Max",
    "com.spotify.tv.android": "Spotify",
    "spotify": "Spotify",
    "com.paramountplus.firetv": "Paramount+",
    "paramount+": "Paramount+",
    "com.peacocktv.peacockandroid": "Peacock",
    "peacock": "Peacock",
}

# Android TV / TV system background launcher packages to exclude from streaming telemetry
IGNORED_APPS: set[str] = {
    "com.google.android.apps.tv.launcherx",
    "com.tcl.tv",
    "system",
    "android",
    "home",
    "launcher",
    "com.google.android.tvlauncher",
    "com.android.tv.settings",
}
