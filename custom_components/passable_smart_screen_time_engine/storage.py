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
        "locked_by_schedule": False,
        "schedule_enabled": True,
        "schedule_recurrence": RECURRENCE_WEEKLY,
        "schedule_days": list(DAYS_OF_WEEK),
        "schedule_start": "08:00",
        "schedule_end": "20:00",
        "schedule_anchor_date": None,
        "timer_expires_at": None,
        "timer_duration": DEFAULT_TIMER_DURATION,
        "timer_unit": "minutes",
        "track_screen_time": not is_switch,
        "daily_limit_enabled": not is_switch,
        "daily_limit_minutes": DEFAULT_DAILY_LIMIT,
        "screen_time_entity": None,
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
        """Load persisted data from disk and perform migration cleanup."""
        stored = await self._store.async_load()
        if stored:
            self.data = stored
            if "devices" not in self.data:
                self.data["devices"] = {}
            if "global_restrictions" not in self.data:
                self.data["global_restrictions"] = []

        # Automatic migration & cleanup of legacy/accidental entries
        modified = False
        devices = self.data.setdefault("devices", {})

        # 1. Clean up speaker devices or MA virtual players imported by accident
        for dev_id, dev in list(devices.items()):
            target = dev.get("target_entity", "")
            st_state = self.hass.states.get(target) if target else None
            is_speaker = (
                any(k in target for k in ("speaker", "_speaker_ma", "_ma", "google_cast"))
                or (st_state and (
                    st_state.attributes.get("device_class") == "speaker"
                    or st_state.attributes.get("mass_player_type") is not None
                    or st_state.attributes.get("app_id") == "music_assistant"
                ))
            )
            if is_speaker:
                _LOGGER.info("Cleaning up legacy speaker entry from storage: %s (%s)", dev_id, target)
                del devices[dev_id]
                modified = True

        # 2. Normalize and deduplicate devices targeting the same entity
        seen_targets: dict[str, str] = {}
        for dev_id, dev in list(devices.items()):
            target = dev.get("target_entity")
            if not target:
                continue
            canonical_slug = target.split(".", 1)[-1]
            if target in seen_targets:
                existing_dev_id = seen_targets[target]
                if dev_id == canonical_slug and existing_dev_id != canonical_slug:
                    del devices[existing_dev_id]
                    seen_targets[target] = dev_id
                    modified = True
                else:
                    del devices[dev_id]
                    modified = True
            else:
                if dev_id != canonical_slug and canonical_slug not in devices:
                    devices[canonical_slug] = dev
                    dev["device_id"] = canonical_slug
                    del devices[dev_id]
                    seen_targets[target] = canonical_slug
                    modified = True
                else:
                    seen_targets[target] = dev_id

        # 3. Ensure track_screen_time and daily_limit_enabled exist for all devices
        for dev_id, dev in devices.items():
            is_sw = (
                dev.get("device_type") == DEVICE_TYPE_NETWORK_SWITCH
                or dev.get("target_entity", "").startswith("switch.")
            )
            if "track_screen_time" not in dev:
                dev["track_screen_time"] = not is_sw
                modified = True
            if not dev.get("track_screen_time", True):
                if dev.get("screen_time_today_minutes", 0) != 0:
                    dev["screen_time_today_minutes"] = 0
                    modified = True
            if "daily_limit_enabled" not in dev:
                dev["daily_limit_enabled"] = not is_sw
                modified = True
            if "screen_time_entity" not in dev:
                dev["screen_time_entity"] = None
                modified = True

        if modified:
            await self.async_save()

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

            # 1. Preserve existing target entity ONLY if valid and not a speaker / MA player
            if dev_id in self.data.get("devices", {}):
                stored_target = self.data["devices"][dev_id].get("target_entity")
                if stored_target:
                    st_state = self.hass.states.get(stored_target)
                    is_bad = (
                        any(k in stored_target for k in ("speaker", "echo", "dot", "_ma", "google_cast"))
                        or (st_state and (
                            st_state.attributes.get("device_class") == "speaker"
                            or st_state.attributes.get("mass_player_type") is not None
                            or st_state.attributes.get("app_id") == "music_assistant"
                        ))
                    )
                    if not is_bad:
                        target_entity = stored_target

            # 2. Check media_players (strictly exclude speakers & Music Assistant players; prioritize device_class == "tv")
            if not target_entity:
                mp_candidates = [
                    mp for mp in self.hass.states.async_entity_ids("media_player")
                    if dev_id in mp
                ]
                filtered_mps = []
                for mp in mp_candidates:
                    if any(k in mp for k in ("speaker", "echo", "dot", "_ma", "google_cast")):
                        continue
                    st = self.hass.states.get(mp)
                    if st and (
                        st.attributes.get("device_class") == "speaker"
                        or st.attributes.get("mass_player_type") is not None
                        or st.attributes.get("app_id") == "music_assistant"
                    ):
                        continue
                    filtered_mps.append(mp)

                tv_class_candidates = [
                    mp for mp in filtered_mps
                    if self.hass.states.get(mp) and self.hass.states.get(mp).attributes.get("device_class") == "tv"
                ]
                if tv_class_candidates:
                    active_tvs = [
                        mp for mp in tv_class_candidates
                        if self.hass.states.get(mp).state not in ("unavailable", "unknown")
                    ]
                    target_entity = active_tvs[0] if active_tvs else sorted(tv_class_candidates, reverse=True)[0]
                elif filtered_mps:
                    target_entity = sorted(filtered_mps, reverse=True)[0]

            # 3. Check switches (e.g. personal tablets, network pause)
            if not target_entity:
                for sw in self.hass.states.async_entity_ids("switch"):
                    if dev_id in sw:
                        target_entity = sw
                        break

            if not target_entity:
                target_entity = f"media_player.{dev_id}"

            # Standardize device key by target entity slug
            final_dev_id = target_entity.split(".", 1)[-1]

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

            # Remove any stale device entries targeting this entity or under old raw room slug
            devices = self.data.setdefault("devices", {})
            for existing_id, existing_dev in list(devices.items()):
                if existing_id != final_dev_id and (
                    existing_dev.get("target_entity") == target_entity
                    or existing_id == dev_id
                ):
                    del devices[existing_id]

            existing_dev = devices.get(final_dev_id, {})
            existing_mins = existing_dev.get("screen_time_today_minutes", 0)
            existing_date = existing_dev.get("screen_time_date")
            existing_apps = list(existing_dev.get("apps_used_today", []))
            existing_active_app = existing_dev.get("active_app", "None")
            existing_locked_by_sched = existing_dev.get("locked_by_schedule", False)
            existing_track_st = existing_dev.get("track_screen_time")
            existing_dl_en = existing_dev.get("daily_limit_enabled")
            existing_dl_mins = existing_dev.get("daily_limit_minutes")
            existing_st_ent = existing_dev.get("screen_time_entity")

            device_payload = get_default_device_data(
                device_id=final_dev_id, target_entity=target_entity, name=friendly_name
            )
            updates: dict[str, Any] = {
                "locked": is_locked,
                "locked_by_schedule": existing_locked_by_sched,
                "schedule_enabled": is_sched_en,
                "schedule_days": sched_days,
                "schedule_start": start_time,
                "schedule_end": end_time,
                "screen_time_today_minutes": existing_mins,
                "screen_time_date": existing_date,
                "apps_used_today": existing_apps,
                "active_app": existing_active_app,
            }
            if existing_track_st is not None:
                updates["track_screen_time"] = existing_track_st
            if existing_dl_en is not None:
                updates["daily_limit_enabled"] = existing_dl_en
            if existing_dl_mins is not None:
                updates["daily_limit_minutes"] = existing_dl_mins
            if existing_st_ent is not None:
                updates["screen_time_entity"] = existing_st_ent

            device_payload.update(updates)

            devices[final_dev_id] = device_payload
            imported_count += 1
            _LOGGER.info(
                "Imported legacy lockout configuration for %s (%s)",
                final_dev_id,
                target_entity,
            )

        if imported_count > 0:
            await self.async_save()

        return imported_count
