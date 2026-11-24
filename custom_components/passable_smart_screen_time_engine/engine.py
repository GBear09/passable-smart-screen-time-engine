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
    CONF_DEVICES,
    CONF_GLOBAL_RESTRICTIONS,
    DAYS_OF_WEEK,
    DEFAULT_DAILY_LIMIT,
    DEVICE_TYPE_MEDIA_PLAYER,
    DEVICE_TYPE_NETWORK_SWITCH,
    DOMAIN,
    IGNORED_APPS,
    REASON_DAILY_LIMIT,
    REASON_MANUAL,
    REASON_REST_OF_DAY,
    REASON_RESTRICTION,
    REASON_SCHEDULE,
    REASON_TIMER,
    RECURRENCE_BIWEEKLY,
    RECURRENCE_WEEKLY,
    SIGNAL_DEVICE_ADDED,
    SIGNAL_DEVICE_UPDATED,
    SIGNAL_ENGINE_UPDATED,
    SIGNAL_STORAGE_UPDATED,
    TIMER_MODE_LOCK,
    TIMER_MODE_UNLOCK,
    TIMER_MODE_WIND_DOWN,
    VALID_TIMER_MODES,
)
from .storage import (
    PassableScreenTimeStorage,
    get_default_device_data,
    normalize_schedule_rule,
)

_LOGGER = logging.getLogger(__name__)


def _parse_hhmm(time_str: str | None) -> time | None:
    """Parse an HH:MM string into a datetime.time object."""
    if not isinstance(time_str, str):
        return None
    parts = time_str.strip().split(":")
    if len(parts) < 2:
        return None
    try:
        hour = int(parts[0])
        minute = int(parts[1])
        return time(hour, minute)
    except (TypeError, ValueError):
        return None


def _get_monday_of_week(dt: datetime, offset_weeks: int = 0) -> str:
    """Return YYYY-MM-DD string for Monday of the given week."""
    weekday = dt.weekday()
    monday = dt - timedelta(days=weekday) + timedelta(weeks=offset_weeks)
    return monday.strftime("%Y-%m-%d")


def _is_biweekly_active_for_date(
    anchor_date_str: str | None, target_dt: datetime
) -> bool:
    """Check if bi-weekly schedule cycle is active during target_dt's week."""
    if not anchor_date_str:
        return True
    try:
        anchor_dt = datetime.strptime(anchor_date_str, "%Y-%m-%d")
        target_monday = datetime.strptime(
            _get_monday_of_week(target_dt, 0), "%Y-%m-%d"
        )
        diff_weeks = (target_monday - anchor_dt).days // 7
        return (diff_weeks % 2) == 0
    except Exception:
        return True


def _is_biweekly_active_this_week(anchor_date_str: str | None) -> bool:
    """Check if bi-weekly schedule cycle is active during the current week."""
    return _is_biweekly_active_for_date(anchor_date_str, dt_util.now())


def _is_time_in_range(start_str: str, end_str: str, current_time: time) -> bool:
    """Check if current time is within range, supporting overnight spans."""
    start_t = _parse_hhmm(start_str)
    end_t = _parse_hhmm(end_str)
    if start_t is None or end_t is None:
        return False
    if start_t == end_t:
        return True
    if start_t < end_t:
        return start_t <= current_time < end_t
    return current_time >= start_t or current_time < end_t


def _is_schedule_rule_active(rule: dict[str, Any], now_dt: datetime) -> bool:
    """Evaluate a single schedule rule against a local datetime, fixing overnight weekday rollover."""
    if not rule.get("enabled", True):
        return False

    days = set(rule.get("days") or [])
    if not days:
        return False

    start_str = rule.get("start", "20:00")
    end_str = rule.get("end", "07:00")
    start_t = _parse_hhmm(start_str)
    end_t = _parse_hhmm(end_str)
    if start_t is None or end_t is None:
        return False

    recurrence = rule.get("recurrence", RECURRENCE_WEEKLY)
    anchor = rule.get("anchor_date")

    today_day = DAYS_OF_WEEK[(now_dt.weekday() + 1) % 7]
    yesterday_dt = now_dt - timedelta(days=1)
    yesterday_day = DAYS_OF_WEEK[(yesterday_dt.weekday() + 1) % 7]

    biweekly_today = (
        recurrence != RECURRENCE_BIWEEKLY
        or _is_biweekly_active_for_date(anchor, now_dt)
    )
    biweekly_yesterday = (
        recurrence != RECURRENCE_BIWEEKLY
        or _is_biweekly_active_for_date(anchor, yesterday_dt)
    )

    if start_t == end_t or (start_str == "00:00" and end_str == "23:59"):
        return today_day in days and biweekly_today

    current_t = now_dt.time()
    if start_t < end_t:
        return today_day in days and biweekly_today and (start_t <= current_t < end_t)

    # Overnight window (e.g. 20:00 -> 07:00):
    # Evening segment checks today's weekday/biweekly; post-midnight checks yesterday's.
    if current_t >= start_t:
        return today_day in days and biweekly_today
    if current_t < end_t:
        return yesterday_day in days and biweekly_yesterday
    return False


def _get_device_rules(dev: dict[str, Any]) -> list[dict[str, Any]]:
    """Return normalized schedule rules for a device, falling back to legacy fields."""
    rules = dev.get("schedules")
    if isinstance(rules, list) and rules:
        return rules
    if "schedule_days" in dev or "schedule_start" in dev or "schedule_end" in dev:
        return [
            {
                "id": "sched_default",
                "name": "Downtime",
                "enabled": True,
                "days": dev.get("schedule_days", list(DAYS_OF_WEEK)),
                "start": dev.get("schedule_start", "08:00"),
                "end": dev.get("schedule_end", "20:00"),
                "recurrence": dev.get("schedule_recurrence", RECURRENCE_WEEKLY),
                "anchor_date": dev.get("schedule_anchor_date"),
            }
        ]
    return []


