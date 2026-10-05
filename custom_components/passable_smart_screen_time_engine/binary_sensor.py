"""Binary sensor platform for Passable Smart Screen Time Engine."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, SIGNAL_DEVICE_UPDATED, SIGNAL_STORAGE_UPDATED
from .engine import PassableScreenTimeEngine

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Passable Screen Time binary sensors."""
    engine: PassableScreenTimeEngine = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([PassableScreenTimeActiveLockoutsBinarySensor(engine, entry)])


class PassableScreenTimeActiveLockoutsBinarySensor(BinarySensorEntity):
    """Aggregate binary sensor indicating if any managed device is currently locked out."""

    _attr_has_entity_name = False
    _attr_name = "Active Device Lockouts"

    def __init__(
        self, engine: PassableScreenTimeEngine, entry: ConfigEntry
    ) -> None:
        """Initialize the active lockouts binary sensor."""
        self._engine = engine
        self._entry = entry
        self._attr_unique_id = f"{DOMAIN}_active_device_lockouts"
        self.entity_id = "binary_sensor.passable_screen_time_active_lockouts"

    @property
    def device_info(self) -> DeviceInfo:
        """Return hub device info."""
        return DeviceInfo(
            identifiers={(DOMAIN, "hub")},
            name="Passable Smart Screen Time Engine",
            manufacturer="Passable",
            model="Screen Time & Lockout Hub",
            sw_version="1.1.0",
        )

    @property
    def is_on(self) -> bool:
        """Return True if any device is locked or external restrictions are active."""
        devices = self._engine.storage.get_all_devices()
        any_locked = any(d.get("locked", False) for d in devices.values())
        return any_locked or bool(self._engine._active_restrictions)

    @property
    def icon(self) -> str:
        """Dynamic icon indicating lockout status."""
        return "mdi:television-off" if self.is_on else "mdi:television"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return rich diagnostic details about locked devices."""
        devices = self._engine.storage.get_all_devices()
        locked_devices = [
            d.get("target_entity")
            for d in devices.values()
            if d.get("locked", False) and d.get("target_entity")
        ]
        locked_names = [
            d.get("name", d.get("id"))
            for d in devices.values()
            if d.get("locked", False)
        ]
        total = len(devices)
        return {
            "locked_count": len(locked_devices),
            "total_devices": total,
            "locked_devices": locked_devices,
            "locked_device_names": locked_names,
            "all_locked": len(locked_devices) == total if total > 0 else False,
            "active_restrictions": list(self._engine._active_restrictions),
        }

    async def async_added_to_hass(self) -> None:
        """Register dispatcher signals to update state."""
        @callback
        def _handle_update(*args: Any) -> None:
            self.async_write_ha_state()

        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_DEVICE_UPDATED, _handle_update
            )
        )
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_STORAGE_UPDATED, _handle_update
            )
        )
