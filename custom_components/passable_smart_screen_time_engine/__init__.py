"""Passable Smart Screen Time Engine integration."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
import voluptuous as vol

from .const import CONF_DEVICES, CONF_GLOBAL_RESTRICTIONS, DOMAIN, FRONTEND_URL_PATH
from .engine import PassableScreenTimeEngine
from .storage import PassableScreenTimeStorage, get_default_device_data
from .websocket import async_register_websocket_commands

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [
    Platform.SWITCH,
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
]


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Register static frontend paths and Lovelace card resource."""
    if hass.data.setdefault(DOMAIN, {}).get("frontend_registered"):
        return

    card_path = (
        Path(__file__).parent / "frontend" / "passable-screen-time-card.js"
    )
    if not card_path.is_file():
        _LOGGER.warning(
            "Passable Screen Time Card file not found at %s", card_path
        )
        return

    try:
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(FRONTEND_URL_PATH, str(card_path), cache_headers=False)]
        )
        hass.data[DOMAIN]["frontend_registered"] = True
        _LOGGER.info(
            "Passable Screen Time Card registered at %s", FRONTEND_URL_PATH
        )
    except Exception as err:
        try:
            hass.http.register_static_path(
                FRONTEND_URL_PATH, str(card_path), cache_headers=False
            )
            hass.data[DOMAIN]["frontend_registered"] = True
            _LOGGER.info(
                "Passable Screen Time Card registered at %s (legacy)",
                FRONTEND_URL_PATH,
            )
        except Exception as legacy_err:
            _LOGGER.error("Failed to register static path: %s", legacy_err)

    # Automatically register the Lovelace card resource if available
    hass.async_create_task(_async_register_lovelace_resource(hass))


async def _async_register_lovelace_resource(hass: HomeAssistant) -> None:
    """Register the card as a Lovelace resource so users don't have to add it manually."""
    try:
        lovelace = hass.data.get("lovelace")
        if not lovelace:
            return

        resources = getattr(lovelace, "resources", None)
        if not resources:
            return

        if not resources.loaded:
            await resources.async_load()

        url_path = f"{FRONTEND_URL_PATH}?v=1.0.0"
        for resource in resources.async_items():
            if resource.get("url", "").startswith(FRONTEND_URL_PATH):
                return

        await resources.async_create_item(
            {"res_type": "module", "url": url_path}
        )
        _LOGGER.info(
            "Automatically registered Lovelace resource: %s", url_path
        )
    except Exception as err:
        _LOGGER.debug(
            "Could not automatically register Lovelace resource: %s", err
        )


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up the Passable Smart Screen Time Engine component."""
    await _async_register_frontend(hass)
    async_register_websocket_commands(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Passable Smart Screen Time Engine from a config entry."""
    storage = PassableScreenTimeStorage(hass)
    engine = PassableScreenTimeEngine(hass, storage, entry.entry_id)

    await engine.async_setup()

    # Populate any explicitly selected devices from options/config flow
    selected_devices = (
        entry.options.get(CONF_DEVICES)
        if CONF_DEVICES in entry.options
        else entry.data.get(CONF_DEVICES, [])
    )
    for entity_id in selected_devices:
        dev_id = entity_id.split(".", 1)[-1]
        if dev_id not in storage.get_all_devices():
            state_obj = hass.states.get(entity_id)
            name = (
                state_obj.attributes.get("friendly_name")
                if state_obj
                else dev_id.replace("_", " ").title()
            )
            payload = get_default_device_data(dev_id, entity_id, name=name)
            await storage.async_update_device(dev_id, payload)

    # Populate any global restrictions
    restrictions_list = (
        entry.options.get(CONF_GLOBAL_RESTRICTIONS)
        if CONF_GLOBAL_RESTRICTIONS in entry.options
        else entry.data.get(CONF_GLOBAL_RESTRICTIONS, [])
    )
    restrictions = [{"entity": e} for e in restrictions_list]
    if restrictions:
        await storage.async_update_global_restrictions(restrictions)

    # Automatically import legacy helpers ONLY once on initial setup if selected
    if entry.data.get("import_helpers", False) and not storage.data.get("legacy_imported"):
        try:
            await engine.storage.async_import_legacy_helpers()
            storage.data["legacy_imported"] = True
            await storage.async_save()
        except Exception as err:
            _LOGGER.warning("Could not auto-import legacy helpers: %s", err)

    # Clean up any orphaned entities from entity registry that no longer correspond to managed devices
    active_device_ids = set(storage.get_all_devices().keys())
    try:
        from homeassistant.helpers import entity_registry as er
        ent_reg = er.async_get(hass)
        orphans = [
            entity_id
            for entity_id, reg_entry in ent_reg.entities.items()
            if reg_entry.config_entry_id == entry.entry_id
            and reg_entry.unique_id not in (
                f"{DOMAIN}_master_lockout",
                f"{DOMAIN}_active_device_lockouts",
            )
            and not any(
                reg_entry.unique_id.endswith(f"_{did}")
                for did in active_device_ids
            )
        ]
        for oid in orphans:
            _LOGGER.info("Cleaning up orphan entity from registry: %s", oid)
            ent_reg.async_remove(oid)
    except Exception as err:
        _LOGGER.warning("Could not clean up orphan entities: %s", err)

    engine.async_rebuild_device_listeners()
    await engine.async_evaluate_schedules()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = engine

    # Register services
    _async_register_services(hass, engine)

    # Forward setup to platforms (switch, sensor, binary_sensor)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    return True


