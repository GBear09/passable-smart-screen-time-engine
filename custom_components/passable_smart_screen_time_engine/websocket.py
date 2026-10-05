"""WebSocket API handlers for Passable Smart Screen Time Engine."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
import voluptuous as vol

from .const import DOMAIN, SIGNAL_ENGINE_UPDATED

_LOGGER = logging.getLogger(__name__)


@callback
def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register WebSocket commands for frontend card interaction."""
    websocket_api.async_register_command(hass, ws_get_data)
    websocket_api.async_register_command(hass, ws_save_device)
    websocket_api.async_register_command(hass, ws_start_timer)
    websocket_api.async_register_command(hass, ws_cancel_timer)
    websocket_api.async_register_command(hass, ws_set_lockout)
    websocket_api.async_register_command(hass, ws_import_legacy_helpers)


def _get_engine(hass: HomeAssistant) -> Any:
    """Retrieve active engine instance from hass.data."""
    entries = hass.data.get(DOMAIN, {})
    for k, v in entries.items():
        if k != "frontend_registered":
            return v
    return None


@websocket_api.websocket_command(
    {
        vol.Required("type"): "passable_smart_screen_time_engine/get_data",
    }
)
@websocket_api.async_response
async def ws_get_data(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return all devices, schedules, timers, and telemetry."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    data = {
        "devices": engine.storage.get_all_devices(),
        "global_restrictions": engine.storage.get_global_restrictions(),
    }
    connection.send_result(msg["id"], data)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "passable_smart_screen_time_engine/save_device",
        vol.Required("device_id"): str,
        vol.Optional("name"): str,
        vol.Optional("schedule_enabled"): bool,
        vol.Optional("schedule_days"): [str],
        vol.Optional("schedule_start"): str,
        vol.Optional("schedule_end"): str,
        vol.Optional("schedule_recurrence"): str,
        vol.Optional("schedule_anchor_date"): vol.Any(str, None),
        vol.Optional("daily_limit_minutes"): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def ws_save_device(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save updated device configuration and schedule."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    device_id = msg["device_id"]
    updates = {}
    for key in [
        "name",
        "schedule_enabled",
        "schedule_days",
        "schedule_start",
        "schedule_end",
        "schedule_recurrence",
        "schedule_anchor_date",
        "daily_limit_minutes",
    ]:
        if key in msg:
            updates[key] = msg[key]

    await engine.storage.async_update_device(device_id, updates)
    await engine.async_evaluate_schedules()
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "passable_smart_screen_time_engine/start_timer",
        vol.Required("device_id"): str,
        vol.Required("duration"): vol.Coerce(float),
        vol.Optional("unit", default="minutes"): str,
    }
)
@websocket_api.async_response
async def ws_start_timer(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Start temporary viewing timer and unlock device."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    device_id = msg["device_id"]
    duration = msg["duration"]
    unit = msg.get("unit", "minutes")

    await engine.async_start_device_timer(device_id, duration, unit)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "passable_smart_screen_time_engine/cancel_timer",
        vol.Required("device_id"): str,
    }
)
@websocket_api.async_response
async def ws_cancel_timer(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Cancel temporary viewing countdown timer."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    device_id = msg["device_id"]
    engine.async_cancel_device_timer(device_id)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "passable_smart_screen_time_engine/set_lockout",
        vol.Required("device_id"): str,
        vol.Required("locked"): bool,
        vol.Optional("power_on", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_set_lockout(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Explicitly lock or unlock a device."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    device_id = msg["device_id"]
    locked = msg["locked"]
    power_on = msg.get("power_on", False)

    await engine.async_set_device_lockout(device_id, locked=locked, power_on=power_on)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "passable_smart_screen_time_engine/import_legacy_helpers",
    }
)
@websocket_api.async_response
async def ws_import_legacy_helpers(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Run automated 1-click import of legacy helpers into .storage."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    count = await engine.storage.async_import_legacy_helpers()
    engine.async_rebuild_device_listeners()
    await engine.async_evaluate_schedules()
    connection.send_result(msg["id"], {"success": True, "imported_count": count})
