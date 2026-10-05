"""Core logic coordinator for Passable Smart Screen Time Engine."""

from __future__ import annotations

import asyncio
from datetime import datetime, time, timedelta
import logging
from typing import Any

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_track_point_in_time,
    async_track_state_change_event,
    async_track_time_change,
)
import homeassistant.util.dt as dt_util

from .const import (
    APP_MAPPINGS,
    DAYS_OF_WEEK,
    DEVICE_TYPE_MEDIA_PLAYER,
    DEVICE_TYPE_NETWORK_SWITCH,
    IGNORED_APPS,
    RECURRENCE_BIWEEKLY,
    SIGNAL_DEVICE_UPDATED,
    SIGNAL_ENGINE_UPDATED,
)
from .storage import PassableScreenTimeStorage

_LOGGER = logging.getLogger(__name__)


def _is_time_in_range(start_str: str, end_str: str, current_time: time) -> bool:
    """Check if current time is within range, supporting overnight spans."""
    try:
        sh, sm = map(int, start_str.split(":")[:2])
        eh, em = map(int, end_str.split(":")[:2])
        start_t = time(sh, sm)
        end_t = time(eh, em)

        if start_t <= end_t:
            return start_t <= current_time <= end_t
        # Overnight range (e.g. 20:00 -> 06:00)
        return current_time >= start_t or current_time <= end_t
    except Exception:
        return False


def _get_monday_of_week(dt: datetime, offset_weeks: int = 0) -> str:
    """Return YYYY-MM-DD string for Monday of the given week."""
    weekday = dt.weekday()
    monday = dt - timedelta(days=weekday) + timedelta(weeks=offset_weeks)
    return monday.strftime("%Y-%m-%d")


def _is_biweekly_active_this_week(anchor_date_str: str | None) -> bool:
    """Check if bi-weekly schedule cycle is active during the current week."""
    if not anchor_date_str:
        return True
    try:
        anchor_dt = datetime.strptime(anchor_date_str, "%Y-%m-%d")
        now_dt = dt_util.now()
        current_monday = datetime.strptime(
            _get_monday_of_week(now_dt, 0), "%Y-%m-%d"
        )
        diff_weeks = (current_monday - anchor_dt).days // 7
        return (diff_weeks % 2) == 0
    except Exception:
        return True


