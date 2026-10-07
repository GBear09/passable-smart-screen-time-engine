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

try:
    from homeassistant.components.recorder import get_instance
    from homeassistant.components.recorder.history import state_changes_during_period

    HAVE_RECORDER = True
except ImportError:
    HAVE_RECORDER = False

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


def _calculate_screen_time_from_states(
    states: list[Any],
    start_time: datetime,
    end_time: datetime,
    is_switch: bool = False,
) -> tuple[int, list[str], str]:
    """Calculate total active minutes, apps used, and current active app from state history."""
    start_utc = dt_util.as_utc(start_time)
    end_utc = dt_util.as_utc(end_time)

    if not states:
        return 0, [], "None"

    sorted_states = sorted(
        states,
        key=lambda s: dt_util.as_utc(s.last_changed)
        if getattr(s, "last_changed", None)
        else start_utc,
    )

    total_seconds = 0.0
    apps_used: list[str] = []
    active_app = "None"

    for i, state in enumerate(sorted_states):
        if is_switch:
            is_active = state.state == "off"  # switch off = unpaused
        else:
            is_active = state.state not in [
                "off",
                "standby",
                "unavailable",
                "unknown",
            ]

        # Extract active application from media player attributes
        if not is_switch and is_active and hasattr(state, "attributes"):
            raw_app = (
                state.attributes.get("app_id")
                or state.attributes.get("app_name")
                or state.attributes.get("source")
            )
            if raw_app:
                raw_clean = str(raw_app).strip().lower()
                mapped_name = APP_MAPPINGS.get(raw_clean)
                if not mapped_name and raw_clean not in IGNORED_APPS:
                    mapped_name = str(raw_app).title()
                if mapped_name and mapped_name not in IGNORED_APPS:
                    if mapped_name not in apps_used:
                        apps_used.append(mapped_name)
                    if i == len(sorted_states) - 1:
                        active_app = mapped_name
        elif i == len(sorted_states) - 1:
            active_app = "None"

        if not is_active:
            continue

        state_start = (
            dt_util.as_utc(state.last_changed)
            if getattr(state, "last_changed", None)
            else start_utc
        )
        if state_start < start_utc:
            state_start = start_utc

        if i + 1 < len(sorted_states):
            next_state = sorted_states[i + 1]
            state_end = (
                dt_util.as_utc(next_state.last_changed)
                if getattr(next_state, "last_changed", None)
                else end_utc
            )
        else:
            state_end = end_utc

        if state_end > end_utc:
            state_end = end_utc

        duration = (state_end - state_start).total_seconds()
        if duration > 0:
            total_seconds += duration

    total_minutes = int(round(total_seconds / 60.0))
    return total_minutes, apps_used, active_app