def _async_register_services(
    hass: HomeAssistant, engine: PassableScreenTimeEngine
) -> None:
    """Register integration service actions."""

    async def handle_start_timer(call: ServiceCall) -> None:
        device_id = call.data["device_id"]
        duration = call.data["duration"]
        unit = call.data.get("unit", "minutes")
        await engine.async_start_device_timer(device_id, duration, unit)

    async def handle_cancel_timer(call: ServiceCall) -> None:
        device_id = call.data["device_id"]
        engine.async_cancel_device_timer(device_id)

    async def handle_set_lockout(call: ServiceCall) -> None:
        device_id = call.data.get("device_id", "all")
        locked = call.data["locked"]
        power_on = call.data.get("power_on", False)
        if device_id in ("all", "*", "", None):
            await engine.async_set_all_lockouts(locked, power_on)
        else:
            await engine.async_set_device_lockout(device_id, locked, power_on)

    async def handle_toggle_all_lockouts(call: ServiceCall) -> None:
        await engine.async_toggle_all_lockouts()

    async def handle_import_legacy_helpers(call: ServiceCall) -> None:
        count = await engine.storage.async_import_legacy_helpers()
        engine.async_rebuild_device_listeners()
        await engine.async_evaluate_schedules()
        _LOGGER.info(
            "Legacy helpers import service finished: %s devices imported", count
        )

    hass.services.async_register(
        DOMAIN,
        "start_timer",
        handle_start_timer,
        schema=vol.Schema(
            {
                vol.Required("device_id"): cv.string,
                vol.Required("duration"): vol.Coerce(float),
                vol.Optional("unit", default="minutes"): cv.string,
            }
        ),
    )

    hass.services.async_register(
        DOMAIN,
        "cancel_timer",
        handle_cancel_timer,
        schema=vol.Schema({vol.Required("device_id"): cv.string}),
    )

    hass.services.async_register(
        DOMAIN,
        "set_lockout",
        handle_set_lockout,
        schema=vol.Schema(
            {
                vol.Optional("device_id", default="all"): cv.string,
                vol.Required("locked"): cv.boolean,
                vol.Optional("power_on", default=False): cv.boolean,
            }
        ),
    )

    async def handle_delete_device(call: ServiceCall) -> None:
        device_id = call.data["device_id"]
        await engine.async_remove_device_and_cleanup(device_id)

    hass.services.async_register(
        DOMAIN,
        "toggle_all_lockouts",
        handle_toggle_all_lockouts,
    )

    hass.services.async_register(
        DOMAIN, "import_legacy_helpers", handle_import_legacy_helpers
    )

    hass.services.async_register(
        DOMAIN,
        "delete_device",
        handle_delete_device,
        schema=vol.Schema({vol.Required("device_id"): cv.string}),
    )


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    engine: PassableScreenTimeEngine = hass.data[DOMAIN].get(entry.entry_id)
    if engine:
        await engine.async_unload()

    unload_ok = await hass.config_entries.async_unload_platforms(
        entry, PLATFORMS
    )
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)

    return unload_ok


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload config entry."""
    await async_unload_entry(hass, entry)
    await async_setup_entry(hass, entry)
