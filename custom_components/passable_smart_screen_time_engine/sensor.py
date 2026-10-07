"""Sensor platform for Passable Smart Screen Time Engine."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
import homeassistant.util.dt as dt_util

from .const import DOMAIN, SIGNAL_DEVICE_UPDATED, SIGNAL_ENGINE_UPDATED
from .engine import PassableScreenTimeEngine

_LOGGER = logging.getLogger(__name__)


def _format_minutes(total_mins: int) -> str:
    """Format minutes into human-readable duration (e.g., '1h 25m' or '45m')."""
    if total_mins <= 0:
        return "0m"
    hours = total_mins // 60
    mins = total_mins % 60
    if hours > 0:
        return f"{hours}h {mins}m"
    return f"{mins}m"


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up screen time sensors from a config entry."""
    engine: PassableScreenTimeEngine = hass.data[DOMAIN][entry.entry_id]
    devices = engine.storage.get_all_devices()

    entities: list[SensorEntity] = []
    for dev_id, dev_data in devices.items():
        entities.append(PassableScreenTimeUsageSensor(engine, dev_id))
        entities.append(PassableScreenTimeAppSensor(engine, dev_id))

    async_add_entities(entities)


class PassableScreenTimeUsageSensor(SensorEntity):
    """Sensor reporting today's cumulative screen time minutes and countdown timer metadata."""

    _attr_has_entity_name = False
    _attr_device_class = SensorDeviceClass.DURATION
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "min"
    _attr_icon = "mdi:timer-outline"

    def __init__(self, engine: PassableScreenTimeEngine, device_id: str) -> None:
        """Initialize usage sensor."""
        self.engine = engine
        self.device_id = device_id
        self._attr_unique_id = f"passable_screen_time_usage_{device_id}"
        dev = engine.storage.get_device(device_id)
        self._attr_name = f"{dev.get('name', device_id)} Screen Time Today"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "hub")},
            name="Passable Smart Screen Time Engine",
            manufacturer="Passable",
            model="Screen Time & Lockout Hub",
            sw_version="1.4.1",
        )

    @property
    def native_value(self) -> int:
        """Return total minutes watched today, or 0 if tracking is disabled."""
        dev = self.engine.storage.get_device(self.device_id)
        if not dev.get("track_screen_time", True):
            return 0
        return int(dev.get("screen_time_today_minutes", 0))

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return extra metadata including formatted duration and timer countdown."""
        dev = self.engine.storage.get_device(self.device_id)
        track_st = dev.get("track_screen_time", True)
        daily_limit_en = dev.get("daily_limit_enabled", True)
        mins = int(dev.get("screen_time_today_minutes", 0)) if track_st else 0
        limit = dev.get("daily_limit_minutes", 120) if daily_limit_en else None
        pct = (
            round((mins / limit) * 100, 1)
            if (daily_limit_en and limit and limit > 0)
            else None
        )

        expires_str = dev.get("timer_expires_at")
        timer_active = False
        remaining_secs = 0
        if expires_str:
            try:
                expires_dt = dt_util.parse_datetime(expires_str)
                if expires_dt:
                    now = dt_util.utcnow()
                    diff = (expires_dt - now).total_seconds()
                    if diff > 0:
                        timer_active = True
                        remaining_secs = int(diff)
            except Exception:
                pass

        return {
            "formatted_screen_time": _format_minutes(mins) if track_st else "Disabled",
            "track_screen_time": track_st,
            "daily_limit_enabled": daily_limit_en,
            "daily_limit_minutes": limit,
            "percent_of_limit": pct,
            "timer_active": timer_active,
            "timer_expires_at": expires_str,
            "timer_remaining_seconds": remaining_secs,
            "active_app": dev.get("active_app", "None"),
            "apps_used_today": dev.get("apps_used_today", []),
            "target_entity": dev.get("target_entity"),
            "device_type": dev.get("device_type"),
        }

    async def async_added_to_hass(self) -> None:
        """Subscribe to dispatcher signals."""

        @callback
        def _handle_update(dev_id: str = "") -> None:
            if not dev_id or dev_id == self.device_id:
                self.async_write_ha_state()

        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_DEVICE_UPDATED, _handle_update
            )
        )
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_ENGINE_UPDATED, _handle_update
            )
        )


class PassableScreenTimeAppSensor(SensorEntity):
    """Sensor reporting the currently active streaming app or source."""

    _attr_has_entity_name = False
    _attr_icon = "mdi:television-play"

    def __init__(self, engine: PassableScreenTimeEngine, device_id: str) -> None:
        """Initialize app sensor."""
        self.engine = engine
        self.device_id = device_id
        self._attr_unique_id = f"passable_screen_time_app_{device_id}"
        dev = engine.storage.get_device(device_id)
        self._attr_name = f"{dev.get('name', device_id)} Active App"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "hub")},
            name="Passable Smart Screen Time Engine",
            manufacturer="Passable",
            model="Screen Time & Lockout Hub",
            sw_version="1.4.1",
        )

    @property
    def native_value(self) -> str:
        """Return currently active app or 'None'."""
        dev = self.engine.storage.get_device(self.device_id)
        return dev.get("active_app", "None")

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return recent apps used today."""
        dev = self.engine.storage.get_device(self.device_id)
        return {
            "apps_used_today": dev.get("apps_used_today", []),
            "target_entity": dev.get("target_entity"),
        }

    async def async_added_to_hass(self) -> None:
        """Subscribe to dispatcher signals."""

        @callback
        def _handle_update(dev_id: str = "") -> None:
            if not dev_id or dev_id == self.device_id:
                self.async_write_ha_state()

        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_DEVICE_UPDATED, _handle_update
            )
        )
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_ENGINE_UPDATED, _handle_update
            )
        )