class PassableScreenTimeEngine:
    """Engine coordinating device lockouts, countdown timers, schedules, and screen time telemetry."""

    def __init__(self, hass: HomeAssistant, storage: PassableScreenTimeStorage) -> None:
        """Initialize engine."""
        self.hass = hass
        self.storage = storage
        self._timer_unsubs: dict[str, CALLBACK_TYPE] = {}
        self._unsub_callbacks: list[CALLBACK_TYPE] = []
        self._device_state_listeners: list[CALLBACK_TYPE] = []
        self._enforcing_devices: set[str] = set()

    async def async_setup(self) -> None:
        """Initialize engine, restore timers, attach listeners and schedule evaluations."""
        await self.storage.async_load()

        # Restore active countdown timers from storage
        self._restore_timers()

        # Setup state change listeners for all tracked devices
        self.async_rebuild_device_listeners()

        # Track 1-minute interval for schedule checks & screen time accumulation
        unsub_min = async_track_time_change(
            self.hass, self._async_minute_check, second=0
        )
        self._unsub_callbacks.append(unsub_min)

        # Track daily midnight rollover to reset screen time counters
        unsub_midnight = async_track_time_change(
            self.hass, self._async_midnight_rollover, hour=0, minute=0, second=0
        )
        self._unsub_callbacks.append(unsub_midnight)

        # Initial schedule evaluation
        await self.async_evaluate_schedules()
        _LOGGER.info("Passable Screen Time Engine successfully initialized")

    def _restore_timers(self) -> None:
        """Restore active timers that survived a Home Assistant reboot."""
        now = dt_util.utcnow()
        devices = self.storage.get_all_devices()

        for dev_id, dev_data in devices.items():
            expires_str = dev_data.get("timer_expires_at")
            if not expires_str:
                continue

            try:
                expires_at = dt_util.parse_datetime(expires_str)
                if not expires_at:
                    continue

                if expires_at <= now:
                    # Timer expired while HA was offline
                    _LOGGER.info(
                        "Timer for %s expired while offline. Enforcing lockout.",
                        dev_id,
                    )
                    self.hass.async_create_task(
                        self._async_handle_timer_expired(dev_id)
                    )
                else:
                    # Reschedule active timer callback
                    remaining_secs = (expires_at - now).total_seconds()
                    _LOGGER.info(
                        "Restoring active timer for %s (%s seconds remaining)",
                        dev_id,
                        int(remaining_secs),
                    )

                    @callback
                    def _restore_cb(now_dt: datetime, d: str = dev_id) -> None:
                        self.hass.async_create_task(
                            self._async_handle_timer_expired(d)
                        )

                    unsub = async_track_point_in_time(
                        self.hass, _restore_cb, expires_at
                    )
                    self._timer_unsubs[dev_id] = unsub
            except Exception as err:
                _LOGGER.error("Failed to restore timer for %s: %s", dev_id, err)

    def async_rebuild_device_listeners(self) -> None:
        """Attach state change listeners to target entities."""
        for unsub in self._device_state_listeners:
            unsub()
        self._device_state_listeners.clear()

        devices = self.storage.get_all_devices()
        target_entities = [
            d.get("target_entity")
            for d in devices.values()
            if d.get("target_entity")
        ]

        if target_entities:
            unsub = async_track_state_change_event(
                self.hass, target_entities, self._async_handle_device_state_change
            )
            self._device_state_listeners.append(unsub)

    # =========================================================================
    # COUNTDOWN TIMER ACTIONS ("One More Show")
    # =========================================================================

    async def async_start_device_timer(
        self, device_id: str, duration: float | int, unit: str = "minutes"
    ) -> None:
        """Start a countdown access timer and unlock the device."""
        self.async_cancel_device_timer(device_id)

        dur = float(duration)
        delta = (
            timedelta(minutes=dur) if unit == "minutes" else timedelta(hours=dur)
        )
        expires_at = dt_util.utcnow() + delta

        # Update storage
        await self.storage.async_update_device(
            device_id,
            {
                "timer_expires_at": expires_at.isoformat(),
                "timer_duration": dur,
                "timer_unit": unit,
                "locked": False,
            },
        )

        # Unlock and turn ON device
        await self.async_set_device_lockout(
            device_id, locked=False, power_on=True
        )

        @callback
        def _timer_expired(now_dt: datetime, d: str = device_id) -> None:
            self.hass.async_create_task(self._async_handle_timer_expired(d))

        unsub = async_track_point_in_time(self.hass, _timer_expired, expires_at)
        self._timer_unsubs[device_id] = unsub

        _LOGGER.info(
            "Started %s %s timer for %s (Expires: %s)",
            dur,
            unit,
            device_id,
            expires_at.isoformat(),
        )
        async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)

    def async_cancel_device_timer(self, device_id: str) -> None:
        """Cancel active countdown timer."""
        if device_id in self._timer_unsubs:
            self._timer_unsubs[device_id]()
            del self._timer_unsubs[device_id]

        dev_data = self.storage.get_device(device_id)
        if dev_data.get("timer_expires_at"):
            self.hass.async_create_task(
                self.storage.async_update_device(
                    device_id, {"timer_expires_at": None}
                )
            )
            async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)

    async def _async_handle_timer_expired(self, device_id: str) -> None:
        """Handle expiration of temporary viewing timer: lock and force device off."""
        _LOGGER.info("Viewing timer expired for device %s. Enforcing lock.", device_id)
        if device_id in self._timer_unsubs:
            del self._timer_unsubs[device_id]

        await self.storage.async_update_device(
            device_id, {"timer_expires_at": None, "locked": True}
        )
        await self._async_enforce_device_locked(device_id)
        async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)

    # =========================================================================
    # LOCKOUT & POWER CONTROL
    # =========================================================================

    async def async_set_device_lockout(
        self, device_id: str, locked: bool, power_on: bool = False
    ) -> None:
        """Set lockout state and update hardware accordingly."""
        await self.storage.async_update_device(device_id, {"locked": locked})

        if locked:
            # If locking, cancel any active timer
            if device_id in self._timer_unsubs:
                self._timer_unsubs[device_id]()
                del self._timer_unsubs[device_id]
                await self.storage.async_update_device(
                    device_id, {"timer_expires_at": None}
                )
            await self._async_enforce_device_locked(device_id)
        elif power_on:
            await self._async_enforce_device_unlocked(device_id)

        async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)

    async def _async_enforce_device_locked(self, device_id: str) -> None:
        """Send turn-off or network pause command to hardware."""
        dev = self.storage.get_device(device_id)
        target = dev.get("target_entity")
        dev_type = dev.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)

        if not target or not self.hass.states.get(target):
            return

        self._enforcing_devices.add(device_id)
        try:
            if dev_type == DEVICE_TYPE_NETWORK_SWITCH:
                # Network switch: ON = paused
                await self.hass.services.async_call(
                    "switch", "turn_on", {"entity_id": target}
                )
            else:
                # Media player: turn OFF
                await self.hass.services.async_call(
                    "media_player", "turn_off", {"entity_id": target}
                )
        finally:
            await asyncio.sleep(0.5)
            self._enforcing_devices.discard(device_id)

    async def _async_enforce_device_unlocked(self, device_id: str) -> None:
        """Restore device access and optionally turn ON."""
        dev = self.storage.get_device(device_id)
        target = dev.get("target_entity")
        dev_type = dev.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)

        if not target or not self.hass.states.get(target):
            return

        if dev_type == DEVICE_TYPE_NETWORK_SWITCH:
            # Network switch: OFF = unpaused
            await self.hass.services.async_call(
                "switch", "turn_off", {"entity_id": target}
            )
        else:
            await self.hass.services.async_call(
                "media_player", "turn_on", {"entity_id": target}
            )

    # =========================================================================
    # SCHEDULE ENGINE & EVALUATION
    # =========================================================================

    async def async_evaluate_schedules(self) -> None:
        """Evaluate schedules for all managed devices."""
        now = dt_util.now()
        current_time = now.time()
        weekday_idx = (now.weekday() + 1) % 7  # 0=Sunday, 6=Saturday
        current_day = DAYS_OF_WEEK[weekday_idx]

        devices = self.storage.get_all_devices()

        for dev_id, dev in devices.items():
            if not dev.get("schedule_enabled", False):
                continue

            # Don't override an active timer
            if dev.get("timer_expires_at"):
                continue

            recurrence = dev.get("schedule_recurrence", "weekly")
            if recurrence == RECURRENCE_BIWEEKLY:
                anchor = dev.get("schedule_anchor_date")
                if not _is_biweekly_active_this_week(anchor):
                    continue

            active_days = dev.get("schedule_days", [])
            is_day_scheduled = current_day in active_days

            start_str = dev.get("schedule_start", "08:00")
            end_str = dev.get("schedule_end", "20:00")

            should_be_locked = is_day_scheduled and _is_time_in_range(
                start_str, end_str, current_time
            )

            # Auto-lock if schedule began
            if should_be_locked and not dev.get("locked", False):
                _LOGGER.info(
                    "Schedule window started for %s (%s -> %s). Locking.",
                    dev_id,
                    start_str,
                    end_str,
                )
                await self.async_set_device_lockout(dev_id, locked=True)

    # =========================================================================
    # STATE CHANGE INTERCEPTION & TELEMETRY
    # =========================================================================

    @callback
    def _async_handle_device_state_change(self, event: Any) -> None:
        """Intercept device state changes for bypass prevention and app tracking."""
        target_entity = event.data.get("entity_id")
        new_state = event.data.get("new_state")
        if not new_state:
            return

        # Find matching device
        device_id = None
        dev_data = None
        for did, d in self.storage.get_all_devices().items():
            if d.get("target_entity") == target_entity:
                device_id = did
                dev_data = d
                break

        if not device_id or not dev_data:
            return

        # 1. Enforce lockout if turned active while locked
        is_locked = dev_data.get("locked", False)
        dev_type = dev_data.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)

        is_active = False
        if dev_type == DEVICE_TYPE_NETWORK_SWITCH:
            is_active = new_state.state == "off"  # switch off = unpaused
        else:
            is_active = new_state.state in ["on", "playing", "idle"]

        if is_locked and is_active and device_id not in self._enforcing_devices:
            _LOGGER.warning(
                "Unauthorized active state detected on locked device %s. Enforcing lockout.",
                device_id,
            )
            self.hass.async_create_task(
                self._async_enforce_device_locked(device_id)
            )

        # 2. Track Active Streaming App
        if is_active and dev_type == DEVICE_TYPE_MEDIA_PLAYER:
            raw_app = (
                new_state.attributes.get("app_id")
                or new_state.attributes.get("app_name")
                or new_state.attributes.get("source")
            )
            if raw_app:
                raw_clean = str(raw_app).strip().lower()
                mapped_name = APP_MAPPINGS.get(raw_clean)
                if not mapped_name and raw_clean not in IGNORED_APPS:
                    mapped_name = str(raw_app).title()

                if mapped_name and mapped_name not in IGNORED_APPS:
                    apps_used = list(dev_data.get("apps_used_today", []))
                    if mapped_name not in apps_used:
                        apps_used.append(mapped_name)

                    self.hass.async_create_task(
                        self.storage.async_update_device(
                            device_id,
                            {
                                "active_app": mapped_name,
                                "apps_used_today": apps_used,
                            },
                        )
                    )
                    async_dispatcher_send(
                        self.hass, SIGNAL_DEVICE_UPDATED, device_id
                    )
        elif not is_active:
            if dev_data.get("active_app") != "None":
                self.hass.async_create_task(
                    self.storage.async_update_device(
                        device_id, {"active_app": "None"}
                    )
                )
                async_dispatcher_send(
                    self.hass, SIGNAL_DEVICE_UPDATED, device_id
                )

    @callback
    def _async_minute_check(self, now: datetime) -> None:
        """Every minute: accumulate screen time minutes and evaluate schedules."""
        devices = self.storage.get_all_devices()
        has_updates = False

        for dev_id, dev in devices.items():
            target = dev.get("target_entity")
            if not target:
                continue

            state_obj = self.hass.states.get(target)
            if not state_obj:
                continue

            dev_type = dev.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)
            is_active = (
                state_obj.state in ["on", "playing", "idle"]
                if dev_type == DEVICE_TYPE_MEDIA_PLAYER
                else state_obj.state == "off"
            )

            if is_active:
                current_mins = dev.get("screen_time_today_minutes", 0)
                dev["screen_time_today_minutes"] = current_mins + 1
                has_updates = True

        if has_updates:
            self.hass.async_create_task(self.storage.async_save())
            async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

        # Run schedule checks
        self.hass.async_create_task(self.async_evaluate_schedules())

    @callback
    def _async_midnight_rollover(self, now: datetime) -> None:
        """Midnight rollover: reset daily screen time and apps used."""
        _LOGGER.info("Rolling over daily screen time stats at midnight")
        devices = self.storage.get_all_devices()
        for dev in devices.values():
            dev["screen_time_today_minutes"] = 0
            dev["apps_used_today"] = []

        self.hass.async_create_task(self.storage.async_save())
        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

    async def async_unload(self) -> None:
        """Cancel all registered listeners and timers on unload."""
        for unsub in self._unsub_callbacks:
            unsub()
        self._unsub_callbacks.clear()

        for unsub in self._device_state_listeners:
            unsub()
        self._device_state_listeners.clear()

        for unsub in self._timer_unsubs.values():
            unsub()
        self._timer_unsubs.clear()
