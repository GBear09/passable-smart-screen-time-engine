"""Storage manager for Passable Smart Screen Time Engine."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    DAYS_OF_WEEK,
    DEFAULT_DAILY_LIMIT,
    DEFAULT_TIMER_DURATION,
    DEVICE_CATEGORIES,
    DEVICE_TYPE_MEDIA_PLAYER,
    DEVICE_TYPE_NETWORK_SWITCH,
    REASON_MANUAL,
    REASON_SCHEDULE,
    RECURRENCE_BIWEEKLY,
    RECURRENCE_WEEKLY,
    STORAGE_KEY,
    STORAGE_VERSION,
    TIMER_MODE_UNLOCK,
)

_LOGGER = logging.getLogger(__name__)


def _normalize_hhmm(value: Any, fallback: str) -> str:
    """Validate and normalize an HH:MM string."""
    if not isinstance(value, str):
        return fallback
    parts = value.strip().split(":")
    if len(parts) < 2:
        return fallback
    try:
        hour = int(parts[0])
        minute = int(parts[1])
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return f"{hour:02d}:{minute:02d}"
    except (TypeError, ValueError):
        pass
    return fallback


def normalize_schedule_rule(rule: dict[str, Any], index: int = 0) -> dict[str, Any]:
    """Normalize a single schedule window dictionary."""
    if not isinstance(rule, dict):
        rule = {}

    raw_id = str(rule.get("id") or "").strip()
    rule_id = raw_id or f"sched_{index + 1}"

    raw_name = str(rule.get("name") or "").strip()
    rule_name = raw_name or f"Schedule {index + 1}"

    raw_days = rule.get("days")
    if isinstance(raw_days, list):
        day_set = {str(d).lower() for d in raw_days}
        days = [d for d in DAYS_OF_WEEK if d in day_set]
    else:
        days = list(DAYS_OF_WEEK)

    recurrence = (
        RECURRENCE_BIWEEKLY
        if rule.get("recurrence") == RECURRENCE_BIWEEKLY
        else RECURRENCE_WEEKLY
    )
    anchor_date = rule.get("anchor_date") if recurrence == RECURRENCE_BIWEEKLY else None
    if anchor_date is not None and not isinstance(anchor_date, str):
        anchor_date = None

    return {
        "id": rule_id,
        "name": rule_name,
        "enabled": bool(rule.get("enabled", True)),
        "days": days,
        "start": _normalize_hhmm(rule.get("start"), "20:00"),
        "end": _normalize_hhmm(rule.get("end"), "07:00"),
        "recurrence": recurrence,
        "anchor_date": anchor_date,
    }


def _default_security_data() -> dict[str, Any]:
    """Return default security/PIN settings."""
    return {
        "pin_enabled": False,
        "pin_hash": None,
        "pin_salt": None,
        "require_pin_for_unlock": True,
        "require_pin_for_timers": True,
        "require_pin_for_settings": True,
    }


def _hash_pin(pin: str, salt: str) -> str:
    """Hash a PIN with a per-user salt using SHA-256."""
    return hashlib.sha256(f"{salt}:{pin}".encode("utf-8")).hexdigest()


def get_default_device_data(
    device_id: str,
    target_entity: str,
    name: str | None = None,
    icon: str | None = None,
    device_category: str | None = None,
) -> dict[str, Any]:
    """Return default configuration for a managed device."""
    is_switch = target_entity.startswith("switch.")
    clean_name = name or target_entity.split(".", 1)[-1].replace("_", " ").title()
    category = (
        device_category
        if device_category in DEVICE_CATEGORIES
        else ("network" if is_switch else "tv")
    )
    default_icon = icon or ("mdi:tablet-ipad" if is_switch else "mdi:television")
    default_schedule = normalize_schedule_rule(
        {
            "id": "sched_default",
            "name": "Downtime",
            "enabled": True,
            "days": list(DAYS_OF_WEEK),
            "start": "20:00",
            "end": "07:00",
            "recurrence": RECURRENCE_WEEKLY,
            "anchor_date": None,
        },
        index=0,
    )
    return {
        "device_id": device_id,
        "target_entity": target_entity,
        "name": clean_name,
        "icon": default_icon,
        "device_category": category,
        "device_type": (
            DEVICE_TYPE_NETWORK_SWITCH if is_switch else DEVICE_TYPE_MEDIA_PLAYER
        ),
        "locked": False,
        "locked_by_schedule": False,
        "locked_reason": None,
        "active_schedule_name": None,
        "lock_until_midnight": False,
        "manual_unlock_override": False,
        "schedule_enabled": True,
        "schedules": [default_schedule],
        "schedule_recurrence": default_schedule["recurrence"],
        "schedule_days": list(default_schedule["days"]),
        "schedule_start": default_schedule["start"],
        "schedule_end": default_schedule["end"],
        "schedule_anchor_date": default_schedule["anchor_date"],
        "timer_expires_at": None,
        "timer_mode": None,
        "timer_duration": DEFAULT_TIMER_DURATION,
        "timer_unit": "minutes",
        "track_screen_time": not is_switch,
        "daily_limit_enabled": not is_switch,
        "daily_limit_mode": "uniform",
        "daily_limit_minutes": DEFAULT_DAILY_LIMIT,
        "daily_limit_weekday_minutes": DEFAULT_DAILY_LIMIT,
        "daily_limit_weekend_minutes": 180,
        "bonus_minutes_today": 0,
        "daily_limit_overridden_today": False,
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
            "security": _default_security_data(),
            "initial_seed_complete": False,
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

        modified = False
        if "security" not in self.data or not isinstance(self.data["security"], dict):
            self.data["security"] = _default_security_data()
            modified = True
        else:
            sec_defaults = _default_security_data()
            for k, v in sec_defaults.items():
                if k not in self.data["security"]:
                    self.data["security"][k] = v
                    modified = True

        # Automatic migration & cleanup of legacy/accidental entries
        devices = self.data.setdefault("devices", {})
        if devices and not self.data.get("initial_seed_complete"):
            self.data["initial_seed_complete"] = True
            modified = True

        # 1. Clean up speaker devices or MA virtual players imported by accident
        for dev_id, dev in list(devices.items()):
            target = dev.get("target_entity", "")
            # Only media_player entities can be speakers or MA virtual players; never delete network switches or non-media players
            if not target or not target.startswith("media_player."):
                continue

            st_state = self.hass.states.get(target) if target else None
            is_speaker = (
                any(k in target for k in ("speaker", "echo", "dot", "google_cast"))
                or target.endswith("_ma")
                or "_ma_" in target
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

        # 3. Ensure v2 schema fields exist for all devices (non-destructive migration)
        for dev_id, dev in devices.items():
            is_sw = (
                dev.get("device_type") == DEVICE_TYPE_NETWORK_SWITCH
                or dev.get("target_entity", "").startswith("switch.")
            )
            if "device_category" not in dev:
                dev["device_category"] = "network" if is_sw else "tv"
                modified = True
            if "icon" not in dev or not dev.get("icon"):
                cat = dev.get("device_category", "tv")
                icon_map = {
                    "tv": "mdi:television",
                    "tablet": "mdi:tablet-ipad",
                    "gaming": "mdi:controller",
                    "network": "mdi:wifi-lock",
                    "other": "mdi:devices",
                }
                dev["icon"] = icon_map.get(cat, "mdi:tablet-ipad" if is_sw else "mdi:television")
                modified = True
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
            if "daily_limit_mode" not in dev:
                dev["daily_limit_mode"] = "uniform"
                modified = True
            if "daily_limit_weekday_minutes" not in dev:
                dev["daily_limit_weekday_minutes"] = int(
                    dev.get("daily_limit_minutes") or DEFAULT_DAILY_LIMIT
                )
                modified = True
            if "daily_limit_weekend_minutes" not in dev:
                dev["daily_limit_weekend_minutes"] = max(
                    180, int(dev.get("daily_limit_minutes") or DEFAULT_DAILY_LIMIT)
                )
                modified = True
            if "bonus_minutes_today" not in dev:
                dev["bonus_minutes_today"] = 0
                modified = True
            if "daily_limit_overridden_today" not in dev:
                dev["daily_limit_overridden_today"] = False
                modified = True
            if "screen_time_entity" not in dev:
                dev["screen_time_entity"] = None
                modified = True
            if "manual_unlock_override" not in dev:
                dev["manual_unlock_override"] = False
                modified = True
            if "lock_until_midnight" not in dev:
                dev["lock_until_midnight"] = False
                modified = True
            if "active_schedule_name" not in dev:
                dev["active_schedule_name"] = None
                modified = True
            if "timer_mode" not in dev:
                dev["timer_mode"] = (
                    TIMER_MODE_UNLOCK if dev.get("timer_expires_at") else None
                )
                modified = True
            if "locked_reason" not in dev:
                if dev.get("locked"):
                    dev["locked_reason"] = (
                        REASON_SCHEDULE if dev.get("locked_by_schedule") else REASON_MANUAL
                    )
                else:
                    dev["locked_reason"] = None
                modified = True

            if "schedules" not in dev or not isinstance(dev["schedules"], list):
                legacy_rule = normalize_schedule_rule(
                    {
                        "id": "sched_default",
                        "name": "Downtime",
                        "enabled": True,
                        "days": dev.get("schedule_days", list(DAYS_OF_WEEK)),
                        "start": dev.get("schedule_start", "08:00"),
                        "end": dev.get("schedule_end", "20:00"),
                        "recurrence": dev.get("schedule_recurrence", RECURRENCE_WEEKLY),
                        "anchor_date": dev.get("schedule_anchor_date"),
                    },
                    index=0,
                )
                dev["schedules"] = [legacy_rule]
                modified = True
            else:
                normalized_rules = [
                    normalize_schedule_rule(r, idx)
                    for idx, r in enumerate(dev["schedules"])
                ]
                if normalized_rules != dev["schedules"]:
                    dev["schedules"] = normalized_rules
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
        """Get data for a specific device, or return empty dict."""
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

    # =========================================================================
    # PARENTAL PIN SECURITY
    # =========================================================================

    def get_public_security_settings(self) -> dict[str, Any]:
        """Return public security configuration without exposing PIN hash or salt."""
        sec = self.data.get("security", {})
        has_pin = bool(sec.get("pin_hash") and sec.get("pin_salt"))
        return {
            "pin_enabled": bool(sec.get("pin_enabled", False) and has_pin),
            "has_pin": has_pin,
            "require_pin_for_unlock": bool(sec.get("require_pin_for_unlock", True)),
            "require_pin_for_timers": bool(sec.get("require_pin_for_timers", True)),
            "require_pin_for_settings": bool(sec.get("require_pin_for_settings", True)),
        }

    def verify_pin(self, pin: str) -> bool:
        """Verify a candidate PIN in constant time."""
        sec = self.data.get("security", {})
        pin_hash = sec.get("pin_hash")
        pin_salt = sec.get("pin_salt")
        if not pin_hash or not pin_salt or not isinstance(pin, str):
            return False
        candidate_hash = _hash_pin(pin.strip(), pin_salt)
        return hmac.compare_digest(candidate_hash, pin_hash)

    async def async_update_security_settings(
        self,
        pin: str | None = None,
        pin_enabled: bool | None = None,
        require_pin_for_unlock: bool | None = None,
        require_pin_for_timers: bool | None = None,
        require_pin_for_settings: bool | None = None,
    ) -> dict[str, Any]:
        """Update Parental PIN and lock-policy settings and persist."""
        sec = self.data.setdefault("security", _default_security_data())
        if pin is not None:
            clean_pin = pin.strip()
            if clean_pin == "":
                sec["pin_hash"] = None
                sec["pin_salt"] = None
                sec["pin_enabled"] = False
            else:
                salt = secrets.token_hex(16)
                sec["pin_salt"] = salt
                sec["pin_hash"] = _hash_pin(clean_pin, salt)
                if pin_enabled is None:
                    sec["pin_enabled"] = True

        if pin_enabled is not None:
            sec["pin_enabled"] = bool(pin_enabled and sec.get("pin_hash"))
        if require_pin_for_unlock is not None:
            sec["require_pin_for_unlock"] = bool(require_pin_for_unlock)
        if require_pin_for_timers is not None:
            sec["require_pin_for_timers"] = bool(require_pin_for_timers)
        if require_pin_for_settings is not None:
            sec["require_pin_for_settings"] = bool(require_pin_for_settings)

        await self.async_save()
        return self.get_public_security_settings()

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
                    if (
                        any(k in mp for k in ("speaker", "echo", "dot", "google_cast"))
                        or mp.endswith("_ma")
                        or "_ma_" in mp
                    ):
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
            existing_dl_mode = existing_dev.get("daily_limit_mode")
            existing_dl_mins = existing_dev.get("daily_limit_minutes")
            existing_dl_wd = existing_dev.get("daily_limit_weekday_minutes")
            existing_dl_we = existing_dev.get("daily_limit_weekend_minutes")
            existing_st_ent = existing_dev.get("screen_time_entity")
            existing_icon = existing_dev.get("icon")
            existing_cat = existing_dev.get("device_category")

            device_payload = get_default_device_data(
                device_id=final_dev_id,
                target_entity=target_entity,
                name=friendly_name,
                icon=existing_icon,
                device_category=existing_cat,
            )
            imported_rule = normalize_schedule_rule(
                {
                    "id": "sched_default",
                    "name": "Downtime",
                    "enabled": True,
                    "days": sched_days,
                    "start": start_time,
                    "end": end_time,
                    "recurrence": RECURRENCE_WEEKLY,
                    "anchor_date": None,
                },
                index=0,
            )
            existing_schedules = existing_dev.get("schedules")
            schedules_to_save = (
                existing_schedules
                if isinstance(existing_schedules, list) and len(existing_schedules) > 1
                else [imported_rule]
            )
            updates: dict[str, Any] = {
                "locked": is_locked,
                "locked_by_schedule": existing_locked_by_sched,
                "locked_reason": (
                    REASON_SCHEDULE if (is_locked and existing_locked_by_sched) else (REASON_MANUAL if is_locked else None)
                ),
                "schedule_enabled": is_sched_en,
                "schedules": schedules_to_save,
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
            if existing_dl_mode is not None:
                updates["daily_limit_mode"] = existing_dl_mode
            if existing_dl_mins is not None:
                updates["daily_limit_minutes"] = existing_dl_mins
            if existing_dl_wd is not None:
                updates["daily_limit_weekday_minutes"] = existing_dl_wd
            if existing_dl_we is not None:
                updates["daily_limit_weekend_minutes"] = existing_dl_we
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
