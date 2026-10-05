"""Storage manager for Passable Smart Screen Time Engine."""

from __future__ import annotations

import json
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    DAYS_OF_WEEK,
    DEFAULT_DAILY_LIMIT,
    DEFAULT_TIMER_DURATION,
    DEVICE_TYPE_MEDIA_PLAYER,
    DEVICE_TYPE_NETWORK_SWITCH,
    RECURRENCE_WEEKLY,
    STORAGE_KEY,
    STORAGE_VERSION,
)

_LOGGER = logging.getLogger(__name__)


def get_default_device_data(
    device_id: str, target_entity: str, name: str | None = None
) -> dict[str, Any]:
    """Return default configuration for a managed device."""
    is_switch = target_entity.startswith("switch.")
    clean_name = name or target_entity.split(".", 1)[-1].replace("_", " ").title()
    return {
        "device_id": device_id,
        "target_entity": target_entity,
        "name": clean_name,
        "device_type": (
            DEVICE_TYPE_NETWORK_SWITCH if is_switch else DEVICE_TYPE_MEDIA_PLAYER
        ),
        "locked": False,
        "schedule_enabled": True,
        "schedule_recurrence": RECURRENCE_WEEKLY,
        "schedule_days": list(DAYS_OF_WEEK),
        "schedule_start": "08:00",
        "schedule_end": "20:00",
        "schedule_anchor_date": None,
        "timer_expires_at": None,
        "timer_duration": DEFAULT_TIMER_DURATION,
        "timer_unit": "minutes",
        "daily_limit_minutes": DEFAULT_DAILY_LIMIT,
        "screen_time_today_minutes": 0,
        "screen_time_date": None,
        "active_app": "None",
        "apps_used_today": [],
    }


