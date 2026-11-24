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

from .const import (
    CONF_DEVICES,
    CONF_GLOBAL_RESTRICTIONS,
    DOMAIN,
    FRONTEND_URL_PATH,
    SIGNAL_DEVICE_ADDED,
    SIGNAL_ENGINE_UPDATED,
    TIMER_MODE_UNLOCK,
    VALID_TIMER_MODES,
    VERSION,
)
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
    if not await hass.async_add_executor_job(card_path.is_file):
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

        url_path = f"{FRONTEND_URL_PATH}?v={VERSION}"
        for resource in resources.async_items():
            existing_url = resource.get("url", "")
            if existing_url == url_path:
                return
            if existing_url.startswith(FRONTEND_URL_PATH):
                res_id = resource.get("id")
                if res_id:
                    await resources.async_update_item(
                        res_id, {"res_type": "module", "url": url_path}
                    )
                    _LOGGER.info(
                        "Updated Lovelace resource URL to %s", url_path
                    )
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

    # Populate selected devices: seed from entry.data only once; thereafter sync additions from entry.options
    initial_seeded = bool(storage.data.get("initial_seed_complete", False))
    if CONF_DEVICES in entry.options:
        selected_devices = entry.options.get(CONF_DEVICES, [])
    elif not initial_seeded:
        selected_devices = entry.data.get(CONF_DEVICES, [])
    else:
        selected_devices = []

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

    if not initial_seeded:
        storage.data["initial_seed_complete"] = True
        await storage.async_save()

    # Populate global restrictions while preserving custom name/icon metadata
    if CONF_GLOBAL_RESTRICTIONS in entry.options or (
        not initial_seeded and CONF_GLOBAL_RESTRICTIONS in entry.data
    ):
        restrictions_list = (
            entry.options.get(CONF_GLOBAL_RESTRICTIONS)
            if CONF_GLOBAL_RESTRICTIONS in entry.options
            else entry.data.get(CONF_GLOBAL_RESTRICTIONS, [])
        )
        existing_meta = {
            r.get("entity"): r
            for r in storage.get_global_restrictions()
            if r.get("entity")
        }
        restrictions = []
        for ent in restrictions_list:
            meta = existing_meta.get(ent, {})
            item: dict[str, Any] = {"entity": ent}
            if meta.get("name"):
                item["name"] = meta["name"]
            if meta.get("icon"):
                item["icon"] = meta["icon"]
            restrictions.append(item)
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
        duration = call.data.get("duration", 20)
        unit = call.data.get("unit", "minutes")
        mode = call.data.get("mode", TIMER_MODE_UNLOCK)
        until_time = call.data.get("until_time")
        power_on = call.data.get("power_on", False)
        await engine.async_start_device_timer(
            device_id,
            duration=duration,
            unit=unit,
            mode=mode,
            until_time=until_time,
            power_on=power_on,
        )

    async def handle_cancel_timer(call: ServiceCall) -> None:
        device_id = call.data["device_id"]
        engine.async_cancel_device_timer(device_id)

    async def handle_set_lockout(call: ServiceCall) -> None:
        device_id = call.data.get("device_id", "all")
        locked = call.data["locked"]
        power_on = call.data.get("power_on", False)
        rest_of_day = call.data.get("rest_of_day", False)
        if device_id in ("all", "*", "", None):
            await engine.async_set_all_lockouts(
                locked, power_on=power_on, rest_of_day=rest_of_day
            )
        else:
            await engine.async_set_device_lockout(
                device_id, locked, power_on=power_on, rest_of_day=rest_of_day
            )

    async def handle_adjust_bonus_time(call: ServiceCall) -> None:
        device_id = call.data.get("device_id", "all")
        delta_minutes = call.data.get("delta_minutes", 15)
        reset = call.data.get("reset", False)
        await engine.async_adjust_bonus_time(
            device_id, delta_minutes=delta_minutes, reset=reset
        )

    async def handle_toggle_all_lockouts(call: ServiceCall) -> None:
        await engine.async_toggle_all_lockouts()

    async def handle_import_legacy_helpers(call: ServiceCall) -> None:
        count = await engine.storage.async_import_legacy_helpers()
        engine.async_rebuild_device_listeners()
        await engine.async_evaluate_schedules()
        for did in engine.storage.get_all_devices():
            from homeassistant.helpers.dispatcher import async_dispatcher_send
            async_dispatcher_send(hass, SIGNAL_DEVICE_ADDED, did)
        from homeassistant.helpers.dispatcher import async_dispatcher_send
        async_dispatcher_send(hass, SIGNAL_ENGINE_UPDATED)
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
                vol.Optional("duration", default=20): vol.Coerce(float),
                vol.Optional("unit", default="minutes"): cv.string,
                vol.Optional("mode", default=TIMER_MODE_UNLOCK): vol.In(VALID_TIMER_MODES),
                vol.Optional("until_time"): vol.Any(cv.string, None),
                vol.Optional("power_on", default=False): cv.boolean,
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
                vol.Optional("rest_of_day", default=False): cv.boolean,
            }
        ),
    )

    hass.services.async_register(
        DOMAIN,
        "adjust_bonus_time",
        handle_adjust_bonus_time,
        schema=vol.Schema(
            {
                vol.Optional("device_id", default="all"): cv.string,
                vol.Optional("delta_minutes", default=15): vol.Coerce(int),
                vol.Optional("reset", default=False): cv.boolean,
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

    async def handle_reconcile_screen_time(call: ServiceCall) -> None:
        device_id = call.data.get("device_id")
        if device_id and device_id not in ("all", "*", ""):
            await engine.async_reconcile_device_screen_time(device_id)
        else:
            await engine.async_reconcile_all_screen_time()

    hass.services.async_register(
        DOMAIN,
        "reconcile_screen_time",
        handle_reconcile_screen_time,
        schema=vol.Schema({vol.Optional("device_id", default="all"): cv.string}),
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
    """Reload config entry unless triggered by internal storage-to-options sync."""
    engine = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if engine and getattr(engine, "_syncing_options", False):
        return
    await hass.config_entries.async_reload(entry.entry_id)