class PassableScreenTimeEngine:
    """Engine coordinating device lockouts, countdown timers, schedules, and screen time telemetry."""

    def __init__(
        self,
        hass: HomeAssistant,
        storage: PassableScreenTimeStorage,
        entry_id: str | None = None,
    ) -> None:
        """Initialize engine."""
        self.hass = hass
        self.storage = storage
        self.entry_id = entry_id
        self._timer_unsubs: dict[str, CALLBACK_TYPE] = {}
        self._unsub_callbacks: list[CALLBACK_TYPE] = []
        self._device_state_listeners: list[CALLBACK_TYPE] = []
        self._enforcing_devices: set[str] = set()
        self._active_restrictions: set[str] = set()

    async def async_setup(self) -> None:
        """Initialize engine, restore timers, attach listeners and schedule evaluations."""
        await self.storage.async_load()

        # Check date rollover on startup
        today_str = dt_util.now().strftime("%Y-%m-%d")
        for dev in self.storage.get_all_devices().values():
            if dev.get("screen_time_date") != today_str:
                dev["screen_time_today_minutes"] = 0
                dev["apps_used_today"] = []
                dev["screen_time_date"] = today_str

        # Reconcile today's screen time from recorder history
        await self.async_reconcile_all_screen_time()

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

    async def async_reconcile_device_screen_time(self, device_id: str) -> None:
        """Reconcile today's screen time and apps used for a device from HA recorder."""
        if not HAVE_RECORDER or "recorder" not in self.hass.config.components:
            return

        dev = self.storage.get_device(device_id)
        if not dev.get("track_screen_time", True):
            # Screen time tracking is disabled for this device (e.g. router network switch)
            if dev.get("screen_time_today_minutes", 0) != 0:
                await self.storage.async_update_device(
                    device_id, {"screen_time_today_minutes": 0, "apps_used_today": []}
                )
                async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)
            return

        target = dev.get("screen_time_entity") or dev.get("target_entity")
        if not target:
            return

        now = dt_util.now()
        start_of_day = dt_util.start_of_local_day(now)
        dev_type = dev.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)
        is_switch = (
            target.startswith("switch.") or target.startswith("binary_sensor.")
            if dev.get("screen_time_entity")
            else dev_type == DEVICE_TYPE_NETWORK_SWITCH
        )

        def _fetch_states():
            return state_changes_during_period(
                self.hass,
                start_time=start_of_day,
                end_time=now,
                entity_id=target,
                no_attributes=False,
                include_start_time_state=True,
            )

        try:
            recorder_inst = get_instance(self.hass)
            states_by_entity = await recorder_inst.async_add_executor_job(_fetch_states)
            states = states_by_entity.get(target, [])
            if not states and len(states_by_entity) == 1:
                states = list(states_by_entity.values())[0]

            if not states:
                current_state = self.hass.states.get(target)
                if current_state:
                    states = [current_state]

            if states:
                minutes, apps, active_app = _calculate_screen_time_from_states(
                    states, start_of_day, now, is_switch=is_switch
                )
                current_mins = dev.get("screen_time_today_minutes", 0)
                reconciled_mins = max(current_mins, minutes)

                merged_apps = list(dev.get("apps_used_today", []))
                for app in apps:
                    if app not in merged_apps:
                        merged_apps.append(app)

                updates: dict[str, Any] = {
                    "screen_time_today_minutes": reconciled_mins,
                    "screen_time_date": now.strftime("%Y-%m-%d"),
                    "apps_used_today": merged_apps,
                }
                if active_app != "None" or not dev.get("active_app"):
                    updates["active_app"] = active_app

                await self.storage.async_update_device(device_id, updates)
                _LOGGER.debug(
                    "Reconciled screen time for %s: %s mins, active: %s, apps: %s",
                    device_id,
                    reconciled_mins,
                    active_app,
                    merged_apps,
                )
                async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)
        except Exception as err:
            _LOGGER.warning(
                "Could not reconcile screen time from recorder for %s: %s",
                device_id,
                err,
            )

    async def async_reconcile_all_screen_time(self) -> None:
        """Reconcile screen time from recorder for all managed devices."""
        for dev_id in list(self.storage.get_all_devices().keys()):
            await self.async_reconcile_device_screen_time(dev_id)

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

        # Track global household restrictions (e.g. potty request)
        restriction_entities = [
            r.get("entity")
            for r in self.storage.get_global_restrictions()
            if r.get("entity")
        ]
        if restriction_entities:
            self._active_restrictions = {
                e
                for e in restriction_entities
                if self.hass.states.get(e) and self.hass.states.get(e).state == "on"
            }
            unsub_restr = async_track_state_change_event(
                self.hass, restriction_entities, self._async_handle_restriction_state_change
            )
            self._device_state_listeners.append(unsub_restr)

    @callback
    def _async_handle_restriction_state_change(self, event: Any) -> None:
        """Handle state changes in global restrictions."""
        entity_id = event.data.get("entity_id")
        new_state = event.data.get("new_state")
        if not entity_id or not new_state:
            return

        if new_state.state == "on":
            self._active_restrictions.add(entity_id)
        else:
            self._active_restrictions.discard(entity_id)

        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)
        self.hass.async_create_task(self.async_evaluate_schedules())

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
            device_id, {"timer_expires_at": None}
        )
        await self.async_set_device_lockout(device_id, locked=True, power_on=False)

    # =========================================================================
    # LOCKOUT & POWER CONTROL
    # =========================================================================

    def is_device_in_schedule_window(self, dev: dict[str, Any]) -> bool:
        """Check if device is currently scheduled and inside an active downtime window."""
        if not dev.get("schedule_enabled", False):
            return False

        recurrence = dev.get("schedule_recurrence", "weekly")
        if recurrence == RECURRENCE_BIWEEKLY:
            anchor = dev.get("schedule_anchor_date")
            if not _is_biweekly_active_this_week(anchor):
                return False

        now = dt_util.now()
        current_time = now.time()
        weekday_idx = (now.weekday() + 1) % 7
        current_day = DAYS_OF_WEEK[weekday_idx]
        active_days = dev.get("schedule_days", [])

        if current_day not in active_days:
            return False

        start_str = dev.get("schedule_start", "08:00")
        end_str = dev.get("schedule_end", "20:00")
        return _is_time_in_range(start_str, end_str, current_time)

    async def async_set_device_lockout(
        self,
        device_id: str,
        locked: bool,
        power_on: bool = False,
        by_schedule: bool = False,
    ) -> None:
        """Set lockout state and update hardware accordingly."""
        updates: dict[str, Any] = {"locked": locked}
        dev = self.storage.get_device(device_id)

        if locked:
            updates["locked_by_schedule"] = by_schedule
            updates["manual_unlock_override"] = False
        else:
            updates["locked_by_schedule"] = False
            # If unlocking manually while an active schedule window is running, set manual override
            if not by_schedule and self.is_device_in_schedule_window(dev):
                updates["manual_unlock_override"] = True
                _LOGGER.info(
                    "Manual unlock override enabled for %s during active schedule window. Device will remain unlocked.",
                    device_id,
                )
            else:
                updates["manual_unlock_override"] = False

        await self.storage.async_update_device(device_id, updates)

        if locked:
            # If locking, cancel any active timer
            if device_id in self._timer_unsubs:
                self._timer_unsubs[device_id]()
                del self._timer_unsubs[device_id]
                await self.storage.async_update_device(
                    device_id, {"timer_expires_at": None}
                )
            await self._async_enforce_device_locked(device_id)
        else:
            dev_type = dev.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)
            if power_on or dev_type == DEVICE_TYPE_NETWORK_SWITCH:
                await self._async_enforce_device_unlocked(device_id)

        async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)

    async def async_toggle_all_lockouts(self) -> None:
        """Master toggle: if any device is locked, unlock all; otherwise lock all."""
        devices = self.storage.get_all_devices()
        if not devices:
            return

        any_locked = any(d.get("locked", False) for d in devices.values()) or bool(
            self._active_restrictions
        )
        target_locked = not any_locked

        for dev_id in devices:
            await self.async_set_device_lockout(
                dev_id, locked=target_locked, power_on=False
            )

    async def async_set_all_lockouts(
        self, locked: bool, power_on: bool = False
    ) -> None:
        """Set lockout state for all managed devices."""
        devices = self.storage.get_all_devices()
        for dev_id in devices:
            await self.async_set_device_lockout(
                dev_id, locked=locked, power_on=power_on
            )

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
                # Schedule is disabled; clear manual override if set
                if dev.get("manual_unlock_override", False):
                    await self.storage.async_update_device(
                        dev_id, {"manual_unlock_override": False}
                    )
                # If device was locked by schedule, and schedule is now disabled, auto-unlock it
                if dev.get("locked", False) and dev.get("locked_by_schedule", False):
                    _LOGGER.info(
                        "Schedule disabled for %s while locked by schedule. Auto-unlocking.",
                        dev_id,
                    )
                    await self.async_set_device_lockout(
                        dev_id, locked=False, power_on=False, by_schedule=False
                    )
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
                if dev.get("manual_unlock_override", False):
                    _LOGGER.debug(
                        "Manual unlock override active for %s during schedule window (%s -> %s). Skipping lock.",
                        dev_id,
                        start_str,
                        end_str,
                    )
                    continue

                _LOGGER.info(
                    "Schedule window started for %s (%s -> %s). Locking.",
                    dev_id,
                    start_str,
                    end_str,
                )
                await self.async_set_device_lockout(
                    dev_id, locked=True, by_schedule=True
                )
            elif (
                should_be_locked
                and dev.get("locked", False)
                and not dev.get("locked_by_schedule", False)
            ):
                # Device is locked during active schedule window; mark schedule origin
                await self.storage.async_update_device(
                    dev_id, {"locked_by_schedule": True}
                )
            elif (
                not should_be_locked
                and dev.get("locked", False)
                and dev.get("locked_by_schedule", False)
            ):
                if self._active_restrictions:
                    _LOGGER.debug(
                        "Schedule ended for %s, but global restriction active. Postponing unlock.",
                        dev_id,
                    )
                    continue

                _LOGGER.info(
                    "Schedule window ended for %s (%s -> %s). Auto-unlocking.",
                    dev_id,
                    start_str,
                    end_str,
                )
                await self.async_set_device_lockout(
                    dev_id, locked=False, power_on=False, by_schedule=False
                )
            elif not should_be_locked and dev.get("manual_unlock_override", False):
                # Active schedule window ended; clear manual override flag for next cycle
                _LOGGER.debug(
                    "Schedule window ended for %s. Resetting manual_unlock_override.",
                    dev_id,
                )
                await self.storage.async_update_device(
                    dev_id, {"manual_unlock_override": False}
                )

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
            is_active = new_state.state not in [
                "off",
                "standby",
                "unavailable",
                "unknown",
            ]

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

        # 3. Schedule recorder reconciliation after state change
        if dev_data.get("track_screen_time", True):
            async def _delayed_reconcile() -> None:
                await asyncio.sleep(2.0)
                await self.async_reconcile_device_screen_time(device_id)

            self.hass.async_create_task(_delayed_reconcile())

    @callback
    def _async_minute_check(self, now: datetime) -> None:
        """Every minute: accumulate screen time minutes and evaluate schedules."""
        devices = self.storage.get_all_devices()
        has_updates = False

        for dev_id, dev in devices.items():
            if not dev.get("track_screen_time", True):
                continue

            target = dev.get("screen_time_entity") or dev.get("target_entity")
            if not target:
                continue

            state_obj = self.hass.states.get(target)
            if not state_obj:
                continue

            dev_type = dev.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)
            is_switch = (
                target.startswith("switch.") or target.startswith("binary_sensor.")
                if dev.get("screen_time_entity")
                else dev_type == DEVICE_TYPE_NETWORK_SWITCH
            )
            is_active = (
                state_obj.state in ["on", "active"]
                if is_switch and dev.get("screen_time_entity")
                else (
                    state_obj.state == "off"
                    if is_switch
                    else state_obj.state
                    not in ["off", "standby", "unavailable", "unknown"]
                )
            )

            if is_active:
                current_mins = dev.get("screen_time_today_minutes", 0)
                new_mins = current_mins + 1
                dev["screen_time_today_minutes"] = new_mins
                dev["screen_time_date"] = dt_util.now().strftime("%Y-%m-%d")
                has_updates = True

                # Check daily limit auto-lockout
                if dev.get("daily_limit_enabled", False):
                    limit_mins = dev.get("daily_limit_minutes", 120)
                    if new_mins >= limit_mins and not dev.get("locked", False):
                        _LOGGER.info(
                            "Daily screen time limit reached for %s (%s mins). Locking device.",
                            dev_id,
                            limit_mins,
                        )
                        self.hass.async_create_task(
                            self.async_set_device_lockout(dev_id, locked=True)
                        )

        if has_updates:
            self.hass.async_create_task(self.storage.async_save())
            async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

        # Run schedule checks
        self.hass.async_create_task(self.async_evaluate_schedules())

    @callback
    def _async_midnight_rollover(self, now: datetime) -> None:
        """Midnight rollover: reset daily screen time and apps used."""
        _LOGGER.info("Rolling over daily screen time stats at midnight")
        today_str = now.strftime("%Y-%m-%d")
        devices = self.storage.get_all_devices()
        for dev in devices.values():
            dev["screen_time_today_minutes"] = 0
            dev["apps_used_today"] = []
            dev["screen_time_date"] = today_str

        self.hass.async_create_task(self.storage.async_save())
        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

    async def async_remove_device_and_cleanup(self, device_id: str) -> None:
        """Remove a device from storage, cancel timers, unsubscribe listeners, and delete HA entities."""
        _LOGGER.info("Permanently removing device %s from screen time engine", device_id)
        # 1. Cancel timer if active
        self.async_cancel_device_timer(device_id)

        # 2. Remove from storage
        await self.storage.async_remove_device(device_id)

        # 3. Clean up from HA entity registry
        if self.entry_id:
            try:
                from homeassistant.helpers import entity_registry as er
                ent_reg = er.async_get(self.hass)
                to_remove = [
                    entity_id
                    for entity_id, reg_entry in ent_reg.entities.items()
                    if reg_entry.config_entry_id == self.entry_id
                    and (
                        reg_entry.unique_id.endswith(f"_{device_id}")
                        or reg_entry.unique_id == f"passable_screen_time_lockout_{device_id}"
                        or reg_entry.unique_id == f"passable_screen_time_schedule_{device_id}"
                        or reg_entry.unique_id == f"passable_screen_time_usage_{device_id}"
                        or reg_entry.unique_id == f"passable_screen_time_app_{device_id}"
                        or reg_entry.unique_id == f"passable_screen_time_schedule_active_{device_id}"
                    )
                ]
                for eid in to_remove:
                    _LOGGER.info("Removing entity %s for deleted device %s", eid, device_id)
                    ent_reg.async_remove(eid)
            except Exception as err:
                _LOGGER.warning("Error cleaning up entities for device %s: %s", device_id, err)

        # 4. Rebuild listeners and notify listeners
        self.async_rebuild_device_listeners()
        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)
        async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)

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
