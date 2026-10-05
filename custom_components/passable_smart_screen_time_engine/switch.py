"""Switch platform for Passable Smart Screen Time Engine."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, SIGNAL_DEVICE_UPDATED, SIGNAL_ENGINE_UPDATED
from .engine import PassableScreenTimeEngine

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up screen time switches from a config entry."""
    engine: PassableScreenTimeEngine = hass.data[DOMAIN][entry.entry_id]
    devices = engine.storage.get_all_devices()

    entities: list[SwitchEntity] = [PassableMasterLockoutSwitch(engine)]
    for dev_id, dev_data in devices.items():
        entities.append(PassableLockoutSwitch(engine, dev_id))
        entities.append(PassableScheduleSwitch(engine, dev_id))

    async_add_entities(entities)


class PassableLockoutSwitch(SwitchEntity):
    """Switch representing whether a device is currently locked out."""

    _attr_has_entity_name = True

    def __init__(self, engine: PassableScreenTimeEngine, device_id: str) -> None:
        """Initialize lockout switch."""
        self.engine = engine
        self.device_id = device_id
        self._attr_unique_id = f"passable_screen_time_lockout_{device_id}"
        dev = engine.storage.get_device(device_id)
        self._attr_name = f"{dev.get('name', device_id)} Lockout"

    @property
    def is_on(self) -> bool:
        """Return true if device is restricted / locked."""
        dev = self.engine.storage.get_device(self.device_id)
        return dev.get("locked", False)

    @property
    def icon(self) -> str:
        """Return lock icon according to state."""
        return "mdi:lock" if self.is_on else "mdi:lock-open-variant"

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Lock the device."""
        await self.engine.async_set_device_lockout(self.device_id, locked=True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Unlock the device."""
        await self.engine.async_set_device_lockout(self.device_id, locked=False)

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


class PassableScheduleSwitch(SwitchEntity):
    """Switch controlling whether the automated schedule engine is enabled for a device."""

    _attr_has_entity_name = True

    def __init__(self, engine: PassableScreenTimeEngine, device_id: str) -> None:
        """Initialize schedule enable switch."""
        self.engine = engine
        self.device_id = device_id
        self._attr_unique_id = f"passable_screen_time_schedule_{device_id}"
        dev = engine.storage.get_device(device_id)
        self._attr_name = f"{dev.get('name', device_id)} Schedule Engine"
        self._attr_icon = "mdi:calendar-clock"

    @property
    def is_on(self) -> bool:
        """Return true if schedule engine is enabled."""
        dev = self.engine.storage.get_device(self.device_id)
        return dev.get("schedule_enabled", True)

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Enable schedule engine."""
        await self.engine.storage.async_update_device(
            self.device_id, {"schedule_enabled": True}
        )
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Disable schedule engine."""
        await self.engine.storage.async_update_device(
            self.device_id, {"schedule_enabled": False}
        )
        self.async_write_ha_state()

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


class PassableMasterLockoutSwitch(SwitchEntity):
    """Master switch to lock or unlock all managed screen time devices at once."""

    _attr_has_entity_name = False
    _attr_name = "Master Device Lockout"

    def __init__(self, engine: PassableScreenTimeEngine) -> None:
        """Initialize master lockout switch."""
        self.engine = engine
        self._attr_unique_id = f"{DOMAIN}_master_lockout"
        self.entity_id = "switch.passable_master_device_lockout"

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
        """Return True if any managed device is locked."""
        devices = self.engine.storage.get_all_devices()
        return any(d.get("locked", False) for d in devices.values()) or bool(
            self.engine._active_restrictions
        )

    @property
    def icon(self) -> str:
        """Dynamic icon for master lockout switch."""
        return "mdi:television-off" if self.is_on else "mdi:television"

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Lock all managed devices."""
        await self.engine.async_set_all_lockouts(locked=True, power_on=False)

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Unlock all managed devices."""
        await self.engine.async_set_all_lockouts(locked=False, power_on=False)

    async def async_toggle(self, **kwargs: Any) -> None:
        """Toggle all managed devices."""
        await self.engine.async_toggle_all_lockouts()

    async def async_added_to_hass(self) -> None:
        """Subscribe to dispatcher signals."""

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
                self.hass, SIGNAL_ENGINE_UPDATED, _handle_update
            )
        )

