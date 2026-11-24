"""WebSocket API handlers for Passable Smart Screen Time Engine."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.event import async_track_state_change_event
import homeassistant.util.dt as dt_util
import voluptuous as vol

from .const import (
    DAYS_OF_WEEK,
    DEVICE_CATEGORIES,
    DEVICE_TYPE_MEDIA_PLAYER,
    DOMAIN,
    RECURRENCE_BIWEEKLY,
    SIGNAL_DEVICE_ADDED,
    SIGNAL_DEVICE_UPDATED,
    SIGNAL_ENGINE_UPDATED,
    SIGNAL_STORAGE_UPDATED,
    TIMER_MODE_UNLOCK,
    VALID_TIMER_MODES,
    VERSION,
)
from .engine import (
    PassableScreenTimeEngine,
    compute_effective_daily_limit,
    compute_next_schedule_transition,
    get_active_schedule_rule,
)
from .storage import normalize_schedule_rule

_LOGGER = logging.getLogger(__name__)


@callback
def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register WebSocket commands for frontend card interaction."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get("websocket_registered"):
        return

    websocket_api.async_register_command(hass, ws_get_data)
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_add_device)
    websocket_api.async_register_command(hass, ws_save_device)
    websocket_api.async_register_command(hass, ws_copy_device_settings)
    websocket_api.async_register_command(hass, ws_start_timer)
    websocket_api.async_register_command(hass, ws_extend_timer)
    websocket_api.async_register_command(hass, ws_cancel_timer)
    websocket_api.async_register_command(hass, ws_set_lockout)
    websocket_api.async_register_command(hass, ws_adjust_bonus_time)
    websocket_api.async_register_command(hass, ws_save_global_restrictions)
    websocket_api.async_register_command(hass, ws_verify_pin)
    websocket_api.async_register_command(hass, ws_save_security_settings)
    websocket_api.async_register_command(hass, ws_reconcile_screen_time)
    websocket_api.async_register_command(hass, ws_import_legacy_helpers)
    websocket_api.async_register_command(hass, ws_delete_device)
    domain_data["websocket_registered"] = True


def _get_engine(hass: HomeAssistant) -> PassableScreenTimeEngine | None:
    """Retrieve active engine instance from hass.data."""
    entries = hass.data.get(DOMAIN, {})
    for k, v in entries.items():
        if k not in ("frontend_registered", "websocket_registered"):
            return v
    return None


def _is_speaker_entity(entity_id: str, state_obj: Any) -> bool:
    """Return True if a media_player appears to be an audio speaker or Music Assistant virtual entity."""
    if not entity_id.startswith("media_player."):
        return False
    if (
        any(k in entity_id for k in ("speaker", "echo", "dot", "google_cast"))
        or entity_id.endswith("_ma")
        or "_ma_" in entity_id
    ):
        return True
    if state_obj and hasattr(state_obj, "attributes"):
        attrs = state_obj.attributes
        if (
            attrs.get("device_class") == "speaker"
            or attrs.get("mass_player_type") is not None
            or attrs.get("app_id") == "music_assistant"
        ):
            return True
    return False


def _build_candidates(
    hass: HomeAssistant, engine: PassableScreenTimeEngine
) -> dict[str, list[dict[str, Any]]]:
    """Discover unmanaged candidate devices, restriction entities, and screen time sensors."""
    managed_targets = {
        d.get("target_entity")
        for d in engine.storage.get_all_devices().values()
        if d.get("target_entity")
    }

    device_candidates: list[dict[str, Any]] = []
    restriction_candidates: list[dict[str, Any]] = []
    sensor_candidates: list[dict[str, Any]] = []

    for state_obj in hass.states.async_all():
        eid = state_obj.entity_id
        domain = eid.split(".", 1)[0]
        fname = state_obj.attributes.get("friendly_name") or eid
        icon = state_obj.attributes.get("icon")

        if domain in ("media_player", "switch") and eid not in managed_targets:
            # Skip our own integration switches
            if eid.startswith("switch.passable_") or eid.endswith("_lockout") or eid.endswith("_schedule_engine"):
                continue
            is_speaker = _is_speaker_entity(eid, state_obj)
            is_tv = domain == "media_player" and state_obj.attributes.get("device_class") == "tv"
            is_recommended = not is_speaker and (
                is_tv
                or (domain == "switch" and any(k in eid for k in ("pause", "tablet", "ipad", "kids", "wifi", "internet", "screen", "tv", "xbox", "ps5", "switch")))
            )
            device_candidates.append(
                {
                    "entity_id": eid,
                    "name": fname,
                    "domain": domain,
                    "icon": icon or ("mdi:television" if domain == "media_player" else "mdi:toggle-switch"),
                    "is_recommended": is_recommended,
                    "is_speaker": is_speaker,
                }
            )
        elif domain in ("input_boolean", "group", "binary_sensor"):
            if eid == "binary_sensor.passable_screen_time_active_lockouts":
                continue
            restriction_candidates.append(
                {
                    "entity_id": eid,
                    "name": fname,
                    "domain": domain,
                    "icon": icon or ("mdi:shield-alert-outline" if domain != "group" else "mdi:account-group"),
                }
            )
            if domain == "binary_sensor":
                sensor_candidates.append(
                    {
                        "entity_id": eid,
                        "name": fname,
                        "domain": domain,
                        "icon": icon or "mdi:eye-outline",
                    }
                )
        elif domain == "sensor":
            if eid.endswith("_screen_time_today") or eid.endswith("_active_app"):
                continue
            sensor_candidates.append(
                {
                    "entity_id": eid,
                    "name": fname,
                    "domain": domain,
                    "icon": icon or "mdi:timer-outline",
                }
            )

    device_candidates.sort(
        key=lambda c: (
            not c["is_recommended"],
            c["is_speaker"],
            c["domain"] != "media_player",
            c["name"].lower(),
        )
    )
    restriction_candidates.sort(key=lambda c: c["name"].lower())
    sensor_candidates.sort(key=lambda c: c["name"].lower())

    return {
        "devices": device_candidates,
        "restrictions": restriction_candidates,
        "screen_time_sensors": sensor_candidates,
    }


def build_engine_snapshot(
    hass: HomeAssistant, engine: PassableScreenTimeEngine
) -> dict[str, Any]:
    """Build enriched JSON-serializable snapshot for the frontend card."""
    now_local = dt_util.now()
    devices_out: dict[str, dict[str, Any]] = {}

    for dev_id, raw_dev in engine.storage.get_all_devices().items():
        dev_copy = dict(raw_dev)
        target = dev_copy.get("target_entity")
        dev_type = dev_copy.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)
        target_state_obj = hass.states.get(target) if target else None
        active_rule = get_active_schedule_rule(dev_copy, now_local)
        next_event = compute_next_schedule_transition(dev_copy, now_local)
        eff_limit = compute_effective_daily_limit(dev_copy, now_local)

        dev_copy["is_target_active"] = (
            engine._is_target_active(target, dev_type) if target else False
        )
        dev_copy["target_state"] = (
            target_state_obj.state if target_state_obj else "unavailable"
        )
        dev_copy["effective_daily_limit_minutes"] = eff_limit
        dev_copy["in_schedule_window"] = active_rule is not None
        dev_copy["active_schedule_name"] = (
            active_rule.get("name")
            if active_rule
            else dev_copy.get("active_schedule_name")
        )
        dev_copy["next_schedule_event"] = next_event
        devices_out[dev_id] = dev_copy

    restrictions_out: list[dict[str, Any]] = []
    for r in engine.storage.get_global_restrictions():
        ent = r.get("entity")
        if not ent:
            continue
        st = hass.states.get(ent)
        restrictions_out.append(
            {
                "entity": ent,
                "name": r.get("name") or (st.attributes.get("friendly_name") if st else None) or ent,
                "icon": r.get("icon") or (st.attributes.get("icon") if st else None) or "mdi:shield-alert-outline",
                "is_active": bool(st and st.state == "on"),
            }
        )

    return {
        "version": VERSION,
        "devices": devices_out,
        "global_restrictions": restrictions_out,
        "security": engine.storage.get_public_security_settings(),
        "candidates": _build_candidates(hass, engine),
    }


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/get_data",
    }
)
@websocket_api.async_response
async def ws_get_data(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return all devices, schedules, timers, restrictions, security, and candidates."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    connection.send_result(msg["id"], build_engine_snapshot(hass, engine))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/subscribe",
    }
)
@callback
def ws_subscribe(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Subscribe to real-time debounced engine state snapshots."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    pending_handle: asyncio.TimerHandle | None = None
    unsubs: list[Callable[[], None]] = []
    state_unsub: Callable[[], None] | None = None

    @callback
    def _push_now() -> None:
        nonlocal pending_handle
        pending_handle = None
        try:
            connection.send_message(
                websocket_api.event_message(
                    msg["id"], build_engine_snapshot(hass, engine)
                )
            )
        except Exception as err:
            _LOGGER.debug("Screen time WS snapshot push failed: %s", err)

    @callback
    def _schedule_push(*_args: Any) -> None:
        nonlocal pending_handle
        if pending_handle is not None:
            return
        pending_handle = hass.loop.call_later(0.15, _push_now)

    @callback
    def _rebuild_state_listener(*_args: Any) -> None:
        nonlocal state_unsub
        if state_unsub is not None:
            state_unsub()
            state_unsub = None
        watched: set[str] = {"switch.passable_master_device_lockout"}
        for dev in engine.storage.get_all_devices().values():
            if dev.get("target_entity"):
                watched.add(dev["target_entity"])
            if dev.get("screen_time_entity"):
                watched.add(dev["screen_time_entity"])
        for r in engine.storage.get_global_restrictions():
            if r.get("entity"):
                watched.add(r["entity"])
        if watched:
            state_unsub = async_track_state_change_event(
                hass, list(watched), _schedule_push
            )

    unsubs.append(async_dispatcher_connect(hass, SIGNAL_DEVICE_UPDATED, _schedule_push))
    unsubs.append(async_dispatcher_connect(hass, SIGNAL_ENGINE_UPDATED, _schedule_push))
    unsubs.append(async_dispatcher_connect(hass, SIGNAL_DEVICE_ADDED, _schedule_push))

    @callback
    def _on_storage_updated(*_args: Any) -> None:
        _rebuild_state_listener()
        _schedule_push()

    unsubs.append(
        async_dispatcher_connect(hass, SIGNAL_STORAGE_UPDATED, _on_storage_updated)
    )
    _rebuild_state_listener()

    @callback
    def _cleanup() -> None:
        nonlocal pending_handle, state_unsub
        if pending_handle is not None:
            pending_handle.cancel()
            pending_handle = None
        if state_unsub is not None:
            state_unsub()
            state_unsub = None
        for unsub in unsubs:
            try:
                unsub()
            except Exception:
                pass
        unsubs.clear()

    connection.subscriptions[msg["id"]] = _cleanup
    connection.send_result(msg["id"])
    connection.send_message(
        websocket_api.event_message(msg["id"], build_engine_snapshot(hass, engine))
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/add_device",
        vol.Required("target_entity"): str,
        vol.Optional("name"): vol.Any(str, None),
        vol.Optional("icon"): vol.Any(str, None),
        vol.Optional("device_category"): vol.Any(vol.In(DEVICE_CATEGORIES), None),
        vol.Optional("track_screen_time"): vol.Any(bool, None),
        vol.Optional("daily_limit_enabled"): vol.Any(bool, None),
        vol.Optional("daily_limit_minutes"): vol.Any(vol.Coerce(int), None),
        vol.Optional("screen_time_entity"): vol.Any(str, None),
    }
)
@websocket_api.async_response
async def ws_add_device(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Onboard a new device from the frontend card."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    target_entity = msg["target_entity"].strip()
    if not (
        target_entity.startswith("media_player.")
        or target_entity.startswith("switch.")
    ):
        connection.send_error(
            msg["id"],
            "invalid_format",
            "Target entity must be a media_player or switch entity.",
        )
        return

    device = await engine.async_add_device(
        target_entity=target_entity,
        name=msg.get("name"),
        icon=msg.get("icon"),
        device_category=msg.get("device_category"),
        track_screen_time=msg.get("track_screen_time"),
        daily_limit_enabled=msg.get("daily_limit_enabled"),
        daily_limit_minutes=msg.get("daily_limit_minutes"),
        screen_time_entity=msg.get("screen_time_entity"),
    )
    connection.send_result(msg["id"], {"success": True, "device": device})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_device",
        vol.Required("device_id"): str,
        vol.Optional("name"): str,
        vol.Optional("icon"): vol.Any(str, None),
        vol.Optional("device_category"): vol.Any(vol.In(DEVICE_CATEGORIES), None),
        vol.Optional("schedule_enabled"): bool,
        vol.Optional("schedules"): [dict],
        vol.Optional("schedule_days"): [str],
        vol.Optional("schedule_start"): str,
        vol.Optional("schedule_end"): str,
        vol.Optional("schedule_recurrence"): str,
        vol.Optional("schedule_anchor_date"): vol.Any(str, None),
        vol.Optional("daily_limit_mode"): vol.In(("uniform", "weekday_weekend")),
        vol.Optional("daily_limit_minutes"): vol.Coerce(int),
        vol.Optional("daily_limit_weekday_minutes"): vol.Coerce(int),
        vol.Optional("daily_limit_weekend_minutes"): vol.Coerce(int),
        vol.Optional("daily_limit_enabled"): bool,
        vol.Optional("track_screen_time"): bool,
        vol.Optional("screen_time_entity"): vol.Any(str, None),
    }
)
@websocket_api.async_response
async def ws_save_device(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save updated device configuration, multi-window schedules, and limits."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    device_id = msg["device_id"]
    existing = engine.storage.get_device(device_id)
    if not existing:
        connection.send_error(msg["id"], "not_found", f"Device '{device_id}' not found.")
        return

    updates: dict[str, Any] = {}
    for key in [
        "name",
        "icon",
        "device_category",
        "schedule_enabled",
        "daily_limit_mode",
        "daily_limit_minutes",
        "daily_limit_weekday_minutes",
        "daily_limit_weekend_minutes",
        "daily_limit_enabled",
        "track_screen_time",
        "screen_time_entity",
    ]:
        if key in msg:
            updates[key] = msg[key]

    if "schedules" in msg:
        normalized = [
            normalize_schedule_rule(r, idx)
            for idx, r in enumerate(msg["schedules"])
        ]
        updates["schedules"] = normalized
        if normalized:
            first = normalized[0]
            updates["schedule_days"] = list(first["days"])
            updates["schedule_start"] = first["start"]
            updates["schedule_end"] = first["end"]
            updates["schedule_recurrence"] = first["recurrence"]
            updates["schedule_anchor_date"] = first["anchor_date"]
    elif any(
        k in msg
        for k in (
            "schedule_days",
            "schedule_start",
            "schedule_end",
            "schedule_recurrence",
            "schedule_anchor_date",
        )
    ):
        existing_rules = list(existing.get("schedules") or [])
        base_rule = dict(existing_rules[0]) if existing_rules else {}
        if "schedule_days" in msg:
            base_rule["days"] = msg["schedule_days"]
        if "schedule_start" in msg:
            base_rule["start"] = msg["schedule_start"]
        if "schedule_end" in msg:
            base_rule["end"] = msg["schedule_end"]
        if "schedule_recurrence" in msg:
            base_rule["recurrence"] = msg["schedule_recurrence"]
        if "schedule_anchor_date" in msg:
            base_rule["anchor_date"] = msg["schedule_anchor_date"]
        first = normalize_schedule_rule(base_rule, 0)
        if existing_rules:
            existing_rules[0] = first
        else:
            existing_rules = [first]
        updates["schedules"] = existing_rules
        updates["schedule_days"] = list(first["days"])
        updates["schedule_start"] = first["start"]
        updates["schedule_end"] = first["end"]
        updates["schedule_recurrence"] = first["recurrence"]
        updates["schedule_anchor_date"] = first["anchor_date"]

    if updates.get("track_screen_time") is False:
        updates["screen_time_today_minutes"] = 0
        updates["apps_used_today"] = []

    await engine.storage.async_update_device(device_id, updates)
    if "screen_time_entity" in msg:
        engine.async_rebuild_device_listeners()
    await engine.async_evaluate_schedules()
    async_dispatcher_send(hass, SIGNAL_DEVICE_UPDATED, device_id)
    async_dispatcher_send(hass, SIGNAL_ENGINE_UPDATED)
    async_dispatcher_send(hass, SIGNAL_STORAGE_UPDATED)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/copy_device_settings",
        vol.Required("source_device_id"): str,
        vol.Required("target_device_ids"): [str],
        vol.Optional("copy_schedules", default=True): bool,
        vol.Optional("copy_limits", default=True): bool,
    }
)
@websocket_api.async_response
async def ws_copy_device_settings(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Copy schedule rules and/or daily limits from one device to other devices."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    count = await engine.async_copy_device_settings(
        source_device_id=msg["source_device_id"],
        target_device_ids=msg["target_device_ids"],
        copy_schedules=msg.get("copy_schedules", True),
        copy_limits=msg.get("copy_limits", True),
    )
    connection.send_result(msg["id"], {"success": True, "updated_count": count})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/start_timer",
        vol.Required("device_id"): str,
        vol.Optional("mode", default=TIMER_MODE_UNLOCK): vol.In(VALID_TIMER_MODES),
        vol.Optional("duration", default=20): vol.Coerce(float),
        vol.Optional("unit", default="minutes"): str,
        vol.Optional("until_time"): vol.Any(str, None),
        vol.Optional("power_on", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_start_timer(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Start an unlock, temporary lock, or wind-down timer."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    try:
        await engine.async_start_device_timer(
            device_id=msg["device_id"],
            duration=msg.get("duration", 20),
            unit=msg.get("unit", "minutes"),
            mode=msg.get("mode", TIMER_MODE_UNLOCK),
            until_time=msg.get("until_time"),
            power_on=msg.get("power_on", False),
        )
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return

    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/extend_timer",
        vol.Required("device_id"): str,
        vol.Optional("add_minutes", default=15): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def ws_extend_timer(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Extend an active timer by add_minutes."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    ok = await engine.async_extend_device_timer(
        msg["device_id"], msg.get("add_minutes", 15)
    )
    connection.send_result(msg["id"], {"success": ok})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/cancel_timer",
        vol.Required("device_id"): str,
    }
)
@websocket_api.async_response
async def ws_cancel_timer(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Cancel active countdown timer."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    engine.async_cancel_device_timer(msg["device_id"])
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_lockout",
        vol.Required("device_id"): str,
        vol.Required("locked"): bool,
        vol.Optional("power_on", default=False): bool,
        vol.Optional("rest_of_day", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_set_lockout(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Explicitly lock or unlock a device (or 'all')."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    device_id = msg["device_id"]
    locked = msg["locked"]
    power_on = msg.get("power_on", False)
    rest_of_day = msg.get("rest_of_day", False)

    if device_id in ("all", "*", ""):
        await engine.async_set_all_lockouts(
            locked=locked, power_on=power_on, rest_of_day=rest_of_day
        )
    else:
        await engine.async_set_device_lockout(
            device_id,
            locked=locked,
            power_on=power_on,
            rest_of_day=rest_of_day,
        )
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/adjust_bonus_time",
        vol.Required("device_id"): str,
        vol.Optional("delta_minutes", default=15): vol.Coerce(int),
        vol.Optional("reset", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_adjust_bonus_time(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Add or reset bonus screen time minutes for today."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    await engine.async_adjust_bonus_time(
        msg["device_id"],
        delta_minutes=msg.get("delta_minutes", 15),
        reset=msg.get("reset", False),
    )
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_global_restrictions",
        vol.Required("restrictions"): [
            vol.Schema(
                {
                    vol.Required("entity"): str,
                    vol.Optional("name"): vol.Any(str, None),
                    vol.Optional("icon"): vol.Any(str, None),
                }
            )
        ],
    }
)
@websocket_api.async_response
async def ws_save_global_restrictions(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save global household restriction triggers."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    await engine.async_update_global_restrictions(msg["restrictions"])
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/verify_pin",
        vol.Required("pin"): str,
    }
)
@websocket_api.async_response
async def ws_verify_pin(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Verify the Parental PIN."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    valid = engine.storage.verify_pin(msg["pin"])
    connection.send_result(msg["id"], {"valid": valid})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_security_settings",
        vol.Optional("current_pin"): vol.Any(str, None),
        vol.Optional("new_pin"): vol.Any(str, None),
        vol.Optional("pin_enabled"): bool,
        vol.Optional("require_pin_for_unlock"): bool,
        vol.Optional("require_pin_for_timers"): bool,
        vol.Optional("require_pin_for_settings"): bool,
    }
)
@websocket_api.async_response
async def ws_save_security_settings(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save Parental PIN and wall-panel lock policy settings."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    pub = engine.storage.get_public_security_settings()
    if pub.get("pin_enabled"):
        curr = msg.get("current_pin") or ""
        if not engine.storage.verify_pin(curr):
            connection.send_error(
                msg["id"], "unauthorized", "Current PIN is incorrect."
            )
            return

    new_pin = msg.get("new_pin")
    if new_pin is not None and new_pin != "":
        if not new_pin.isdigit() or not (4 <= len(new_pin) <= 6):
            connection.send_error(
                msg["id"], "invalid_format", "PIN must be 4 to 6 digits."
            )
            return

    updated = await engine.storage.async_update_security_settings(
        pin=new_pin,
        pin_enabled=msg.get("pin_enabled"),
        require_pin_for_unlock=msg.get("require_pin_for_unlock"),
        require_pin_for_timers=msg.get("require_pin_for_timers"),
        require_pin_for_settings=msg.get("require_pin_for_settings"),
    )
    async_dispatcher_send(hass, SIGNAL_ENGINE_UPDATED)
    connection.send_result(msg["id"], {"success": True, "security": updated})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/reconcile_screen_time",
        vol.Optional("device_id", default="all"): str,
    }
)
@websocket_api.async_response
async def ws_reconcile_screen_time(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Reconcile today's screen time from Recorder history."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    device_id = msg.get("device_id", "all")
    if device_id and device_id not in ("all", "*", ""):
        await engine.async_reconcile_device_screen_time(device_id)
    else:
        await engine.async_reconcile_all_screen_time()
    async_dispatcher_send(hass, SIGNAL_ENGINE_UPDATED)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/import_legacy_helpers",
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
    await engine._async_sync_config_entry_options()
    engine.async_rebuild_device_listeners()
    await engine.async_evaluate_schedules()
    for did in engine.storage.get_all_devices():
        async_dispatcher_send(hass, SIGNAL_DEVICE_ADDED, did)
    async_dispatcher_send(hass, SIGNAL_ENGINE_UPDATED)
    async_dispatcher_send(hass, SIGNAL_STORAGE_UPDATED)
    connection.send_result(msg["id"], {"success": True, "imported_count": count})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_device",
        vol.Required("device_id"): str,
    }
)
@websocket_api.async_response
async def ws_delete_device(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete a managed device from storage and clean up entities."""
    engine = _get_engine(hass)
    if not engine:
        connection.send_error(
            msg["id"], "not_found", "Passable Screen Time Engine is not loaded."
        )
        return

    device_id = msg["device_id"]
    await engine.async_remove_device_and_cleanup(device_id)
    connection.send_result(msg["id"], {"success": True})