def get_active_schedule_rule(
    dev: dict[str, Any], now_dt: datetime
) -> dict[str, Any] | None:
    """Return the first active schedule rule at now_dt, or None."""
    if not dev.get("schedule_enabled", False):
        return None
    for rule in _get_device_rules(dev):
        if _is_schedule_rule_active(rule, now_dt):
            return rule
    return None


def compute_next_schedule_transition(
    dev: dict[str, Any], now_dt: datetime
) -> dict[str, Any] | None:
    """Compute the next schedule lock/unlock transition within the next 7 days."""
    if not dev.get("schedule_enabled", False):
        return None
    rules = [r for r in _get_device_rules(dev) if r.get("enabled", True) and r.get("days")]
    if not rules:
        return None

    currently_active = get_active_schedule_rule(dev, now_dt)
    currently_locked = currently_active is not None

    candidate_times: set[datetime] = set()
    base_date = now_dt.date()
    tzinfo = now_dt.tzinfo

    for day_offset in range(0, 8):
        target_date = base_date + timedelta(days=day_offset)
        for rule in rules:
            for field in ("start", "end"):
                parsed_t = _parse_hhmm(rule.get(field))
                if parsed_t is None:
                    continue
                cand = datetime.combine(target_date, parsed_t, tzinfo=tzinfo)
                if cand > now_dt:
                    candidate_times.add(cand)

    for cand in sorted(candidate_times):
        if (cand - now_dt).total_seconds() > 7 * 86400:
            break
        future_rule = get_active_schedule_rule(dev, cand)
        future_locked = future_rule is not None
        if future_locked != currently_locked:
            if cand.date() == now_dt.date():
                day_label = "Today"
            elif cand.date() == (now_dt + timedelta(days=1)).date():
                day_label = "Tomorrow"
            else:
                day_label = cand.strftime("%a")
            return {
                "action": "unlock" if currently_locked else "lock",
                "time": cand.strftime("%H:%M"),
                "day": day_label,
                "rule_name": (
                    currently_active.get("name", "Schedule")
                    if currently_locked and currently_active
                    else (future_rule.get("name", "Schedule") if future_rule else "Schedule")
                ),
                "at": cand.isoformat(),
            }
    return None


def compute_effective_daily_limit(
    dev: dict[str, Any], now_dt: datetime
) -> int | None:
    """Compute today's effective daily screen time limit in minutes (including bonus)."""
    if not dev.get("track_screen_time", True) or not dev.get("daily_limit_enabled", False):
        return None

    if dev.get("daily_limit_mode") == "weekday_weekend":
        is_weekend = now_dt.weekday() in (5, 6)  # Saturday (5) or Sunday (6)
        base_raw = (
            dev.get("daily_limit_weekend_minutes")
            if is_weekend
            else dev.get("daily_limit_weekday_minutes")
        )
        base = int(base_raw if base_raw is not None else (dev.get("daily_limit_minutes") or DEFAULT_DAILY_LIMIT))
    else:
        base = int(dev.get("daily_limit_minutes") or DEFAULT_DAILY_LIMIT)

    bonus = int(dev.get("bonus_minutes_today") or 0)
    return max(0, base + bonus)