class PassableScreenTimeStorage:
    """Manages persistent atomic storage for devices, schedules, timers, and stats."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize atomic storage."""
        self.hass = hass
        self._store = Store[dict[str, Any]](hass, STORAGE_VERSION, STORAGE_KEY)
        self.data: dict[str, Any] = {
            "devices": {},
            "global_restrictions": [],
            "default_daily_limit": DEFAULT_DAILY_LIMIT,
        }

    async def async_load(self) -> dict[str, Any]:
        """Load persisted data from disk."""
        stored = await self._store.async_load()
        if stored:
            self.data = stored
            if "devices" not in self.data:
                self.data["devices"] = {}
            if "global_restrictions" not in self.data:
                self.data["global_restrictions"] = []
        _LOGGER.info(
            "Loaded Passable Screen Time storage with %s managed devices",
            len(self.data.get("devices", {})),
        )
        return self.data

    async def async_save(self) -> None:
        """Save data atomically to disk."""
        await self._store.async_save(self.data)

    def get_all_devices(self) -> dict[str, dict[str, Any]]:
        """Return all managed devices."""
        return self.data.get("devices", {})

    def get_device(self, device_id: str) -> dict[str, Any]:
        """Get data for a specific device, or return default."""
        return self.data.get("devices", {}).get(device_id, {})

    async def async_update_device(
        self, device_id: str, updates: dict[str, Any]
    ) -> None:
        """Update a specific device's attributes and save."""
        devices = self.data.setdefault("devices", {})
        if device_id not in devices:
            devices[device_id] = {}
        devices[device_id].update(updates)
        await self.async_save()

    async def async_remove_device(self, device_id: str) -> None:
        """Remove a device from management."""
        devices = self.data.setdefault("devices", {})
        if device_id in devices:
            del devices[device_id]
            await self.async_save()

    def get_global_restrictions(self) -> list[dict[str, Any]]:
        """Return global restriction triggers."""
        return self.data.get("global_restrictions", [])

    async def async_update_global_restrictions(
        self, restrictions: list[dict[str, Any]]
    ) -> None:
        """Update global restrictions list and save."""
        self.data["global_restrictions"] = restrictions
        await self.async_save()

    async def async_import_legacy_helpers(self) -> int:
        """Automatically import legacy input_text and input_boolean helpers into .storage."""
        imported_count = 0
        all_states = self.hass.states.async_all()

        schedule_entities = [
            s
            for s in all_states
            if s.entity_id.startswith("input_text.device_lockout_schedule_")
            or s.entity_id.startswith("input_text.tv_lockout_schedule_")
        ]

        for s_entity in schedule_entities:
            raw_id = s_entity.entity_id.split(".")[-1]
            dev_id = raw_id.replace("device_lockout_schedule_", "").replace(
                "tv_lockout_schedule_", ""
            )

            # Resolve target entity
            target_entity = None

            # 1. Preserve existing target entity if already configured in storage
            if dev_id in self.data.get("devices", {}) and self.data["devices"][dev_id].get("target_entity"):
                target_entity = self.data["devices"][dev_id]["target_entity"]

            # 2. Check media_players (prioritize actual TVs, ignore speakers and MA virtual players)
            if not target_entity:
                mp_candidates = [
                    mp for mp in self.hass.states.async_entity_ids("media_player")
                    if dev_id in mp
                ]
                tv_candidates = [
                    mp for mp in mp_candidates
                    if "tv" in mp and not any(k in mp for k in ("speaker", "echo", "dot", "_ma"))
                ]
                if tv_candidates:
                    active_tvs = [
                        mp for mp in tv_candidates
                        if self.hass.states.get(mp) and self.hass.states.get(mp).state not in ("unavailable", "unknown")
                    ]
                    target_entity = active_tvs[0] if active_tvs else sorted(tv_candidates, reverse=True)[0]
                elif mp_candidates:
                    non_speakers = [
                        mp for mp in mp_candidates
                        if not any(k in mp for k in ("speaker", "echo", "dot", "_ma"))
                    ]
                    target_entity = non_speakers[0] if non_speakers else mp_candidates[0]

            # 3. Check switches (e.g. personal tablets, network pause)
            if not target_entity:
                for sw in self.hass.states.async_entity_ids("switch"):
                    if dev_id in sw:
                        target_entity = sw
                        break

            if not target_entity:
                target_entity = f"media_player.{dev_id}"

            # Check toggles
            toggle_id = f"input_boolean.device_lockout_toggle_{dev_id}"
            sched_en_id = f"input_boolean.device_lockout_enabled_{dev_id}"

            toggle_state = self.hass.states.get(toggle_id)
            sched_en_state = self.hass.states.get(sched_en_id)

            is_locked = toggle_state.state == "on" if toggle_state else False
            is_sched_en = sched_en_state.state == "on" if sched_en_state else True

            # Parse schedule JSON
            sched_days = list(DAYS_OF_WEEK)
            start_time = "08:00"
            end_time = "20:00"

            try:
                if s_entity.state and s_entity.state.startswith("{"):
                    sched_obj = json.loads(s_entity.state)
                    if isinstance(sched_obj, dict) and sched_obj:
                        active_days = [d for d in DAYS_OF_WEEK if d in sched_obj]
                        if active_days:
                            sched_days = active_days
                            sample_times = sched_obj[active_days[0]]
                            if (
                                isinstance(sample_times, list)
                                and len(sample_times) >= 2
                            ):
                                start_time = sample_times[0]
                                end_time = sample_times[1]
            except Exception as parse_err:
                _LOGGER.warning(
                    "Error parsing legacy schedule for %s: %s", dev_id, parse_err
                )

            # Friendly name resolution
            friendly_name = dev_id.replace("_", " ").title()
            if self.hass.states.get(target_entity):
                fn = self.hass.states.get(target_entity).attributes.get(
                    "friendly_name"
                )
                if fn:
                    friendly_name = fn

            device_payload = get_default_device_data(
                device_id=dev_id, target_entity=target_entity, name=friendly_name
            )
            device_payload.update(
                {
                    "locked": is_locked,
                    "schedule_enabled": is_sched_en,
                    "schedule_days": sched_days,
                    "schedule_start": start_time,
                    "schedule_end": end_time,
                }
            )

            self.data.setdefault("devices", {})[dev_id] = device_payload
            imported_count += 1
            _LOGGER.info(
                "Imported legacy lockout configuration for %s (%s)",
                dev_id,
                target_entity,
            )

        if imported_count > 0:
            await self.async_save()

        return imported_count