def compute_expires_at(
    now_local: datetime,
    duration: float | int | None = None,
    unit: str = "minutes",
    until_time: str | None = None,
) -> tuple[datetime, float]:
    """Compute UTC expiration datetime and duration in minutes."""
    if until_time:
        target_t = _parse_hhmm(until_time)
        if target_t is None:
            raise ValueError(f"Invalid until_time '{until_time}'")
        target_local = datetime.combine(
            now_local.date(), target_t, tzinfo=now_local.tzinfo
        )
        if target_local <= now_local:
            target_local = target_local + timedelta(days=1)
        expires_at = dt_util.as_utc(target_local)
        dur_mins = max(1.0, (target_local - now_local).total_seconds() / 60.0)
        return expires_at, round(dur_mins, 1)

    dur = max(1.0, float(duration if duration is not None else 20))
    delta = timedelta(minutes=dur) if unit == "minutes" else timedelta(hours=dur)
    expires_at = dt_util.as_utc(now_local) + delta
    dur_mins = dur if unit == "minutes" else dur * 60.0
    return expires_at, round(dur_mins, 1)


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
        self._enforce_tasks: dict[str, asyncio.Task] = {}
        self._last_enforce_time: dict[str, float] = {}
        self._active_restrictions: set[str] = set()
        self._syncing_options: bool = False

    def _is_device_active(
        self, state_str: str | None, dev_type: str = DEVICE_TYPE_MEDIA_PLAYER
    ) -> bool:
        """Check if a state string represents an active device."""
        if not state_str:
            return False
        if dev_type == DEVICE_TYPE_NETWORK_SWITCH:
            return state_str == "off"  # switch off = unpaused
        return state_str not in ["off", "standby", "unavailable", "unknown"]

    def _is_target_active(
        self, target: str, dev_type: str = DEVICE_TYPE_MEDIA_PLAYER
    ) -> bool:
        """Check if target entity is currently active in Home Assistant."""
        state_obj = self.hass.states.get(target)
        if not state_obj:
            return False
        return self._is_device_active(state_obj.state, dev_type)

    async def async_setup(self) -> None:
        """Initialize engine, restore timers, attach listeners and schedule evaluations."""
        await self.storage.async_load()

        # Check date rollover on startup
        today_str = dt_util.now().strftime("%Y-%m-%d")
        date_changed = False
        for dev in self.storage.get_all_devices().values():
            if dev.get("screen_time_date") != today_str:
                dev["screen_time_today_minutes"] = 0
                dev["apps_used_today"] = []
                dev["bonus_minutes_today"] = 0
                dev["daily_limit_overridden_today"] = False
                dev["screen_time_date"] = today_str
                if dev.get("lock_until_midnight") or dev.get("locked_reason") == REASON_DAILY_LIMIT:
                    dev["lock_until_midnight"] = False
                    dev["locked"] = False
                    dev["locked_by_schedule"] = False
                    dev["locked_reason"] = None
                date_changed = True

        if date_changed:
            await self.storage.async_save()

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
        if not dev:
            return
        if not dev.get("track_screen_time", True):
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
                    _LOGGER.info(
                        "Timer for %s expired while offline. Handling expiry.",
                        dev_id,
                    )
                    self.hass.async_create_task(
                        self._async_handle_timer_expired(dev_id)
                    )
                else:
                    remaining_secs = (expires_at - now).total_seconds()
                    _LOGGER.info(
                        "Restoring active %s timer for %s (%s seconds remaining)",
                        dev_data.get("timer_mode") or TIMER_MODE_UNLOCK,
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
        """Attach state change listeners to target entities, screen_time_entities, and global restrictions."""
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

        extra_st_entities = [
            d.get("screen_time_entity")
            for d in devices.values()
            if d.get("screen_time_entity") and d.get("screen_time_entity") not in target_entities
        ]
        if extra_st_entities:
            @callback
            def _handle_st_change(event: Any) -> None:
                async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

            unsub_st = async_track_state_change_event(
                self.hass, extra_st_entities, _handle_st_change
            )
            self._device_state_listeners.append(unsub_st)

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
        else:
            self._active_restrictions = set()

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
    # COUNTDOWN TIMER ACTIONS (ALLOW / LOCK / WIND-DOWN)
    # =========================================================================

    def _has_active_timer(self, dev: dict[str, Any]) -> bool:
        """Return True if device currently has a non-expired timer."""
        expires_str = dev.get("timer_expires_at")
        if not expires_str:
            return False
        expires_dt = dt_util.parse_datetime(expires_str)
        return bool(expires_dt and expires_dt > dt_util.utcnow())

    async def async_start_device_timer(
        self,
        device_id: str,
        duration: float | int = 20,
        unit: str = "minutes",
        mode: str = TIMER_MODE_UNLOCK,
        until_time: str | None = None,
        power_on: bool = False,
    ) -> None:
        """Start an unlock, temporary lock, or wind-down countdown timer."""
        if device_id in ("all", "*", ""):
            for did in list(self.storage.get_all_devices().keys()):
                await self.async_start_device_timer(
                    did,
                    duration=duration,
                    unit=unit,
                    mode=mode,
                    until_time=until_time,
                    power_on=power_on,
                )
            return

        dev = self.storage.get_device(device_id)
        if not dev:
            _LOGGER.warning("Cannot start timer: unknown device_id %s", device_id)
            return

        if mode not in VALID_TIMER_MODES:
            mode = TIMER_MODE_UNLOCK

        if device_id in self._timer_unsubs:
            self._timer_unsubs.pop(device_id)()

        expires_at, dur_mins = compute_expires_at(
            dt_util.now(), duration=duration, unit=unit, until_time=until_time
        )

        stored_dur = float(duration) if not until_time and duration is not None else dur_mins
        stored_unit = "minutes" if until_time else unit

        await self.storage.async_update_device(
            device_id,
            {
                "timer_expires_at": expires_at.isoformat(),
                "timer_mode": mode,
                "timer_duration": stored_dur,
                "timer_unit": stored_unit,
                "lock_until_midnight": False,
            },
        )

        if mode == TIMER_MODE_UNLOCK:
            await self.async_set_device_lockout(
                device_id,
                locked=False,
                power_on=power_on,
                by_schedule=False,
                keep_timer=True,
            )
        elif mode == TIMER_MODE_WIND_DOWN:
            if dev.get("locked", False):
                await self.async_set_device_lockout(
                    device_id,
                    locked=False,
                    power_on=False,
                    by_schedule=False,
                    keep_timer=True,
                )
            else:
                if device_id in self._enforce_tasks:
                    task = self._enforce_tasks.pop(device_id)
                    if not task.done():
                        task.cancel()
                await self.storage.async_update_device(
                    device_id,
                    {
                        "locked": False,
                        "locked_by_schedule": False,
                        "locked_reason": None,
                        "active_schedule_name": None,
                    },
                )
        elif mode == TIMER_MODE_LOCK:
            await self.async_set_device_lockout(
                device_id,
                locked=True,
                power_on=False,
                by_schedule=False,
                reason=REASON_TIMER,
                keep_timer=True,
            )

        @callback
        def _timer_expired(now_dt: datetime, d: str = device_id) -> None:
            self.hass.async_create_task(self._async_handle_timer_expired(d))

        unsub = async_track_point_in_time(self.hass, _timer_expired, expires_at)
        self._timer_unsubs[device_id] = unsub

        _LOGGER.info(
            "Started %s timer for %s (Expires: %s)",
            mode,
            device_id,
            expires_at.isoformat(),
        )
        async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)
        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

    async def async_extend_device_timer(
        self, device_id: str, add_minutes: int
    ) -> bool:
        """Extend an active countdown timer by add_minutes."""
        if device_id in ("all", "*", ""):
            any_ext = False
            for did in list(self.storage.get_all_devices().keys()):
                if await self.async_extend_device_timer(did, add_minutes):
                    any_ext = True
            return any_ext

        dev = self.storage.get_device(device_id)
        expires_str = dev.get("timer_expires_at")
        if not dev or not expires_str:
            return False

        expires_at = dt_util.parse_datetime(expires_str)
        now_utc = dt_util.utcnow()
        base = max(now_utc, expires_at) if expires_at else now_utc
        new_expires = base + timedelta(minutes=max(1, int(add_minutes)))

        if device_id in self._timer_unsubs:
            self._timer_unsubs.pop(device_id)()

        await self.storage.async_update_device(
            device_id, {"timer_expires_at": new_expires.isoformat()}
        )

        @callback
        def _timer_expired(now_dt: datetime, d: str = device_id) -> None:
            self.hass.async_create_task(self._async_handle_timer_expired(d))

        self._timer_unsubs[device_id] = async_track_point_in_time(
            self.hass, _timer_expired, new_expires
        )
        async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)
        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)
        return True

    def async_cancel_device_timer(self, device_id: str) -> None:
        """Cancel active countdown timer."""
        if device_id in ("all", "*", ""):
            for did in list(self.storage.get_all_devices().keys()):
                self.async_cancel_device_timer(did)
            return

        if device_id in self._timer_unsubs:
            self._timer_unsubs[device_id]()
            del self._timer_unsubs[device_id]

        dev_data = self.storage.get_device(device_id)
        if dev_data.get("timer_expires_at") or dev_data.get("timer_mode"):
            async def _clear_and_eval() -> None:
                await self.storage.async_update_device(
                    device_id, {"timer_expires_at": None, "timer_mode": None}
                )
                async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)
                async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)
                await self.async_evaluate_schedules()

            self.hass.async_create_task(_clear_and_eval())

    async def _async_handle_timer_expired(self, device_id: str) -> None:
        """Handle timer expiry based on timer_mode (unlock/wind_down -> lock; lock -> unlock/handoff)."""
        dev = self.storage.get_device(device_id)
        mode = dev.get("timer_mode") or TIMER_MODE_UNLOCK
        _LOGGER.info("Timer (%s) expired for device %s.", mode, device_id)

        if device_id in self._timer_unsubs:
            del self._timer_unsubs[device_id]

        await self.storage.async_update_device(
            device_id, {"timer_expires_at": None, "timer_mode": None}
        )
        dev = self.storage.get_device(device_id)
        if not dev:
            return

        in_sched_rule = get_active_schedule_rule(dev, dt_util.now())
        has_restr = bool(self._active_restrictions)

        if mode in (TIMER_MODE_UNLOCK, TIMER_MODE_WIND_DOWN):
            reason = (
                REASON_RESTRICTION
                if has_restr
                else (REASON_SCHEDULE if in_sched_rule else REASON_TIMER)
            )
            await self.async_set_device_lockout(
                device_id,
                locked=True,
                power_on=False,
                by_schedule=bool(in_sched_rule or has_restr),
                reason=reason,
            )
            if in_sched_rule:
                await self.storage.async_update_device(
                    device_id, {"active_schedule_name": in_sched_rule.get("name")}
                )
        elif mode == TIMER_MODE_LOCK:
            if has_restr or in_sched_rule:
                await self.storage.async_update_device(
                    device_id,
                    {
                        "locked": True,
                        "locked_by_schedule": True,
                        "locked_reason": REASON_RESTRICTION if has_restr else REASON_SCHEDULE,
                        "active_schedule_name": in_sched_rule.get("name") if in_sched_rule else None,
                    },
                )
                async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)
                async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)
            else:
                await self.async_set_device_lockout(
                    device_id, locked=False, power_on=False, by_schedule=False
                )

    # =========================================================================
    # LOCKOUT, BONUS TIME & POWER CONTROL
    # =========================================================================

    def is_device_in_schedule_window(self, dev: dict[str, Any]) -> bool:
        """Check if device is currently inside an active downtime schedule window."""
        return get_active_schedule_rule(dev, dt_util.now()) is not None

    async def async_set_device_lockout(
        self,
        device_id: str,
        locked: bool,
        power_on: bool = False,
        by_schedule: bool = False,
        rest_of_day: bool = False,
        reason: str | None = None,
        keep_timer: bool = False,
    ) -> None:
        """Set lockout state and update hardware accordingly."""
        dev = self.storage.get_device(device_id)
        if not dev:
            return

        updates: dict[str, Any] = {"locked": locked}

        if locked:
            updates["locked_by_schedule"] = bool(by_schedule)
            updates["manual_unlock_override"] = False
            updates["daily_limit_overridden_today"] = False
            updates["lock_until_midnight"] = bool(rest_of_day)
            updates["locked_reason"] = reason or (
                REASON_REST_OF_DAY
                if rest_of_day
                else (REASON_SCHEDULE if by_schedule else REASON_MANUAL)
            )
            if not by_schedule and not rest_of_day and reason != REASON_SCHEDULE:
                updates["active_schedule_name"] = None
        else:
            updates["locked_by_schedule"] = False
            updates["lock_until_midnight"] = False
            updates["locked_reason"] = None
            updates["active_schedule_name"] = None
            if device_id in self._enforce_tasks:
                task = self._enforce_tasks.pop(device_id)
                if not task.done():
                    task.cancel()

            if not by_schedule:
                if self.is_device_in_schedule_window(dev):
                    updates["manual_unlock_override"] = True
                else:
                    updates["manual_unlock_override"] = False

                eff_limit = compute_effective_daily_limit(dev, dt_util.now())
                usage_mins = int(dev.get("screen_time_today_minutes", 0))
                if eff_limit is not None and usage_mins >= eff_limit:
                    updates["daily_limit_overridden_today"] = True
            else:
                updates["manual_unlock_override"] = False

        if not keep_timer:
            if device_id in self._timer_unsubs:
                self._timer_unsubs.pop(device_id)()
            if dev.get("timer_expires_at") or dev.get("timer_mode"):
                updates["timer_expires_at"] = None
                updates["timer_mode"] = None

        await self.storage.async_update_device(device_id, updates)

        if locked:
            await self._async_enforce_device_locked(device_id)
        else:
            dev_type = dev.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)
            if power_on or dev_type == DEVICE_TYPE_NETWORK_SWITCH:
                await self._async_enforce_device_unlocked(device_id)

        async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)
        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

    async def async_adjust_bonus_time(
        self, device_id: str, delta_minutes: int = 15, reset: bool = False
    ) -> None:
        """Add or reset bonus daily screen time minutes for today."""
        if device_id in ("all", "*", ""):
            for did in list(self.storage.get_all_devices().keys()):
                await self.async_adjust_bonus_time(did, delta_minutes=delta_minutes, reset=reset)
            return

        dev = self.storage.get_device(device_id)
        if not dev:
            return

        cur_bonus = int(dev.get("bonus_minutes_today") or 0)
        new_bonus = 0 if reset else max(0, cur_bonus + int(delta_minutes))
        await self.storage.async_update_device(
            device_id, {"bonus_minutes_today": new_bonus}
        )

        # If device was locked strictly due to daily limit and new limit now allows viewing, unlock
        updated_dev = self.storage.get_device(device_id)
        eff_limit = compute_effective_daily_limit(updated_dev, dt_util.now())
        usage = int(updated_dev.get("screen_time_today_minutes", 0))
        if (
            updated_dev.get("locked")
            and updated_dev.get("locked_reason") == REASON_DAILY_LIMIT
            and eff_limit is not None
            and usage < eff_limit
            and not self._active_restrictions
            and not self.is_device_in_schedule_window(updated_dev)
            and not updated_dev.get("lock_until_midnight", False)
        ):
            await self.async_set_device_lockout(
                device_id, locked=False, power_on=False, by_schedule=False
            )
        else:
            async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)
            async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

    async def async_toggle_all_lockouts(self) -> None:
        """Master toggle: if any device is locked, unlock all; otherwise lock all."""
        devices = self.storage.get_all_devices()
        if not devices:
            return

        any_locked = any(d.get("locked", False) for d in devices.values()) or bool(
            self._active_restrictions
        )
        target_locked = not any_locked

        for dev_id in list(devices.keys()):
            await self.async_set_device_lockout(
                dev_id, locked=target_locked, power_on=False
            )

    async def async_set_all_lockouts(
        self, locked: bool, power_on: bool = False, rest_of_day: bool = False
    ) -> None:
        """Set lockout state for all managed devices."""
        devices = self.storage.get_all_devices()
        for dev_id in list(devices.keys()):
            await self.async_set_device_lockout(
                dev_id, locked=locked, power_on=power_on, rest_of_day=rest_of_day
            )

    async def _async_enforce_device_locked(self, device_id: str) -> None:
        """Launch anti-bypass verification loop to enforce lockout on hardware."""
        if device_id in self._enforce_tasks:
            prev_task = self._enforce_tasks.pop(device_id)
            if not prev_task.done():
                prev_task.cancel()

        dev = self.storage.get_device(device_id)
        target = dev.get("target_entity")
        if not target or not self.hass.states.get(target):
            return

        task = self.hass.async_create_task(
            self._async_enforce_device_locked_loop(device_id)
        )
        self._enforce_tasks[device_id] = task

    async def _async_enforce_device_locked_loop(self, device_id: str) -> None:
        """Enforce lockout with persistent retry loop against rapid power cycling."""
        dev = self.storage.get_device(device_id)
        target = dev.get("target_entity")
        dev_type = dev.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)

        if not target:
            return

        service_domain = "switch" if dev_type == DEVICE_TYPE_NETWORK_SWITCH else "media_player"
        service_action = "turn_on" if dev_type == DEVICE_TYPE_NETWORK_SWITCH else "turn_off"

        if not self._is_target_active(target, dev_type):
            return

        max_attempts = 10
        delay_seconds = 8.0

        try:
            for attempt in range(1, max_attempts + 1):
                current_dev = self.storage.get_device(device_id)
                if not current_dev or not current_dev.get("locked", False):
                    break

                if self._is_target_active(target, dev_type):
                    _LOGGER.info(
                        "Lockout enforcement attempt %s/%s for %s (%s: %s.%s)",
                        attempt,
                        max_attempts,
                        device_id,
                        target,
                        service_domain,
                        service_action,
                    )
                    try:
                        loop = asyncio.get_running_loop()
                        self._last_enforce_time[device_id] = loop.time()
                    except RuntimeError:
                        pass

                    try:
                        await self.hass.services.async_call(
                            service_domain,
                            service_action,
                            {"entity_id": target},
                            blocking=True,
                        )
                    except Exception as err:
                        _LOGGER.warning(
                            "Failed to call %s.%s on %s during enforcement: %s",
                            service_domain,
                            service_action,
                            target,
                            err,
                        )

                await asyncio.sleep(delay_seconds)

                current_dev = self.storage.get_device(device_id)
                if not current_dev or not current_dev.get("locked", False):
                    break

                if not self._is_target_active(target, dev_type):
                    await asyncio.sleep(2.0)
                    current_dev = self.storage.get_device(device_id)
                    if not current_dev or not current_dev.get("locked", False):
                        break
                    if not self._is_target_active(target, dev_type):
                        break
        except asyncio.CancelledError:
            raise
        except Exception as err:
            _LOGGER.error("Unexpected error in enforcement loop for %s: %s", device_id, err)
        finally:
            current_task = None
            try:
                current_task = asyncio.current_task()
            except RuntimeError:
                pass
            if current_task and self._enforce_tasks.get(device_id) is current_task:
                self._enforce_tasks.pop(device_id, None)

    async def _async_enforce_device_unlocked(self, device_id: str) -> None:
        """Restore device access and optionally turn ON."""
        if device_id in self._enforce_tasks:
            task = self._enforce_tasks.pop(device_id)
            if not task.done():
                task.cancel()

        dev = self.storage.get_device(device_id)
        target = dev.get("target_entity")
        dev_type = dev.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)

        if not target or not self.hass.states.get(target):
            return

        if dev_type == DEVICE_TYPE_NETWORK_SWITCH:
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
        """Evaluate schedules and global restrictions for all managed devices."""
        now = dt_util.now()
        devices = self.storage.get_all_devices()

        for dev_id, dev in list(devices.items()):
            # Don't override an active non-expired timer (unlock, wind_down, or temporary lock)
            if self._has_active_timer(dev):
                continue

            if self._active_restrictions:
                if not dev.get("locked", False):
                    _LOGGER.info(
                        "Global restriction active (%s). Locking %s.",
                        ", ".join(sorted(self._active_restrictions)),
                        dev_id,
                    )
                    await self.async_set_device_lockout(
                        dev_id,
                        locked=True,
                        by_schedule=True,
                        reason=REASON_RESTRICTION,
                    )
                elif not dev.get("locked_by_schedule", False) or dev.get("locked_reason") != REASON_RESTRICTION:
                    await self.storage.async_update_device(
                        dev_id,
                        {
                            "locked_by_schedule": True,
                            "locked_reason": REASON_RESTRICTION,
                        },
                    )
                continue

            if not dev.get("schedule_enabled", False):
                updates: dict[str, Any] = {}
                if dev.get("manual_unlock_override", False):
                    updates["manual_unlock_override"] = False
                if dev.get("active_schedule_name"):
                    updates["active_schedule_name"] = None
                if updates:
                    await self.storage.async_update_device(dev_id, updates)

                if (
                    dev.get("locked", False)
                    and dev.get("locked_by_schedule", False)
                    and not dev.get("lock_until_midnight", False)
                ):
                    _LOGGER.info(
                        "Schedule/restriction inactive for %s while locked by schedule. Auto-unlocking.",
                        dev_id,
                    )
                    await self.async_set_device_lockout(
                        dev_id, locked=False, power_on=False, by_schedule=False
                    )
                continue

            active_rule = get_active_schedule_rule(dev, now)
            should_be_locked = active_rule is not None

            if should_be_locked and not dev.get("locked", False):
                if dev.get("manual_unlock_override", False):
                    continue

                rule_name = active_rule.get("name", "Schedule")
                _LOGGER.info(
                    "Schedule window '%s' active for %s. Locking.",
                    rule_name,
                    dev_id,
                )
                await self.async_set_device_lockout(
                    dev_id,
                    locked=True,
                    by_schedule=True,
                    reason=REASON_SCHEDULE,
                )
                await self.storage.async_update_device(
                    dev_id, {"active_schedule_name": rule_name}
                )
            elif should_be_locked and dev.get("locked", False):
                rule_name = active_rule.get("name", "Schedule")
                upd: dict[str, Any] = {}
                if not dev.get("locked_by_schedule", False):
                    upd["locked_by_schedule"] = True
                if dev.get("active_schedule_name") != rule_name:
                    upd["active_schedule_name"] = rule_name
                if dev.get("locked_reason") in (None, REASON_RESTRICTION):
                    upd["locked_reason"] = REASON_SCHEDULE
                if upd:
                    await self.storage.async_update_device(dev_id, upd)
            elif (
                not should_be_locked
                and dev.get("locked", False)
                and dev.get("locked_by_schedule", False)
                and not dev.get("lock_until_midnight", False)
            ):
                _LOGGER.info(
                    "Schedule window ended for %s. Auto-unlocking.",
                    dev_id,
                )
                await self.async_set_device_lockout(
                    dev_id, locked=False, power_on=False, by_schedule=False
                )
            elif not should_be_locked:
                upd = {}
                if dev.get("manual_unlock_override", False):
                    upd["manual_unlock_override"] = False
                if dev.get("active_schedule_name"):
                    upd["active_schedule_name"] = None
                if upd:
                    await self.storage.async_update_device(dev_id, upd)

    # =========================================================================
    # DEVICE ONBOARDING, COPY & CONFIG ENTRY SYNC
    # =========================================================================

    async def _async_sync_config_entry_options(self) -> None:
        """Mirror current storage devices and global restrictions into ConfigEntry options."""
        if not self.entry_id:
            return
        entry = self.hass.config_entries.async_get_entry(self.entry_id)
        if not entry:
            return

        devices_list = [
            d.get("target_entity")
            for d in self.storage.get_all_devices().values()
            if d.get("target_entity")
        ]
        restr_list = [
            r.get("entity")
            for r in self.storage.get_global_restrictions()
            if r.get("entity")
        ]

        new_options = dict(entry.options)
        new_options[CONF_DEVICES] = devices_list
        new_options[CONF_GLOBAL_RESTRICTIONS] = restr_list

        self._syncing_options = True
        try:
            self.hass.config_entries.async_update_entry(entry, options=new_options)
        finally:
            self._syncing_options = False

    async def async_add_device(
        self,
        target_entity: str,
        name: str | None = None,
        icon: str | None = None,
        device_category: str | None = None,
        track_screen_time: bool | None = None,
        daily_limit_enabled: bool | None = None,
        daily_limit_minutes: int | None = None,
        screen_time_entity: str | None = None,
    ) -> dict[str, Any]:
        """Onboard a new media_player or switch device from the frontend card."""
        dev_id = target_entity.split(".", 1)[-1]
        existing = self.storage.get_device(dev_id)
        if existing:
            return existing

        state_obj = self.hass.states.get(target_entity)
        resolved_name = name or (
            state_obj.attributes.get("friendly_name")
            if state_obj and state_obj.attributes.get("friendly_name")
            else dev_id.replace("_", " ").title()
        )
        payload = get_default_device_data(
            device_id=dev_id,
            target_entity=target_entity,
            name=resolved_name,
            icon=icon,
            device_category=device_category,
        )
        if track_screen_time is not None:
            payload["track_screen_time"] = bool(track_screen_time)
        if daily_limit_enabled is not None:
            payload["daily_limit_enabled"] = bool(daily_limit_enabled)
        if daily_limit_minutes is not None:
            mins = max(15, int(daily_limit_minutes))
            payload["daily_limit_minutes"] = mins
            payload["daily_limit_weekday_minutes"] = mins
        if screen_time_entity:
            payload["screen_time_entity"] = screen_time_entity

        self.storage.data["initial_seed_complete"] = True
        await self.storage.async_update_device(dev_id, payload)
        await self._async_sync_config_entry_options()

        self.async_rebuild_device_listeners()
        await self.async_reconcile_device_screen_time(dev_id)
        await self.async_evaluate_schedules()

        async_dispatcher_send(self.hass, SIGNAL_DEVICE_ADDED, dev_id)
        async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, dev_id)
        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)
        async_dispatcher_send(self.hass, SIGNAL_STORAGE_UPDATED)
        return self.storage.get_device(dev_id)

    async def async_copy_device_settings(
        self,
        source_device_id: str,
        target_device_ids: list[str],
        copy_schedules: bool = True,
        copy_limits: bool = True,
    ) -> int:
        """Copy schedule rules and/or daily limit configuration to other devices."""
        src = self.storage.get_device(source_device_id)
        if not src:
            return 0

        updated_count = 0
        for tid in target_device_ids:
            if tid == source_device_id:
                continue
            target = self.storage.get_device(tid)
            if not target:
                continue

            updates: dict[str, Any] = {}
            if copy_schedules:
                copied_rules = [
                    normalize_schedule_rule(dict(r), idx)
                    for idx, r in enumerate(_get_device_rules(src))
                ]
                updates["schedule_enabled"] = bool(src.get("schedule_enabled", True))
                updates["schedules"] = copied_rules
                if copied_rules:
                    first = copied_rules[0]
                    updates["schedule_days"] = list(first["days"])
                    updates["schedule_start"] = first["start"]
                    updates["schedule_end"] = first["end"]
                    updates["schedule_recurrence"] = first["recurrence"]
                    updates["schedule_anchor_date"] = first["anchor_date"]

            if copy_limits:
                updates["daily_limit_enabled"] = bool(src.get("daily_limit_enabled", True))
                updates["daily_limit_mode"] = src.get("daily_limit_mode", "uniform")
                updates["daily_limit_minutes"] = int(
                    src.get("daily_limit_minutes") or DEFAULT_DAILY_LIMIT
                )
                updates["daily_limit_weekday_minutes"] = int(
                    src.get("daily_limit_weekday_minutes") or DEFAULT_DAILY_LIMIT
                )
                updates["daily_limit_weekend_minutes"] = int(
                    src.get("daily_limit_weekend_minutes") or 180
                )

            if updates:
                await self.storage.async_update_device(tid, updates)
                updated_count += 1
                async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, tid)

        if updated_count > 0:
            await self.async_evaluate_schedules()
            async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

        return updated_count

    async def async_update_global_restrictions(
        self, restrictions: list[dict[str, Any]]
    ) -> None:
        """Update global restriction entities from card UI and sync options."""
        cleaned: list[dict[str, Any]] = []
        seen: set[str] = set()
        for r in restrictions:
            ent = str(r.get("entity") or "").strip()
            if not ent or ent in seen:
                continue
            seen.add(ent)
            entry: dict[str, Any] = {"entity": ent}
            if r.get("name"):
                entry["name"] = str(r["name"]).strip()
            if r.get("icon"):
                entry["icon"] = str(r["icon"]).strip()
            cleaned.append(entry)

        await self.storage.async_update_global_restrictions(cleaned)
        await self._async_sync_config_entry_options()
        self.async_rebuild_device_listeners()
        await self.async_evaluate_schedules()
        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)
        async_dispatcher_send(self.hass, SIGNAL_STORAGE_UPDATED)

    # =========================================================================
    # STATE CHANGE INTERCEPTION & TELEMETRY
    # =========================================================================

    @callback
    def _async_handle_device_state_change(self, event: Any) -> None:
        """Intercept device state changes for bypass prevention and app tracking."""
        target_entity = event.data.get("entity_id")
        old_state = event.data.get("old_state")
        new_state = event.data.get("new_state")
        if not new_state:
            return

        device_id = None
        dev_data = None
        for did, d in self.storage.get_all_devices().items():
            if d.get("target_entity") == target_entity:
                device_id = did
                dev_data = d
                break

        if not device_id or not dev_data:
            return

        is_locked = dev_data.get("locked", False)
        dev_type = dev_data.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)
        is_active = self._is_device_active(new_state.state, dev_type)
        was_active = (
            self._is_device_active(old_state.state, dev_type)
            if old_state
            else False
        )

        if is_locked and is_active:
            now_ts = 0.0
            try:
                now_ts = asyncio.get_running_loop().time()
            except RuntimeError:
                pass
            last_ts = self._last_enforce_time.get(device_id, 0.0)
            task = self._enforce_tasks.get(device_id)

            if task and not task.done():
                pass
            elif (now_ts - last_ts) < 6.0:
                pass
            elif was_active and old_state and old_state.state == new_state.state:
                pass
            else:
                _LOGGER.warning(
                    "Unauthorized active state (%s) detected on locked device %s. Enforcing lockout.",
                    new_state.state,
                    device_id,
                )
                self.hass.async_create_task(
                    self._async_enforce_device_locked(device_id)
                )

        # Track Active Streaming App
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

        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

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
        now_local = dt_util.now()

        for dev_id, dev in list(devices.items()):
            target_ent = dev.get("target_entity")
            dev_type = dev.get("device_type", DEVICE_TYPE_MEDIA_PLAYER)

            if (
                dev.get("locked", False)
                and target_ent
                and self._is_target_active(target_ent, dev_type)
            ):
                task = self._enforce_tasks.get(dev_id)
                if not task or task.done():
                    _LOGGER.warning(
                        "Watchdog: Device %s is locked but detected active (%s). Re-enforcing lockout.",
                        dev_id,
                        target_ent,
                    )
                    self.hass.async_create_task(
                        self._async_enforce_device_locked(dev_id)
                    )

            if not dev.get("track_screen_time", True):
                continue

            target = dev.get("screen_time_entity") or dev.get("target_entity")
            if not target:
                continue

            state_obj = self.hass.states.get(target)
            if not state_obj:
                continue

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
                dev["screen_time_date"] = now_local.strftime("%Y-%m-%d")
                has_updates = True

                # Check daily limit auto-lockout (skip if unlock/wind_down timer or parent override active)
                has_allowing_timer = self._has_active_timer(dev) and (
                    (dev.get("timer_mode") or TIMER_MODE_UNLOCK)
                    in (TIMER_MODE_UNLOCK, TIMER_MODE_WIND_DOWN)
                )
                eff_limit = compute_effective_daily_limit(dev, now_local)
                if (
                    eff_limit is not None
                    and not dev.get("daily_limit_overridden_today", False)
                    and not has_allowing_timer
                    and new_mins >= eff_limit
                    and not dev.get("locked", False)
                ):
                    _LOGGER.info(
                        "Daily screen time limit reached for %s (%s mins). Locking device.",
                        dev_id,
                        eff_limit,
                    )
                    self.hass.async_create_task(
                        self.async_set_device_lockout(
                            dev_id, locked=True, reason=REASON_DAILY_LIMIT
                        )
                    )

        if has_updates:
            self.hass.async_create_task(self.storage.async_save())
            async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

        self.hass.async_create_task(self.async_evaluate_schedules())

    @callback
    def _async_midnight_rollover(self, now: datetime) -> None:
        """Midnight rollover: reset daily screen time, bonus minutes, overrides, and rest-of-day locks."""
        _LOGGER.info("Rolling over daily screen time stats at midnight")
        today_str = now.strftime("%Y-%m-%d")
        devices = self.storage.get_all_devices()
        to_evaluate: list[str] = []

        for dev_id, dev in devices.items():
            dev["screen_time_today_minutes"] = 0
            dev["apps_used_today"] = []
            dev["bonus_minutes_today"] = 0
            dev["daily_limit_overridden_today"] = False
            dev["screen_time_date"] = today_str

            if dev.get("lock_until_midnight", False) or dev.get("locked_reason") == REASON_DAILY_LIMIT:
                dev["lock_until_midnight"] = False
                if not self._has_active_timer(dev):
                    active_rule = get_active_schedule_rule(dev, now)
                    if self._active_restrictions:
                        dev["locked_by_schedule"] = True
                        dev["locked_reason"] = REASON_RESTRICTION
                    elif active_rule:
                        dev["locked_by_schedule"] = True
                        dev["locked_reason"] = REASON_SCHEDULE
                        dev["active_schedule_name"] = active_rule.get("name")
                    else:
                        to_evaluate.append(dev_id)

        async def _finish_rollover() -> None:
            await self.storage.async_save()
            for did in to_evaluate:
                await self.async_set_device_lockout(
                    did, locked=False, power_on=False, by_schedule=False
                )
            async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)

        self.hass.async_create_task(_finish_rollover())

    async def async_remove_device_and_cleanup(self, device_id: str) -> None:
        """Remove a device from storage, cancel timers, unsubscribe listeners, and delete HA entities."""
        _LOGGER.info("Permanently removing device %s from screen time engine", device_id)
        if device_id in self._timer_unsubs:
            self._timer_unsubs.pop(device_id)()

        if device_id in self._enforce_tasks:
            task = self._enforce_tasks.pop(device_id)
            if not task.done():
                task.cancel()
        self._last_enforce_time.pop(device_id, None)

        await self.storage.async_remove_device(device_id)
        await self._async_sync_config_entry_options()

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

        self.async_rebuild_device_listeners()
        async_dispatcher_send(self.hass, SIGNAL_ENGINE_UPDATED)
        async_dispatcher_send(self.hass, SIGNAL_DEVICE_UPDATED, device_id)
        async_dispatcher_send(self.hass, SIGNAL_STORAGE_UPDATED)

    async def async_unload(self) -> None:
        """Cancel all registered listeners, enforcement tasks, and timers on unload."""
        for unsub in self._unsub_callbacks:
            unsub()
        self._unsub_callbacks.clear()

        for unsub in self._device_state_listeners:
            unsub()
        self._device_state_listeners.clear()

        for unsub in self._timer_unsubs.values():
            unsub()
        self._timer_unsubs.clear()

        for task in self._enforce_tasks.values():
            if not task.done():
                task.cancel()
        self._enforce_tasks.clear()
        self._last_enforce_time.clear()
