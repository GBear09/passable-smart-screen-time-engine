/**
 * Passable Smart Screen Time Card
 * Bundled companion card for Passable Smart Screen Time Engine
 * https://github.com/GBear09/passable-smart-screen-time-engine
 *
 * Version 2.0.0 - Passable Suite Summary Card + Inline Quick-Drawer + 4-Tab Command Center
 */

const CARD_VERSION = "2.1.0";
const ENGINE_DOMAIN = "passable_smart_screen_time_engine";

const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace") ||
    customElements.get("hui-entities-card") ||
    customElements.get("hui-masonry-view") ||
    customElements.get("hc-main")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;
const svg =
  LitElement.prototype.svg ||
  ((strings, ...values) => {
    const result = html(strings, ...values);
    if (result && typeof result === "object") {
      return Object.assign({}, result, { _$litType$: 2, type: "svg" });
    }
    return result;
  });

console.info(
  `%c PASSABLE-SCREEN-TIME-CARD %c v${CARD_VERSION} IS LOADED `,
  "color: #ffffff; background: #0284c7; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #0284c7; background: #e0f2fe; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);

const MODAL_TABS = [
  { id: "controls", label: "Controls", icon: "mdi:shield-lock-outline" },
  { id: "timers", label: "Timers", icon: "mdi:timer-sand" },
  { id: "schedules", label: "Schedules", icon: "mdi:calendar-clock" },
  { id: "activity", label: "Activity", icon: "mdi:chart-box-outline" },
];

const DAYS_LIST = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

const DEVICE_CATEGORY_OPTIONS = [
  { id: "tv", label: "TV", icon: "mdi:television" },
  { id: "tablet", label: "Tablet", icon: "mdi:tablet-ipad" },
  { id: "gaming", label: "Gaming", icon: "mdi:controller" },
  { id: "network", label: "Wi-Fi", icon: "mdi:wifi-lock" },
  { id: "other", label: "Other", icon: "mdi:devices" },
];

const SCHEDULE_TEMPLATES = [
  {
    id: "school_bedtime",
    label: "School Night Bedtime",
    name: "School Night Bedtime",
    days: ["sun", "mon", "tue", "wed", "thu"],
    start: "20:00",
    end: "07:00",
  },
  {
    id: "weekend_bedtime",
    label: "Weekend Bedtime",
    name: "Weekend Bedtime",
    days: ["fri", "sat"],
    start: "21:30",
    end: "07:30",
  },
  {
    id: "school_hours",
    label: "School Hours",
    name: "School Hours",
    days: ["mon", "tue", "wed", "thu", "fri"],
    start: "08:00",
    end: "15:30",
  },
  {
    id: "dinner_time",
    label: "Dinner & Family",
    name: "Dinner Time",
    days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
    start: "17:30",
    end: "19:00",
  },
  {
    id: "custom",
    label: "Custom Window",
    name: "Custom Downtime",
    days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
    start: "20:00",
    end: "07:00",
  },
];

class PassableScreenTimeCard extends LitElement {
  static getConfigElement() {
    return document.createElement("passable-screen-time-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Screen Time",
      subtitle: "Smart Screen Time & Lockout Hub",
      display_mode: "summary",
      layout: "compact",
      show_header: false,
      show_summary_strip: false,
      show_footer_strip: false,
      show_stats_button: true,
      default_expanded_drawer: "",
      require_pin: "auto",
      hide_admin_setup: false,
    };
  }

  static get properties() {
    return {
      hass: { attribute: false },
      config: { state: true },
      _wsData: { state: true },
      _wsError: { state: true },
      _drawerMode: { state: true },
      _drawerFilter: { state: true },
      _modalOpen: { state: true },
      _modalTab: { state: true },
      _selectedDeviceId: { state: true },
      _activitySubTab: { state: true },
      _timerMode: { state: true },
      _timerDuration: { state: true },
      _timerUnit: { state: true },
      _timerUntilTime: { state: true },
      _timerPowerOn: { state: true },
      _timerScope: { state: true },
      _schedDraft: { state: true },
      _schedDirty: { state: true },
      _copyTrayOpen: { state: true },
      _copyTargets: { state: true },
      _copySchedulesFlag: { state: true },
      _copyLimitsFlag: { state: true },
      _addDevFilter: { state: true },
      _addDevEntity: { state: true },
      _addDevName: { state: true },
      _addDevCategory: { state: true },
      _addDevTrack: { state: true },
      _addDevSensor: { state: true },
      _manageExpandedId: { state: true },
      _restrNewEntity: { state: true },
      _restrNewName: { state: true },
      _secCurrentPin: { state: true },
      _secNewPin: { state: true },
      _secPinEnabled: { state: true },
      _secReqUnlock: { state: true },
      _secReqTimers: { state: true },
      _secReqSettings: { state: true },
      _pinModalOpen: { state: true },
      _pinInput: { state: true },
      _pinError: { state: true },
      _pinUnlockedUntil: { state: true },
      _toastMsg: { state: true },
      _tickNow: { state: true },
    };
  }

  constructor() {
    super();
    this._wsData = null;
    this._wsError = null;
    this._wsUnsub = null;
    this._wsSubscribing = false;
    this._drawerMode = null;
    this._drawerInitialized = false;
    this._drawerFilter = "all";
    this._modalOpen = false;
    this._modalTab = "controls";
    this._selectedDeviceId = null;
    this._activitySubTab = "activity";

    this._timerMode = "unlock";
    this._timerDuration = 20;
    this._timerUnit = "minutes";
    this._timerUntilTime = "20:00";
    this._timerPowerOn = false;
    this._timerScope = "all";

    this._schedDraft = null;
    this._schedDirty = false;
    this._copyTrayOpen = false;
    this._copyTargets = [];
    this._copySchedulesFlag = true;
    this._copyLimitsFlag = true;

    this._addDevFilter = "";
    this._addDevEntity = "";
    this._addDevName = "";
    this._addDevCategory = "tv";
    this._addDevTrack = true;
    this._addDevSensor = "";
    this._manageExpandedId = null;

    this._restrNewEntity = "";
    this._restrNewName = "";

    this._secCurrentPin = "";
    this._secNewPin = "";
    this._secPinEnabled = false;
    this._secReqUnlock = true;
    this._secReqTimers = true;
    this._secReqSettings = true;
    this._secSynced = false;

    this._pinModalOpen = false;
    this._pinInput = "";
    this._pinError = null;
    this._pinUnlockedUntil = 0;
    this._pendingProtectedFn = null;

    this._toastMsg = null;
    this._tickNow = Date.now();
    this._countdownInterval = null;
    this._toastTimer = null;
    this._closeModalTimer = null;
    this._ringHoldTimer = null;
    this._ringHoldFired = false;

    this._touchStartY = undefined;
    this._touchStartX = undefined;
    this._touchCurrentY = undefined;
    this._touchTarget = null;
    this._touchInScroll = false;
    this._touchDragging = false;
    this._touchLockedHorizontal = false;
    this._swipeResetTimer = null;
    this._scrollLockedElements = null;
    this._scrollGuardOverlay = null;
    this._guardTouchY = 0;
    this._guardTouchX = 0;
    this._onOverlayWheel = this._onOverlayWheel.bind(this);
    this._onOverlayTouchStart = this._onOverlayTouchStart.bind(this);
    this._onOverlayTouchMove = this._onOverlayTouchMove.bind(this);
    this._onKeyDown = (ev) => {
      if (ev.key === "Escape") {
        if (this._pinModalOpen) {
          this._closePinModal();
        } else if (this._modalOpen) {
          this._closeModal();
        }
      }
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    const displayMode = config.display_mode === "full" ? "full" : "summary";
    const defaultShowHeader = displayMode === "full";
    const layout = ["compact", "strip", "active", "tiles", "rows", "rings"].includes(
      config.layout
    )
      ? config.layout
      : "tiles";
    const defaultStrips = !["compact", "strip"].includes(layout);
    this.config = {
      ...config,
      title: config.title !== undefined ? config.title : "Screen Time",
      subtitle:
        config.subtitle !== undefined
          ? config.subtitle
          : "Smart Screen Time & Lockout Hub",
      display_mode: displayMode,
      layout,
      show_header:
        config.show_header !== undefined
          ? config.show_header !== false
          : defaultShowHeader,
      show_summary_strip:
        config.show_summary_strip !== undefined
          ? Boolean(config.show_summary_strip)
          : defaultStrips,
      show_footer_strip:
        config.show_footer_strip !== undefined
          ? Boolean(config.show_footer_strip)
          : defaultStrips,
      show_stats_button: config.show_stats_button !== false,
      default_expanded_drawer: config.default_expanded_drawer || "",
      require_pin:
        config.require_pin !== undefined ? config.require_pin : "auto",
      hide_admin_setup: config.hide_admin_setup === true,
    };

    if (!this._drawerInitialized && this.config.default_expanded_drawer) {
      this._drawerMode = this.config.default_expanded_drawer;
    }
    this._drawerInitialized = true;
  }

  getCardSize() {
    if (this.config?.display_mode === "full") return 8;
    const layout = this.config?.layout || "tiles";
    if (layout === "strip") return 1;
    if (layout === "compact" || layout === "active") return 2;
    if (layout === "rings") return 3;
    if (layout === "rows") return 5;
    return 4;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this._onKeyDown);
    if (this.hass && !this._wsUnsub && !this._wsSubscribing) {
      this._subscribeEngine();
    }
    this._syncCountdownTimer();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this._onKeyDown);
    this._detachOverlayScrollGuard();
    this._unlockBackgroundScroll();
    this._unsubscribeEngine();
    clearInterval(this._countdownInterval);
    this._countdownInterval = null;
    clearTimeout(this._toastTimer);
    clearTimeout(this._closeModalTimer);
    clearTimeout(this._ringHoldTimer);
    clearTimeout(this._swipeResetTimer);
  }

  updated(changedProps) {
    super.updated(changedProps);
    if (
      changedProps.has("hass") &&
      this.hass &&
      !this._wsUnsub &&
      !this._wsSubscribing &&
      !this._wsData
    ) {
      this._subscribeEngine();
    }
    if (
      (this._modalOpen && this.config?.display_mode !== "full") ||
      this._pinModalOpen
    ) {
      this._attachOverlayScrollGuard();
    } else {
      this._detachOverlayScrollGuard();
    }
  }

  shouldUpdate(changedProps) {
    if (!changedProps.has("hass")) return true;
    for (const key of changedProps.keys()) {
      if (key !== "hass") return true;
    }
    const oldHass = changedProps.get("hass");
    const newHass = this.hass;
    if (!oldHass || !newHass || !oldHass.states || !newHass.states) return true;

    const watched = new Set(["switch.passable_master_device_lockout"]);
    const devices = this._wsData?.devices || {};
    for (const dev of Object.values(devices)) {
      if (dev.target_entity) watched.add(dev.target_entity);
      if (dev.screen_time_entity) watched.add(dev.screen_time_entity);
    }
    const restrictions = this._wsData?.global_restrictions || [];
    for (const r of restrictions) {
      if (r.entity) watched.add(r.entity);
    }
    for (const id of watched) {
      if (oldHass.states[id] !== newHass.states[id]) return true;
    }
    return false;
  }

  // =========================================================================
  // WEBSOCKET SUBSCRIPTION & COUNTDOWN
  // =========================================================================

  _unsubscribeEngine() {
    if (this._wsUnsub) {
      try {
        this._wsUnsub();
      } catch (_err) {
        // Ignore teardown errors
      }
      this._wsUnsub = null;
    }
  }

  async _subscribeEngine() {
    if (!this.hass || this._wsUnsub || this._wsSubscribing) return;
    this._wsSubscribing = true;
    try {
      if (
        this.hass.connection &&
        typeof this.hass.connection.subscribeMessage === "function"
      ) {
        const unsub = await this.hass.connection.subscribeMessage(
          (snapshot) => {
            this._applySnapshot(snapshot);
          },
          { type: `${ENGINE_DOMAIN}/subscribe` }
        );
        if (!this.isConnected) {
          unsub();
        } else {
          this._wsUnsub = unsub;
        }
      } else {
        await this._fetchFallbackData();
      }
    } catch (err) {
      this._wsError = err?.message || "WebSocket unavailable";
      await this._fetchFallbackData();
    } finally {
      this._wsSubscribing = false;
    }
  }

  async _fetchFallbackData() {
    if (!this.hass) return;
    try {
      const res = await this.hass.callWS({ type: `${ENGINE_DOMAIN}/get_data` });
      if (res) {
        this._applySnapshot(res);
      }
    } catch (err) {
      this._wsError = err?.message || "Failed to load screen time engine";
    }
  }

  _applySnapshot(snapshot) {
    this._wsData = snapshot;
    this._wsError = null;
    const devices = snapshot?.devices || {};
    const devKeys = Object.keys(devices);

    if (!this._selectedDeviceId || !devices[this._selectedDeviceId]) {
      this._selectedDeviceId = devKeys[0] || null;
    }
    if (
      this._timerScope !== "all" &&
      (!this._timerScope || !devices[this._timerScope])
    ) {
      this._timerScope = devKeys[0] || "all";
    }
    if (this._selectedDeviceId && !this._schedDirty) {
      this._loadSchedDraft(this._selectedDeviceId, devices[this._selectedDeviceId]);
    }
    if (!this._secSynced && snapshot?.security) {
      this._secPinEnabled = Boolean(snapshot.security.pin_enabled);
      this._secReqUnlock = snapshot.security.require_pin_for_unlock !== false;
      this._secReqTimers = snapshot.security.require_pin_for_timers !== false;
      this._secReqSettings = snapshot.security.require_pin_for_settings !== false;
      this._secSynced = true;
    }

    this._syncCountdownTimer();
    this.requestUpdate();
  }

  _syncCountdownTimer() {
    const devices = this._wsData?.devices || {};
    const now = Date.now();
    const hasActive = Object.values(devices).some(
      (d) => d.timer_expires_at && new Date(d.timer_expires_at).getTime() > now
    );
    if (hasActive) {
      if (!this._countdownInterval) {
        this._countdownInterval = setInterval(() => {
          this._tickNow = Date.now();
        }, 1000);
      }
    } else if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  // =========================================================================
  // PARENTAL PIN GATE
  // =========================================================================

  _isPinRequired(category) {
    const sec = this._wsData?.security || {};
    const mode = this.config?.require_pin ?? "auto";
    if (mode === false) return false;
    if (mode === true) {
      return Boolean(sec.has_pin);
    }
    if (!sec.pin_enabled || !sec.has_pin) return false;
    if (category === "unlock") return sec.require_pin_for_unlock !== false;
    if (category === "timers") return sec.require_pin_for_timers !== false;
    if (category === "settings") return sec.require_pin_for_settings !== false;
    return false;
  }

  _isPinSessionUnlocked() {
    return Date.now() < this._pinUnlockedUntil;
  }

  _runProtectedAction(category, actionFn) {
    if (!this._isPinRequired(category) || this._isPinSessionUnlocked()) {
      return actionFn();
    }
    this._fireHaptic("light");
    this._pendingProtectedFn = actionFn;
    this._pinInput = "";
    this._pinError = null;
    this._pinModalOpen = true;
    this.requestUpdate();
  }

  _closePinModal() {
    this._pinModalOpen = false;
    this._pinInput = "";
    this._pinError = null;
    this._pendingProtectedFn = null;
    if (!this._modalOpen) {
      this._unlockBackgroundScroll();
    }
  }

  _pressPinDigit(digit) {
    this._fireHaptic("light");
    if (this._pinInput.length >= 6) return;
    this._pinInput = `${this._pinInput}${digit}`;
    this._pinError = null;
  }

  _backspacePin() {
    this._fireHaptic("light");
    this._pinInput = this._pinInput.slice(0, -1);
    this._pinError = null;
  }

  async _submitPin() {
    if (!this._pinInput || this._pinInput.length < 4) {
      this._pinError = "Enter your 4–6 digit PIN";
      return;
    }
    try {
      const res = await this.hass.callWS({
        type: `${ENGINE_DOMAIN}/verify_pin`,
        pin: this._pinInput,
      });
      if (res && res.valid) {
        this._fireHaptic("success");
        this._pinUnlockedUntil = Date.now() + 60000;
        const fn = this._pendingProtectedFn;
        this._closePinModal();
        this._showToast("Parent access unlocked for 60s");
        if (fn) await fn();
      } else {
        this._fireHaptic("failure");
        this._pinError = "Incorrect PIN";
        this._pinInput = "";
      }
    } catch (err) {
      this._pinError = err?.message || "Verification failed";
    }
  }

  _lockPinSession() {
    this._fireHaptic("light");
    this._pinUnlockedUntil = 0;
    this._showToast("Parent controls locked");
  }

  // =========================================================================
  // HELPERS & FORMATTERS
  // =========================================================================

  _fireHaptic(type = "light") {
    const ev = new Event("haptic", { bubbles: true, composed: true });
    ev.detail = type;
    this.dispatchEvent(ev);
  }

  _showToast(msg) {
    this._toastMsg = msg;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toastMsg = null;
    }, 2400);
  }

  _formatMins(mins) {
    if (!mins || mins <= 0) return "0m";
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  _formatTime12(hhmm) {
    if (!hhmm || !hhmm.includes(":")) return hhmm || "";
    const [hRaw, mRaw] = hhmm.split(":");
    const h = parseInt(hRaw, 10);
    const m = parseInt(mRaw, 10);
    if (isNaN(h) || isNaN(m)) return hhmm;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  _isOvernight(start, end) {
    if (!start || !end) return false;
    return start > end;
  }

  _getTimerRemainingMs(dev) {
    if (!dev?.timer_expires_at) return 0;
    const diff = new Date(dev.timer_expires_at).getTime() - this._tickNow;
    return diff > 0 ? diff : 0;
  }

  _formatRemainingCompact(dev) {
    const ms = this._getTimerRemainingMs(dev);
    if (ms <= 0) return "";
    const totalSecs = Math.ceil(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}:${String(secs).padStart(2, "0")}`;
    return `${secs}s`;
  }

  _getTimerProgressPct(dev) {
    const ms = this._getTimerRemainingMs(dev);
    if (ms <= 0) return 0;
    const durMins = Number(dev.timer_duration) || 20;
    const totalMs = (dev.timer_unit === "hours" ? durMins * 60 : durMins) * 60 * 1000;
    if (totalMs <= 0) return 0;
    return Math.max(4, Math.min(100, Math.round((ms / totalMs) * 100)));
  }

  _getDeviceIcon(dev) {
    if (dev?.icon) return dev.icon;
    const cat = dev?.device_category;
    if (cat === "tablet") return "mdi:tablet-ipad";
    if (cat === "gaming") return "mdi:controller";
    if (cat === "network") return "mdi:wifi-lock";
    if (cat === "other") return "mdi:devices";
    return dev?.device_type === "network_switch"
      ? "mdi:tablet-ipad"
      : "mdi:television";
  }

  _isTargetActive(dev) {
    if (!dev) return false;
    const st = this.hass?.states?.[dev.target_entity];
    if (!st) return Boolean(dev.is_target_active);
    if (dev.device_type === "network_switch") {
      return st.state === "off";
    }
    return !["off", "standby", "unavailable", "unknown"].includes(st.state);
  }

  _getDeviceTone(dev) {
    const timerMs = this._getTimerRemainingMs(dev);
    if (timerMs > 0) {
      if (dev.timer_mode === "lock") return "locked";
      if (dev.timer_mode === "wind_down") return "winddown";
      return "timer";
    }
    if (dev.locked) {
      return dev.locked_reason === "restriction" || dev.locked_reason === "daily_limit"
        ? "danger"
        : "locked";
    }
    if (this._isTargetActive(dev)) return "watching";
    return "idle";
  }

  _getDeviceSubline(dev) {
    const timerMs = this._getTimerRemainingMs(dev);
    const countdown = this._formatRemainingCompact(dev);
    const isSwitch = dev.device_type === "network_switch";
    const isActive = this._isTargetActive(dev);

    if (timerMs > 0) {
      if (dev.timer_mode === "lock") return `Locked · ${countdown} left`;
      if (dev.timer_mode === "wind_down") return `Wind-down · ${countdown}`;
      return `Bonus view · ${countdown}`;
    }

    if (dev.locked) {
      if (dev.locked_reason === "restriction") return "Locked · Household Rule";
      if (dev.lock_until_midnight || dev.locked_reason === "rest_of_day") {
        return "Locked · Rest of today";
      }
      if (dev.locked_reason === "daily_limit") return "Locked · Daily limit";
      if (dev.locked_reason === "schedule") {
        const schedName = dev.active_schedule_name || "Schedule";
        const nextEv = dev.next_schedule_event;
        if (nextEv && nextEv.action === "unlock") {
          return `${schedName} · until ${this._formatTime12(nextEv.time)}`;
        }
        return `Locked · ${schedName}`;
      }
      return "Locked manually";
    }

    if (isActive) {
      if (dev.active_app && dev.active_app !== "None") {
        return `▶ ${dev.active_app}`;
      }
      return isSwitch ? "Wi-Fi Active" : "Screen On";
    }

    if (dev.track_screen_time !== false) {
      const usage = dev.screen_time_today_minutes || 0;
      const limit = dev.effective_daily_limit_minutes;
      if (dev.daily_limit_enabled && limit) {
        return `${this._formatMins(usage)} / ${this._formatMins(limit)}`;
      }
      return `${this._formatMins(usage)} today`;
    }

    return isSwitch ? "Wi-Fi Permitted" : "Permitted";
  }

  _getSummaryMetrics(devices, restrictions) {
    const list = Object.entries(devices || {});
    let lockedCount = 0;
    let watchingCount = 0;
    let timerCount = 0;
    let totalMinutes = 0;
    let scheduleEnabledCount = 0;
    let nextTimerDev = null;
    let nextTimerMs = Infinity;

    for (const [did, dev] of list) {
      if (dev.locked) lockedCount++;
      if (this._isTargetActive(dev)) watchingCount++;
      if (dev.schedule_enabled) scheduleEnabledCount++;
      if (dev.track_screen_time !== false) {
        totalMinutes += Number(dev.screen_time_today_minutes || 0);
      }
      const ms = this._getTimerRemainingMs(dev);
      if (ms > 0) {
        timerCount++;
        if (ms < nextTimerMs) {
          nextTimerMs = ms;
          nextTimerDev = { did, dev, ms };
        }
      }
    }

    const activeRestrictions = (restrictions || []).filter((r) => {
      const st = this.hass?.states?.[r.entity];
      return st ? st.state === "on" : Boolean(r.is_active);
    });

    return {
      totalDevices: list.length,
      lockedCount,
      permittedCount: list.length - lockedCount,
      watchingCount,
      timerCount,
      totalMinutes,
      scheduleEnabledCount,
      activeRestrictions,
      nextTimerDev,
    };
  }

  _getMondayOfWeek(date = new Date(), offsetWeeks = 0) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() + (day === 0 ? -6 : 1 - day) + offsetWeeks * 7;
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(monday.getDate()).padStart(2, "0")}`;
  }

  _isBiweeklyActiveThisWeek(anchorDateStr) {
    if (!anchorDateStr) return true;
    try {
      const a = new Date(this._getMondayOfWeek(new Date(anchorDateStr + "T12:00:00")) + "T12:00:00").getTime();
      const b = new Date(this._getMondayOfWeek(new Date()) + "T12:00:00").getTime();
      const diffWeeks = Math.round((b - a) / (7 * 86400 * 1000));
      return Math.abs(diffWeeks) % 2 === 0;
    } catch (_e) {
      return true;
    }
  }

  // =========================================================================
  // BACKEND ACTIONS
  // =========================================================================

  async _setLockout(deviceId, locked, options = {}, ev = null) {
    if (ev) ev.stopPropagation();
    const run = async () => {
      this._fireHaptic("medium");
      try {
        await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/set_lockout`,
          device_id: deviceId,
          locked,
          power_on: Boolean(options.power_on),
          rest_of_day: Boolean(options.rest_of_day),
        });
        const label = options.rest_of_day
          ? "Locked for rest of today"
          : locked
            ? deviceId === "all"
              ? "All screens locked"
              : "Device locked"
            : deviceId === "all"
              ? "All screens permitted"
              : "Device permitted";
        this._showToast(label);
      } catch (err) {
        this._showToast(err?.message || "Lockout update failed");
      }
    };

    if (!locked) {
      return this._runProtectedAction("unlock", run);
    }
    return run();
  }

  async _startTimerAction(
    deviceId,
    { mode = "unlock", duration = 20, unit = "minutes", until_time = null, power_on = false },
    ev = null
  ) {
    if (ev) ev.stopPropagation();
    const run = async () => {
      this._fireHaptic("medium");
      try {
        await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/start_timer`,
          device_id: deviceId,
          mode,
          duration: Number(duration) || 20,
          unit,
          until_time: until_time || null,
          power_on: Boolean(power_on),
        });
        const modeLabel =
          mode === "lock"
            ? "Lockout timer started"
            : mode === "wind_down"
              ? "Wind-down countdown started"
              : "Viewing timer started";
        this._showToast(modeLabel);
      } catch (err) {
        this._showToast(err?.message || "Failed to start timer");
      }
    };

    if (mode === "unlock" || mode === "wind_down") {
      return this._runProtectedAction("timers", run);
    }
    return run();
  }

  async _extendTimer(deviceId, addMinutes, ev = null) {
    if (ev) ev.stopPropagation();
    return this._runProtectedAction("timers", async () => {
      this._fireHaptic("light");
      try {
        await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/extend_timer`,
          device_id: deviceId,
          add_minutes: addMinutes,
        });
        this._showToast(`Added +${addMinutes}m to timer`);
      } catch (err) {
        this._showToast(err?.message || "Failed to extend timer");
      }
    });
  }

  async _cancelTimer(deviceId, ev = null) {
    if (ev) ev.stopPropagation();
    return this._runProtectedAction("timers", async () => {
      this._fireHaptic("light");
      try {
        await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/cancel_timer`,
          device_id: deviceId,
        });
        this._showToast("Timer cancelled");
      } catch (err) {
        this._showToast(err?.message || "Failed to cancel timer");
      }
    });
  }

  async _adjustBonusTime(deviceId, deltaMinutes, reset = false, ev = null) {
    if (ev) ev.stopPropagation();
    return this._runProtectedAction("timers", async () => {
      this._fireHaptic("light");
      try {
        await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/adjust_bonus_time`,
          device_id: deviceId,
          delta_minutes: deltaMinutes,
          reset,
        });
        this._showToast(
          reset ? "Bonus time reset" : `Added +${deltaMinutes}m bonus today`
        );
      } catch (err) {
        this._showToast(err?.message || "Failed to adjust bonus time");
      }
    });
  }

  _toggleDevicePower(dev, ev = null) {
    if (ev) ev.stopPropagation();
    if (!this.hass || !dev?.target_entity) return;
    this._fireHaptic("light");
    const isSwitch = dev.device_type === "network_switch";
    this.hass.callService(isSwitch ? "switch" : "media_player", "toggle", {
      entity_id: dev.target_entity,
    });
  }

  _toggleRestriction(entityId, ev = null) {
    if (ev) ev.stopPropagation();
    if (!this.hass || !entityId) return;
    const isOn = this.hass.states?.[entityId]?.state === "on";
    const run = () => {
      this._fireHaptic("light");
      this.hass.callService("homeassistant", "toggle", { entity_id: entityId });
    };
    if (isOn) {
      return this._runProtectedAction("unlock", run);
    }
    return run();
  }

  // =========================================================================
  // DRAWER, MODAL & SCHEDULE DRAFT MANAGEMENT
  // =========================================================================

  _toggleDrawer(mode, ev = null) {
    if (ev) ev.stopPropagation();
    this._fireHaptic("light");
    this._drawerMode = this._drawerMode === mode ? null : mode;
  }

  _openModal(tab = "controls", deviceId = null, ev = null) {
    if (ev) ev.stopPropagation();
    this._fireHaptic("light");
    clearTimeout(this._closeModalTimer);
    clearTimeout(this._swipeResetTimer);
    if (deviceId && this._wsData?.devices?.[deviceId]) {
      this._selectedDeviceId = deviceId;
      this._timerScope = deviceId;
      this._loadSchedDraft(deviceId, this._wsData.devices[deviceId]);
    }
    this._modalTab = tab;
    this._modalOpen = true;
    this._lockBackgroundScroll();
    this.requestUpdate();
  }

  _closeModal() {
    if (!this._modalOpen) return;
    this._fireHaptic("light");
    const overlay = this.shadowRoot?.querySelector(".popup-overlay:not(.pin-overlay)");
    const content = overlay?.querySelector(".popup-content");
    if (overlay && content) {
      overlay.classList.add("closing");
      content.classList.add("closing");
      this._closeModalTimer = setTimeout(() => {
        this._modalOpen = false;
        if (!this._pinModalOpen) this._unlockBackgroundScroll();
      }, 170);
    } else {
      this._modalOpen = false;
      if (!this._pinModalOpen) this._unlockBackgroundScroll();
    }
  }

  _selectDevice(deviceId) {
    this._fireHaptic("light");
    this._selectedDeviceId = deviceId;
    this._timerScope = deviceId;
    const dev = this._wsData?.devices?.[deviceId];
    if (dev) {
      this._loadSchedDraft(deviceId, dev);
    }
  }

  _loadSchedDraft(deviceId, dev) {
    if (!dev) return;
    const isSwitch = dev.device_type === "network_switch";
    const rules = Array.isArray(dev.schedules) && dev.schedules.length > 0
      ? dev.schedules.map((r, idx) => ({
          id: r.id || `sched_${idx + 1}`,
          name: r.name || `Schedule ${idx + 1}`,
          enabled: r.enabled !== false,
          days: Array.isArray(r.days) ? [...r.days] : [...DAYS_LIST],
          start: (r.start || "20:00").slice(0, 5),
          end: (r.end || "07:00").slice(0, 5),
          recurrence: r.recurrence === "biweekly" ? "biweekly" : "weekly",
          anchor_date: r.anchor_date || null,
        }))
      : [
          {
            id: "sched_default",
            name: "Downtime",
            enabled: true,
            days: Array.isArray(dev.schedule_days)
              ? [...dev.schedule_days]
              : [...DAYS_LIST],
            start: (dev.schedule_start || "20:00").slice(0, 5),
            end: (dev.schedule_end || "07:00").slice(0, 5),
            recurrence: dev.schedule_recurrence === "biweekly" ? "biweekly" : "weekly",
            anchor_date: dev.schedule_anchor_date || null,
          },
        ];

    this._schedDraft = {
      deviceId,
      schedule_enabled: dev.schedule_enabled !== false,
      schedules: rules,
      track_screen_time: dev.track_screen_time ?? !isSwitch,
      daily_limit_enabled: dev.daily_limit_enabled ?? !isSwitch,
      daily_limit_mode: dev.daily_limit_mode || "uniform",
      daily_limit_minutes: Number(dev.daily_limit_minutes) || 120,
      daily_limit_weekday_minutes:
        Number(dev.daily_limit_weekday_minutes) || Number(dev.daily_limit_minutes) || 120,
      daily_limit_weekend_minutes: Number(dev.daily_limit_weekend_minutes) || 180,
    };
    this._schedDirty = false;
  }

  _updateSchedDraft(patch) {
    if (!this._schedDraft) return;
    this._schedDraft = { ...this._schedDraft, ...patch };
    this._schedDirty = true;
  }

  _updateScheduleRule(index, patch) {
    if (!this._schedDraft) return;
    const next = this._schedDraft.schedules.map((r, i) =>
      i === index ? { ...r, ...patch } : r
    );
    this._updateSchedDraft({ schedules: next });
  }

  _toggleRuleDay(index, day) {
    if (!this._schedDraft) return;
    const rule = this._schedDraft.schedules[index];
    if (!rule) return;
    const set = new Set(rule.days || []);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    const ordered = DAYS_LIST.filter((d) => set.has(d));
    this._updateScheduleRule(index, { days: ordered });
  }

  _addScheduleFromTemplate(tplId) {
    if (!this._schedDraft) return;
    const tpl =
      SCHEDULE_TEMPLATES.find((t) => t.id === tplId) || SCHEDULE_TEMPLATES[0];
    const nextRule = {
      id: `sched_${Date.now().toString(36)}`,
      name: tpl.name,
      enabled: true,
      days: [...tpl.days],
      start: tpl.start,
      end: tpl.end,
      recurrence: "weekly",
      anchor_date: null,
    };
    this._updateSchedDraft({
      schedules: [...this._schedDraft.schedules, nextRule],
    });
  }

  _removeScheduleRule(index) {
    if (!this._schedDraft) return;
    const next = this._schedDraft.schedules.filter((_, i) => i !== index);
    this._updateSchedDraft({ schedules: next });
  }

  async _saveScheduleDraft() {
    if (!this._schedDraft) return;
    return this._runProtectedAction("settings", async () => {
      const d = this._schedDraft;
      try {
        await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/save_device`,
          device_id: d.deviceId,
          schedule_enabled: d.schedule_enabled,
          schedules: d.schedules,
          track_screen_time: d.track_screen_time,
          daily_limit_enabled: d.daily_limit_enabled,
          daily_limit_mode: d.daily_limit_mode,
          daily_limit_minutes: Number(d.daily_limit_minutes) || 120,
          daily_limit_weekday_minutes: Number(d.daily_limit_weekday_minutes) || 120,
          daily_limit_weekend_minutes: Number(d.daily_limit_weekend_minutes) || 180,
        });
        this._schedDirty = false;
        this._fireHaptic("success");
        this._showToast("Schedules & limits saved");
      } catch (err) {
        this._showToast(err?.message || "Failed to save schedule");
      }
    });
  }

  async _applyCopySettings() {
    if (!this._schedDraft || this._copyTargets.length === 0) return;
    return this._runProtectedAction("settings", async () => {
      try {
        if (this._schedDirty) {
          await this._saveScheduleDraft();
        }
        const res = await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/copy_device_settings`,
          source_device_id: this._schedDraft.deviceId,
          target_device_ids: this._copyTargets,
          copy_schedules: this._copySchedulesFlag,
          copy_limits: this._copyLimitsFlag,
        });
        this._copyTrayOpen = false;
        this._copyTargets = [];
        this._showToast(`Copied settings to ${res?.updated_count || 0} device(s)`);
      } catch (err) {
        this._showToast(err?.message || "Copy failed");
      }
    });
  }

  // =========================================================================
  // SETUP, ONBOARDING & PIN ACTIONS
  // =========================================================================

  async _addNewDevice() {
    if (!this._addDevEntity) {
      this._showToast("Select a device entity first");
      return;
    }
    return this._runProtectedAction("settings", async () => {
      const cat = DEVICE_CATEGORY_OPTIONS.find((c) => c.id === this._addDevCategory);
      try {
        await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/add_device`,
          target_entity: this._addDevEntity,
          name: this._addDevName.trim() || null,
          icon: cat?.icon || null,
          device_category: this._addDevCategory,
          track_screen_time: this._addDevTrack,
          daily_limit_enabled: this._addDevTrack,
          screen_time_entity: this._addDevSensor || null,
        });
        this._addDevEntity = "";
        this._addDevName = "";
        this._addDevSensor = "";
        this._fireHaptic("success");
        this._showToast("Device added to Screen Time Engine");
      } catch (err) {
        this._showToast(err?.message || "Failed to add device");
      }
    });
  }

  async _updateManagedDeviceMeta(deviceId, updates) {
    return this._runProtectedAction("settings", async () => {
      try {
        await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/save_device`,
          device_id: deviceId,
          ...updates,
        });
        this._showToast("Device updated");
      } catch (err) {
        this._showToast(err?.message || "Update failed");
      }
    });
  }

  async _deleteDevice(deviceId) {
    const dev = this._wsData?.devices?.[deviceId];
    if (!confirm(`Remove "${dev?.name || deviceId}" from Screen Time Engine?`)) {
      return;
    }
    return this._runProtectedAction("settings", async () => {
      try {
        await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/delete_device`,
          device_id: deviceId,
        });
        if (this._drawerMode === deviceId) this._drawerMode = null;
        if (this._selectedDeviceId === deviceId) this._selectedDeviceId = null;
        this._showToast("Device removed");
      } catch (err) {
        this._showToast(err?.message || "Delete failed");
      }
    });
  }

  async _saveGlobalRestrictionsList(list) {
    return this._runProtectedAction("settings", async () => {
      try {
        await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/save_global_restrictions`,
          restrictions: list.map((r) => ({
            entity: r.entity,
            name: r.name || null,
            icon: r.icon || null,
          })),
        });
        this._showToast("Global restrictions updated");
      } catch (err) {
        this._showToast(err?.message || "Failed to update restrictions");
      }
    });
  }

  async _saveSecuritySettings() {
    return this._runProtectedAction("settings", async () => {
      try {
        const payload = {
          type: `${ENGINE_DOMAIN}/save_security_settings`,
          pin_enabled: this._secPinEnabled,
          require_pin_for_unlock: this._secReqUnlock,
          require_pin_for_timers: this._secReqTimers,
          require_pin_for_settings: this._secReqSettings,
        };
        if (this._wsData?.security?.pin_enabled) {
          payload.current_pin = this._secCurrentPin;
        }
        if (this._secNewPin.trim() !== "") {
          payload.new_pin = this._secNewPin.trim();
        }
        const res = await this.hass.callWS(payload);
        this._secCurrentPin = "";
        this._secNewPin = "";
        if (res?.security) {
          this._secPinEnabled = Boolean(res.security.pin_enabled);
        }
        this._fireHaptic("success");
        this._showToast("Parental PIN settings saved");
      } catch (err) {
        this._showToast(err?.message || "Failed to save PIN settings");
      }
    });
  }

  async _reconcileAllHistory() {
    this._fireHaptic("light");
    try {
      await this.hass.callWS({
        type: `${ENGINE_DOMAIN}/reconcile_screen_time`,
        device_id: "all",
      });
      this._showToast("Screen time history reconciled");
    } catch (err) {
      this._showToast(err?.message || "Reconcile failed");
    }
  }

  async _importLegacyHelpers() {
    return this._runProtectedAction("settings", async () => {
      try {
        const res = await this.hass.callWS({
          type: `${ENGINE_DOMAIN}/import_legacy_helpers`,
        });
        this._showToast(`Imported ${res?.imported_count || 0} helper device(s)`);
      } catch (err) {
        this._showToast(err?.message || "Import failed");
      }
    });
  }

  // =========================================================================
  // TOUCH / SCROLL GUARD & RING HOLD HANDLERS (Passable Suite Parity)
  // =========================================================================

  _handleRingPointerDown(did) {
    clearTimeout(this._ringHoldTimer);
    this._ringHoldFired = false;
    this._ringHoldTimer = setTimeout(() => {
      this._ringHoldFired = true;
      const dev = this._wsData?.devices?.[did];
      if (dev) {
        this._setLockout(did, !dev.locked);
      }
    }, 450);
  }

  _handleRingPointerUp(did) {
    clearTimeout(this._ringHoldTimer);
    if (!this._ringHoldFired) {
      this._toggleDrawer(did);
    }
    this._ringHoldFired = false;
  }

  _handleRingPointerCancel() {
    clearTimeout(this._ringHoldTimer);
    this._ringHoldFired = false;
  }

  _lockBackgroundScroll() {
    if (this._scrollLockedElements) return;
    const locked = [];
    let el = this;
    while (el) {
      if (el instanceof HTMLElement && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        if (
          (oy === "auto" || oy === "scroll" || oy === "overlay") &&
          el.scrollHeight > el.clientHeight
        ) {
          locked.push({ el, prevOverflowY: el.style.overflowY });
          el.style.overflowY = "hidden";
        }
      }
      if (el.parentElement) el = el.parentElement;
      else if (el.getRootNode && el.getRootNode() instanceof ShadowRoot) {
        el = el.getRootNode().host;
      } else {
        break;
      }
    }
    const docEl = document.documentElement;
    if (docEl) {
      locked.push({ el: docEl, prevOverflowY: docEl.style.overflowY });
      docEl.style.overflowY = "hidden";
    }
    this._scrollLockedElements = locked;
  }

  _unlockBackgroundScroll() {
    if (!this._scrollLockedElements) return;
    for (const item of this._scrollLockedElements) {
      item.el.style.overflowY = item.prevOverflowY;
    }
    this._scrollLockedElements = null;
  }

  _attachOverlayScrollGuard() {
    const overlay = this.shadowRoot?.querySelector(".popup-overlay");
    if (!overlay || this._scrollGuardOverlay === overlay) return;
    this._detachOverlayScrollGuard();
    overlay.addEventListener("wheel", this._onOverlayWheel, { passive: false });
    overlay.addEventListener("touchstart", this._onOverlayTouchStart, {
      passive: true,
    });
    overlay.addEventListener("touchmove", this._onOverlayTouchMove, {
      passive: false,
    });
    this._scrollGuardOverlay = overlay;
  }

  _detachOverlayScrollGuard() {
    const overlay = this._scrollGuardOverlay;
    if (!overlay) return;
    overlay.removeEventListener("wheel", this._onOverlayWheel);
    overlay.removeEventListener("touchstart", this._onOverlayTouchStart);
    overlay.removeEventListener("touchmove", this._onOverlayTouchMove);
    this._scrollGuardOverlay = null;
  }

  _findScrollableInEventPath(ev) {
    const path = ev.composedPath ? ev.composedPath() : [];
    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.classList?.contains("popup-overlay")) break;
      const st = window.getComputedStyle(node);
      if (
        (st.overflowY === "auto" || st.overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        return node;
      }
    }
    return null;
  }

  _onOverlayWheel(ev) {
    const scroller = this._findScrollableInEventPath(ev);
    if (!scroller) {
      if (ev.cancelable) ev.preventDefault();
      return;
    }
    const dy = ev.deltaY;
    const atTop = scroller.scrollTop <= 0;
    const atBottom =
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
    if ((dy < 0 && atTop) || (dy > 0 && atBottom)) {
      if (ev.cancelable) ev.preventDefault();
    }
  }

  _onOverlayTouchStart(ev) {
    if (!ev.touches || ev.touches.length !== 1) return;
    this._guardTouchY = ev.touches[0].clientY;
    this._guardTouchX = ev.touches[0].clientX;
  }

  _onOverlayTouchMove(ev) {
    if (!ev.touches || ev.touches.length !== 1) return;
    const scroller = this._findScrollableInEventPath(ev);
    if (!scroller) {
      if (ev.cancelable) ev.preventDefault();
      return;
    }
    const dy = this._guardTouchY - ev.touches[0].clientY;
    const dx = Math.abs(this._guardTouchX - ev.touches[0].clientX);
    if (dx > Math.abs(dy)) return;
    const atTop = scroller.scrollTop <= 0;
    const atBottom =
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
    if ((dy < 0 && atTop) || (dy > 0 && atBottom)) {
      if (ev.cancelable) ev.preventDefault();
    }
  }

  _handlePopupTouchStart(ev) {
    if (ev.touches.length !== 1) return;
    const scrollArea = ev.currentTarget.querySelector(".modal-scroll-area");
    this._touchInScroll = Boolean(
      scrollArea && scrollArea.contains(ev.target) && scrollArea.scrollTop > 2
    );
    if (this._touchInScroll) return;
    this._touchStartY = ev.touches[0].clientY;
    this._touchStartX = ev.touches[0].clientX;
    this._touchCurrentY = this._touchStartY;
    this._touchTarget = ev.currentTarget;
    this._touchDragging = false;
    this._touchLockedHorizontal = false;
  }

  _handlePopupTouchMove(ev) {
    if (
      this._touchInScroll ||
      this._touchStartY === undefined ||
      this._touchLockedHorizontal
    ) {
      return;
    }
    const curY = ev.touches[0].clientY;
    const curX = ev.touches[0].clientX;
    const dy = curY - this._touchStartY;
    const dx = curX - this._touchStartX;
    if (!this._touchDragging) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        this._touchLockedHorizontal = true;
        return;
      }
      if (dy > 10) {
        this._touchDragging = true;
        this._touchTarget.style.transition = "none";
      } else {
        return;
      }
    }
    this._touchCurrentY = curY;
    const offset = Math.max(0, dy);
    this._touchTarget.style.transform = `translateY(${offset}px)`;
    const overlay = this.shadowRoot?.querySelector(".popup-overlay");
    if (overlay) {
      overlay.style.opacity = String(Math.max(0.25, 1 - offset / 380));
    }
  }

  _handlePopupTouchEnd() {
    const target = this._touchTarget;
    const dy =
      this._touchDragging && this._touchCurrentY !== undefined
        ? this._touchCurrentY - this._touchStartY
        : 0;
    const wasDragging = this._touchDragging;
    this._touchStartY = undefined;
    this._touchStartX = undefined;
    this._touchCurrentY = undefined;
    this._touchTarget = null;
    this._touchDragging = false;
    this._touchInScroll = false;
    this._touchLockedHorizontal = false;
    if (!wasDragging || !target) return;
    const overlay = this.shadowRoot?.querySelector(".popup-overlay");
    if (dy > 110) {
      this._closeModal();
      return;
    }
    target.style.transition = "transform 220ms cubic-bezier(0.2, 0, 0, 1)";
    target.style.transform = "";
    if (overlay) overlay.style.opacity = "";
    this._swipeResetTimer = setTimeout(() => {
      if (target) target.style.transition = "";
    }, 240);
  }

  _handlePopupTouchCancel() {
    if (this._touchTarget) {
      this._touchTarget.style.transition = "";
      this._touchTarget.style.transform = "";
    }
    const overlay = this.shadowRoot?.querySelector(".popup-overlay");
    if (overlay) overlay.style.opacity = "";
    this._touchStartY = undefined;
    this._touchStartX = undefined;
    this._touchCurrentY = undefined;
    this._touchTarget = null;
    this._touchDragging = false;
    this._touchInScroll = false;
    this._touchLockedHorizontal = false;
  }

  // =========================================================================
  // RENDERING: SUMMARY STRIP, DEVICE LAYOUTS, INLINE DRAWER & FOOTER
  // =========================================================================

  _renderSummaryStrip(devices, metrics) {
    const anyLocked = metrics.lockedCount > 0 || metrics.activeRestrictions.length > 0;
    const toneClass =
      metrics.activeRestrictions.length > 0
        ? "danger"
        : metrics.lockedCount > 0
          ? "locked"
          : metrics.timerCount > 0
            ? "timer"
            : metrics.watchingCount > 0
              ? "watching"
              : "idle";

    const pillLabel =
      metrics.totalDevices === 0
        ? "No Devices"
        : anyLocked
          ? `${metrics.lockedCount}/${metrics.totalDevices} Locked`
          : `All ${metrics.totalDevices} Permitted`;

    return html`
      <div class="screen-time-summary-strip ${toneClass}">
        <div class="summary-strip-left">
          <span class="summary-status-dot ${toneClass}"></span>
          <button
            type="button"
            class="strip-active-pill ${this._drawerMode === "all" ? "drawer-open" : ""} ${toneClass}"
            @click=${() => this._toggleDrawer("all")}
            title="Tap to expand all screens"
          >
            ${pillLabel}
          </button>

          ${metrics.nextTimerDev
            ? html`
                <span class="summary-sep">•</span>
                <button
                  type="button"
                  class="zone-inline-chip clickable ${metrics.nextTimerDev.dev.timer_mode === "lock" ? "warning" : "info"}"
                  @click=${() => this._toggleDrawer(metrics.nextTimerDev.did)}
                  title="Active timer on ${metrics.nextTimerDev.dev.name}"
                >
                  <ha-icon icon="mdi:timer-outline" style="--mdc-icon-size:12px;"></ha-icon>
                  <span>${this._formatRemainingCompact(metrics.nextTimerDev.dev)}</span>
                </button>
              `
            : metrics.watchingCount > 0
              ? html`
                  <span class="summary-sep">•</span>
                  <span class="strip-metric-text success">
                    ${metrics.watchingCount} Watching
                  </span>
                `
              : metrics.totalMinutes > 0
                ? html`
                    <span class="summary-sep">•</span>
                    <span class="strip-metric-text">
                      ${this._formatMins(metrics.totalMinutes)} today
                    </span>
                  `
                : ""}
        </div>

        <div class="summary-strip-right">
          ${this._isPinSessionUnlocked()
            ? html`
                <button
                  type="button"
                  class="icon-circle-btn pin-unlocked"
                  @click=${() => this._lockPinSession()}
                  title="Parent session unlocked — tap to lock"
                >
                  <ha-icon icon="mdi:lock-open-check-outline" style="--mdc-icon-size:15px;"></ha-icon>
                </button>
              `
            : ""}

          ${metrics.activeRestrictions.slice(0, 1).map(
            (r) => html`
              <button
                type="button"
                class="zone-inline-chip danger clickable"
                @click=${(ev) => this._toggleRestriction(r.entity, ev)}
                title="${r.name} active — tap to toggle"
              >
                <ha-icon icon="${r.icon || "mdi:shield-alert-outline"}" style="--mdc-icon-size:12px;"></ha-icon>
                <span>${r.name}</span>
              </button>
            `
          )}

          ${metrics.totalDevices > 0
            ? html`
                <button
                  type="button"
                  class="master-pill-btn ${anyLocked ? "locked" : ""}"
                  @click=${(ev) => this._setLockout("all", !anyLocked, {}, ev)}
                  title="${anyLocked ? "Unlock all screens" : "Lock all screens"}"
                >
                  <ha-icon
                    icon="${anyLocked ? "mdi:lock-open-variant" : "mdi:lock"}"
                    style="--mdc-icon-size:13px;"
                  ></ha-icon>
                  <span>${anyLocked ? "Unlock All" : "Lock All"}</span>
                </button>
              `
            : ""}

          ${this.config?.show_stats_button !== false
            ? html`
                <button
                  type="button"
                  class="icon-circle-btn"
                  @click=${(ev) => this._openModal("activity", null, ev)}
                  title="Open Activity & Setup"
                >
                  <ha-icon icon="mdi:chart-bar" style="--mdc-icon-size:15px;"></ha-icon>
                </button>
              `
            : ""}

          <button
            type="button"
            class="icon-circle-btn"
            @click=${(ev) => this._openModal("controls", null, ev)}
            title="Open Screen Time Command Center"
          >
            <ha-icon icon="mdi:tune-variant" style="--mdc-icon-size:15px;"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }

  _getHairlineMetrics(dev) {
    const timerMs = this._getTimerRemainingMs(dev);
    if (timerMs > 0) {
      const pct = this._getTimerProgressPct(dev);
      const color =
        dev.timer_mode === "lock"
          ? "#f59e0b"
          : dev.timer_mode === "wind_down"
            ? "#8b5cf6"
            : "#0ea5e9";
      return { pct, color };
    }
    if (dev.track_screen_time !== false && dev.daily_limit_enabled) {
      const limit = dev.effective_daily_limit_minutes || 120;
      const usage = dev.screen_time_today_minutes || 0;
      const pct = Math.min(100, Math.round((usage / Math.max(1, limit)) * 100));
      const color =
        pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#22c55e";
      return { pct, color };
    }
    return {
      pct: dev.locked ? 100 : 0,
      color: dev.locked ? "#f59e0b" : "#22c55e",
    };
  }

  _renderDeviceTiles(devices) {
    const entries = Object.entries(devices || {});
    const isOdd = entries.length % 2 === 1;
    return html`
      <div class="device-tiles-grid">
        ${entries.map(([did, dev], idx) => {
          const tone = this._getDeviceTone(dev);
          const isSelected = this._drawerMode === did;
          const spanFull = isOdd && idx === entries.length - 1;
          const subline = this._getDeviceSubline(dev);
          const hairline = this._getHairlineMetrics(dev);
          const timerMs = this._getTimerRemainingMs(dev);
          const rightBadge =
            timerMs > 0
              ? this._formatRemainingCompact(dev)
              : dev.track_screen_time !== false
                ? this._formatMins(dev.screen_time_today_minutes || 0)
                : dev.locked
                  ? "Off"
                  : "On";

          return html`
            <div
              class="screen-zone-card tile ${tone} ${isSelected ? "selected" : ""} ${spanFull ? "span-2" : ""}"
              @click=${() => this._toggleDrawer(did)}
              title="Tap to expand quick controls for ${dev.name}"
            >
              <div class="tile-main">
                <div class="tile-identity">
                  <div class="device-icon-wrap compact ${tone}">
                    <ha-icon
                      icon="${this._getDeviceIcon(dev)}"
                      style="--mdc-icon-size:18px;"
                    ></ha-icon>
                  </div>
                  <div class="tile-text">
                    <div class="tile-name-row">
                      <span class="tile-name">${dev.name}</span>
                      ${dev.locked_reason === "restriction"
                        ? html`<span class="status-dot danger" title="Global restriction active"></span>`
                        : dev.manual_unlock_override
                          ? html`<span class="status-dot override" title="Manual override active"></span>`
                          : ""}
                    </div>
                    <div class="tile-sub ${tone}">
                      <span class="sub-truncate">${subline}</span>
                      ${isSelected
                        ? html`<ha-icon icon="mdi:chevron-down" style="--mdc-icon-size:13px;"></ha-icon>`
                        : ""}
                    </div>
                  </div>
                </div>

                <div class="tile-controls">
                  <span class="tile-stat ${tone}">${rightBadge}</span>
                  <button
                    type="button"
                    class="device-lock-btn ${dev.locked ? "locked" : "unlocked"}"
                    @click=${(ev) => this._setLockout(did, !dev.locked, {}, ev)}
                    title="${dev.locked ? `Unlock ${dev.name}` : `Lock ${dev.name}`}"
                  >
                    <ha-icon
                      icon="${dev.locked ? "mdi:lock" : "mdi:lock-open-variant"}"
                      style="--mdc-icon-size:14px;"
                    ></ha-icon>
                  </button>
                </div>
              </div>
              <div class="tile-hairline">
                <div
                  class="tile-hairline-fill"
                  style="width:${hairline.pct}%; background:${hairline.color};"
                ></div>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  _renderDeviceRows(devices) {
    const entries = Object.entries(devices || {});
    return html`
      <div class="device-rows-stack">
        ${entries.map(([did, dev]) => {
          const tone = this._getDeviceTone(dev);
          const isSelected = this._drawerMode === did;
          const subline = this._getDeviceSubline(dev);
          const hairline = this._getHairlineMetrics(dev);
          const timerMs = this._getTimerRemainingMs(dev);

          return html`
            <div
              class="screen-zone-card row ${tone} ${isSelected ? "selected" : ""}"
              @click=${() => this._toggleDrawer(did)}
              title="Tap to expand quick controls for ${dev.name}"
            >
              <div class="row-left">
                <div class="device-icon-wrap ${tone}">
                  <ha-icon
                    icon="${this._getDeviceIcon(dev)}"
                    style="--mdc-icon-size:20px;"
                  ></ha-icon>
                </div>
                <div class="row-text">
                  <div class="row-title-line">
                    <span class="row-title">${dev.name}</span>
                    ${timerMs > 0
                      ? html`<span class="zone-inline-chip ${dev.timer_mode === "lock" ? "warning" : "info"}">${this._formatRemainingCompact(dev)}</span>`
                      : ""}
                    ${dev.active_app && dev.active_app !== "None"
                      ? html`<span class="zone-inline-chip success">▶ ${dev.active_app}</span>`
                      : ""}
                  </div>
                  <div class="row-sub">
                    <span>${subline}</span>
                    <ha-icon
                      icon="${isSelected ? "mdi:chevron-up" : "mdi:chevron-down"}"
                      style="--mdc-icon-size:14px;"
                    ></ha-icon>
                  </div>
                </div>
              </div>

              <div class="row-right">
                <span class="row-stat ${tone}">
                  ${dev.track_screen_time !== false
                    ? this._formatMins(dev.screen_time_today_minutes || 0)
                    : dev.locked
                      ? "Locked"
                      : "Open"}
                </span>
                <button
                  type="button"
                  class="device-lock-btn ${dev.locked ? "locked" : "unlocked"}"
                  @click=${(ev) => this._setLockout(did, !dev.locked, {}, ev)}
                  title="${dev.locked ? `Unlock ${dev.name}` : `Lock ${dev.name}`}"
                >
                  <ha-icon
                    icon="${dev.locked ? "mdi:lock" : "mdi:lock-open-variant"}"
                    style="--mdc-icon-size:15px;"
                  ></ha-icon>
                </button>
              </div>
              <div class="tile-hairline">
                <div
                  class="tile-hairline-fill"
                  style="width:${hairline.pct}%; background:${hairline.color};"
                ></div>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  _renderDeviceRings(devices) {
    const entries = Object.entries(devices || {});
    const r = 16;
    const c = 2 * Math.PI * r;
    const cols = Math.min(5, Math.max(1, entries.length));

    return html`
      <div
        class="device-rings-grid"
        style="grid-template-columns:repeat(${cols}, minmax(0, 1fr));"
      >
        ${entries.map(([did, dev]) => {
          const tone = this._getDeviceTone(dev);
          const isSelected = this._drawerMode === did;
          const hairline = this._getHairlineMetrics(dev);
          const dash = (hairline.pct / 100) * c;
          const timerMs = this._getTimerRemainingMs(dev);
          const centerVal =
            timerMs > 0
              ? this._formatRemainingCompact(dev).replace(" ", "")
              : dev.locked
                ? "LOCK"
                : dev.track_screen_time !== false
                  ? this._formatMins(dev.screen_time_today_minutes || 0)
                  : "ON";

          return html`
            <button
              type="button"
              class="ring-tile-btn ${isSelected ? "selected" : ""}"
              @pointerdown=${() => this._handleRingPointerDown(did)}
              @pointerup=${() => this._handleRingPointerUp(did)}
              @pointercancel=${() => this._handleRingPointerCancel()}
              @pointerleave=${() => this._handleRingPointerCancel()}
              title="Tap: quick drawer • Hold: lock/unlock ${dev.name}"
            >
              <div class="ring-wrap">
                ${svg`
                  <svg class="ring-svg" viewBox="0 0 40 40">
                    <circle
                      cx="20"
                      cy="20"
                      r="${r}"
                      fill="none"
                      stroke="rgba(148,163,184,0.18)"
                      stroke-width="3.2"
                    ></circle>
                    <circle
                      cx="20"
                      cy="20"
                      r="${r}"
                      fill="none"
                      stroke="${hairline.color}"
                      stroke-width="3.2"
                      stroke-linecap="round"
                      stroke-opacity="${hairline.pct > 0 ? 1 : 0}"
                      stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}"
                    ></circle>
                  </svg>
                `}
                <span class="ring-val ${tone}">${centerVal}</span>
              </div>
              <span class="ring-name">${dev.name}</span>
              <span class="ring-sub ${tone}">
                ${dev.locked ? "Locked" : this._isTargetActive(dev) ? "Active" : "Open"}
              </span>
            </button>
          `;
        })}
      </div>
    `;
  }

  _renderConsolidatedHero(devices, restrictions, metrics) {
    const entries = Object.entries(devices || {});
    const anyLocked = metrics.lockedCount > 0 || metrics.activeRestrictions.length > 0;
    const toneClass =
      metrics.activeRestrictions.length > 0
        ? "danger"
        : metrics.lockedCount > 0
          ? "locked"
          : metrics.timerCount > 0
            ? "timer"
            : metrics.watchingCount > 0
              ? "watching"
              : "idle";

    const heroIcon =
      metrics.activeRestrictions.length > 0 || metrics.lockedCount > 0
        ? "mdi:television-off"
        : metrics.watchingCount > 0
          ? "mdi:television-play"
          : "mdi:television-shimmer";

    const watchingEntry = entries.find(([, d]) => this._isTargetActive(d));
    const activeAppEntry = entries.find(
      ([, d]) => this._isTargetActive(d) && d.active_app && d.active_app !== "None"
    );

    let priorityChip = "";
    if (metrics.activeRestrictions.length > 0) {
      const r = metrics.activeRestrictions[0];
      priorityChip = html`
        <button
          type="button"
          class="zone-inline-chip danger clickable"
          @click=${(ev) => this._toggleRestriction(r.entity, ev)}
          title="${r.name} active — tap to toggle"
        >
          <ha-icon icon="${r.icon || "mdi:shield-alert-outline"}" style="--mdc-icon-size:12px;"></ha-icon>
          <span>${r.name}</span>
        </button>
      `;
    } else if (metrics.nextTimerDev) {
      priorityChip = html`
        <span class="zone-inline-chip ${metrics.nextTimerDev.dev.timer_mode === "lock" ? "warning" : "info"}">
          ⏱ ${this._formatRemainingCompact(metrics.nextTimerDev.dev)}
        </span>
      `;
    } else if (activeAppEntry) {
      priorityChip = html`
        <span class="zone-inline-chip success">▶ ${activeAppEntry[1].active_app}</span>
      `;
    } else if (metrics.lockedCount > 0) {
      priorityChip = html`
        <span class="zone-inline-chip warning">${metrics.lockedCount}/${metrics.totalDevices} Locked</span>
      `;
    }

    let statusText = "No devices configured";
    if (metrics.totalDevices > 0) {
      if (metrics.watchingCount > 0) {
        statusText =
          metrics.watchingCount === 1 && watchingEntry
            ? `${watchingEntry[1].name} active`
            : `${metrics.watchingCount} active`;
        if (metrics.lockedCount > 0) {
          statusText += ` · ${metrics.lockedCount} locked`;
        }
      } else if (metrics.lockedCount === metrics.totalDevices) {
        statusText = `All ${metrics.totalDevices} locked`;
      } else if (metrics.lockedCount > 0) {
        statusText = `${metrics.lockedCount} locked · ${metrics.permittedCount} open`;
      } else {
        statusText =
          metrics.totalMinutes > 0
            ? `All open · ${this._formatMins(metrics.totalMinutes)} today`
            : "All permitted";
      }
    }

    const rightVal = metrics.nextTimerDev
      ? this._formatRemainingCompact(metrics.nextTimerDev.dev)
      : metrics.totalMinutes > 0
        ? this._formatMins(metrics.totalMinutes)
        : `${metrics.permittedCount}/${metrics.totalDevices}`;
    const rightSub = metrics.nextTimerDev
      ? "Timer"
      : metrics.totalMinutes > 0
        ? "Today"
        : "Open";

    let hairlinePct = 0;
    let hairlineColor = "#22c55e";
    if (metrics.nextTimerDev) {
      hairlinePct = this._getTimerProgressPct(metrics.nextTimerDev.dev);
      hairlineColor =
        metrics.nextTimerDev.dev.timer_mode === "lock"
          ? "#f59e0b"
          : metrics.nextTimerDev.dev.timer_mode === "wind_down"
            ? "#8b5cf6"
            : "#0ea5e9";
    } else if (metrics.lockedCount > 0 && metrics.totalDevices > 0) {
      hairlinePct = Math.round((metrics.lockedCount / metrics.totalDevices) * 100);
      hairlineColor = metrics.activeRestrictions.length > 0 ? "#ef4444" : "#f59e0b";
    } else {
      const tracked = entries.filter(
        ([, d]) => d.track_screen_time !== false && d.daily_limit_enabled && d.effective_daily_limit_minutes
      );
      if (tracked.length > 0) {
        const maxPct = Math.max(
          ...tracked.map(([, d]) =>
            Math.min(
              100,
              Math.round(
                ((d.screen_time_today_minutes || 0) /
                  Math.max(1, d.effective_daily_limit_minutes)) *
                  100
              )
            )
          )
        );
        hairlinePct = maxPct;
        hairlineColor = maxPct >= 100 ? "#ef4444" : maxPct >= 80 ? "#f59e0b" : "#22c55e";
      }
    }

    const isDrawerOpen = this._drawerMode !== null;

    return html`
      <div
        class="screen-zone-card hero-summary ${toneClass} ${isDrawerOpen ? "selected" : ""}"
        @click=${() => this._openModal("controls")}
        title="Tap to open Screen Time Command Center"
      >
        <div class="hero-zone-header">
          <div class="hero-zone-identity">
            <div class="device-icon-wrap ${toneClass}">
              <ha-icon icon="${heroIcon}" style="--mdc-icon-size:21px;"></ha-icon>
            </div>
            <div class="hero-zone-title-wrap">
              <div class="hero-zone-title-row">
                <h3 class="hero-zone-title">${this.config?.title || "Screen Time"}</h3>
                ${priorityChip}
              </div>
              <div class="hero-zone-subtitle">
                <span class="sub-truncate">${statusText}</span>
                ${metrics.totalDevices > 0
                  ? html`
                      <span class="summary-sep">•</span>
                      <button
                        type="button"
                        class="hero-inline-expand-btn ${isDrawerOpen ? "open" : ""}"
                        @click=${(ev) => this._toggleDrawer("all", ev)}
                        title="${isDrawerOpen ? "Collapse screens" : "Expand all screens"}"
                      >
                        <span>${metrics.totalDevices} Screens</span>
                        <ha-icon
                          icon="${isDrawerOpen ? "mdi:chevron-up" : "mdi:chevron-down"}"
                          style="--mdc-icon-size:14px;"
                        ></ha-icon>
                      </button>
                    `
                  : ""}
              </div>
            </div>
          </div>

          <div class="hero-zone-primary" @click=${(ev) => ev.stopPropagation()}>
            <div class="hero-primary-stack">
              <div class="hero-primary-val ${toneClass}">${rightVal}</div>
              <div class="hero-primary-sub">${rightSub}</div>
            </div>

            ${this._isPinSessionUnlocked()
              ? html`
                  <button
                    type="button"
                    class="icon-circle-btn pin-unlocked"
                    @click=${() => this._lockPinSession()}
                    title="Parent session unlocked — tap to lock"
                  >
                    <ha-icon icon="mdi:lock-open-check-outline" style="--mdc-icon-size:15px;"></ha-icon>
                  </button>
                `
              : ""}

            ${metrics.totalDevices > 0
              ? html`
                  <button
                    type="button"
                    class="device-lock-btn ${anyLocked ? "locked" : "unlocked"}"
                    @click=${(ev) => this._setLockout("all", !anyLocked, {}, ev)}
                    title="${anyLocked ? "Unlock all screens" : "Lock all screens"}"
                  >
                    <ha-icon
                      icon="${anyLocked ? "mdi:lock" : "mdi:lock-open-variant"}"
                      style="--mdc-icon-size:15px;"
                    ></ha-icon>
                  </button>
                `
              : ""}

            <button
              type="button"
              class="icon-circle-btn"
              @click=${(ev) => this._openModal("controls", null, ev)}
              title="Open Screen Time Command Center"
            >
              <ha-icon icon="mdi:tune-variant" style="--mdc-icon-size:15px;"></ha-icon>
            </button>
          </div>
        </div>

        <div class="tile-hairline">
          <div
            class="tile-hairline-fill"
            style="width:${hairlinePct}%; background:${hairlineColor};"
          ></div>
        </div>
      </div>
    `;
  }

  _renderMinimalStripCard(devices, metrics) {
    const anyLocked = metrics.lockedCount > 0 || metrics.activeRestrictions.length > 0;
    const toneClass =
      metrics.activeRestrictions.length > 0
        ? "danger"
        : metrics.lockedCount > 0
          ? "locked"
          : metrics.timerCount > 0
            ? "timer"
            : metrics.watchingCount > 0
              ? "watching"
              : "idle";

    const isDrawerOpen = this._drawerMode !== null;
    const pillLabel =
      metrics.totalDevices === 0
        ? "No Devices"
        : anyLocked
          ? `${metrics.lockedCount}/${metrics.totalDevices} Locked`
          : `All ${metrics.totalDevices} Open`;

    return html`
      <div class="screen-time-summary-strip ${toneClass}">
        <div class="summary-strip-left">
          <span class="summary-status-dot ${toneClass}"></span>
          ${this.config?.title
            ? html`<span class="strip-brand-title">${this.config.title}</span>`
            : ""}
          <button
            type="button"
            class="strip-active-pill ${isDrawerOpen ? "drawer-open" : ""} ${toneClass}"
            @click=${() => this._toggleDrawer("all")}
            title="${isDrawerOpen ? "Collapse screens" : "Tap to expand screens"}"
          >
            ${pillLabel} ${isDrawerOpen ? "▴" : "▾"}
          </button>

          ${metrics.nextTimerDev
            ? html`
                <span class="summary-sep">•</span>
                <button
                  type="button"
                  class="zone-inline-chip clickable ${metrics.nextTimerDev.dev.timer_mode === "lock" ? "warning" : "info"}"
                  @click=${() => this._toggleDrawer(metrics.nextTimerDev.did)}
                >
                  <ha-icon icon="mdi:timer-outline" style="--mdc-icon-size:12px;"></ha-icon>
                  <span>${this._formatRemainingCompact(metrics.nextTimerDev.dev)}</span>
                </button>
              `
            : metrics.watchingCount > 0
              ? html`
                  <span class="summary-sep">•</span>
                  <span class="strip-metric-text success">${metrics.watchingCount} Active</span>
                `
              : metrics.totalMinutes > 0
                ? html`
                    <span class="summary-sep">•</span>
                    <span class="strip-metric-text">${this._formatMins(metrics.totalMinutes)}</span>
                  `
                : ""}
        </div>

        <div class="summary-strip-right">
          ${this._isPinSessionUnlocked()
            ? html`
                <button
                  type="button"
                  class="icon-circle-btn pin-unlocked"
                  @click=${() => this._lockPinSession()}
                  title="Parent session unlocked — tap to lock"
                >
                  <ha-icon icon="mdi:lock-open-check-outline" style="--mdc-icon-size:15px;"></ha-icon>
                </button>
              `
            : ""}

          ${metrics.activeRestrictions.slice(0, 1).map(
            (r) => html`
              <button
                type="button"
                class="zone-inline-chip danger clickable"
                @click=${(ev) => this._toggleRestriction(r.entity, ev)}
              >
                <span>${r.name}</span>
              </button>
            `
          )}

          ${metrics.totalDevices > 0
            ? html`
                <button
                  type="button"
                  class="master-pill-btn ${anyLocked ? "locked" : ""}"
                  @click=${(ev) => this._setLockout("all", !anyLocked, {}, ev)}
                  title="${anyLocked ? "Unlock all screens" : "Lock all screens"}"
                >
                  <ha-icon
                    icon="${anyLocked ? "mdi:lock-open-variant" : "mdi:lock"}"
                    style="--mdc-icon-size:13px;"
                  ></ha-icon>
                  <span>${anyLocked ? "Unlock" : "Lock"}</span>
                </button>
              `
            : ""}

          ${this.config?.show_stats_button !== false
            ? html`
                <button
                  type="button"
                  class="icon-circle-btn"
                  @click=${(ev) => this._openModal("activity", null, ev)}
                  title="Open Activity & Setup"
                >
                  <ha-icon icon="mdi:chart-bar" style="--mdc-icon-size:15px;"></ha-icon>
                </button>
              `
            : ""}

          <button
            type="button"
            class="icon-circle-btn"
            @click=${(ev) => this._openModal("controls", null, ev)}
            title="Open Screen Time Command Center"
          >
            <ha-icon icon="mdi:tune-variant" style="--mdc-icon-size:15px;"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }

  _renderActiveOnlyDevices(devices, metrics) {
    const activeEntries = Object.entries(devices || {}).filter(
      ([, d]) => this._isTargetActive(d) || this._getTimerRemainingMs(d) > 0
    );
    if (activeEntries.length > 0) {
      return this._renderDeviceTiles(Object.fromEntries(activeEntries));
    }
    if (this.config?.show_summary_strip === false) {
      return html`
        <div
          class="active-idle-row"
          @click=${() => this._toggleDrawer("all")}
          title="Tap to expand all screens"
        >
          <span>All ${metrics.totalDevices} screens idle — tap to expand</span>
          <ha-icon icon="mdi:chevron-down" style="--mdc-icon-size:15px;"></ha-icon>
        </div>
      `;
    }
    return "";
  }

  _renderInlineDrawer(devices) {
    if (!this._drawerMode) return "";

    if (this._drawerMode === "all") {
      const entries = Object.entries(devices || {}).filter(([, d]) => {
        if (this._drawerFilter === "locked") return Boolean(d.locked);
        if (this._drawerFilter === "active") return this._isTargetActive(d);
        return true;
      });
      return html`
        <div class="screen-time-drawer">
          <div class="drawer-header">
            <div class="drawer-title-group">
              <span class="drawer-title">All Screens (${entries.length})</span>
              ${["all", "locked", "active"].map(
                (f) => html`
                  <button
                    type="button"
                    class="drawer-filter-btn ${this._drawerFilter === f ? "active" : ""}"
                    @click=${() => (this._drawerFilter = f)}
                  >
                    ${f === "all" ? "All" : f === "locked" ? "Locked" : "Active"}
                  </button>
                `
              )}
            </div>
            <div class="drawer-actions">
              <button
                type="button"
                class="drawer-manage-btn"
                @click=${(ev) => this._openModal("controls", null, ev)}
              >
                <span>Manage</span>
                <ha-icon icon="mdi:open-in-new" style="--mdc-icon-size:13px;"></ha-icon>
              </button>
              <button
                type="button"
                class="drawer-close-btn"
                @click=${() => (this._drawerMode = null)}
                title="Close drawer"
              >
                <ha-icon icon="mdi:close" style="--mdc-icon-size:16px;"></ha-icon>
              </button>
            </div>
          </div>

          <div class="drawer-list thin-scroll">
            ${entries.length === 0
              ? html`<div class="drawer-empty">No matching devices in this filter.</div>`
              : entries.map(([did, dev]) => {
                  const tone = this._getDeviceTone(dev);
                  const isActive = this._isTargetActive(dev);
                  return html`
                    <div class="drawer-device-row ${tone}">
                      <div
                        class="drawer-dev-left clickable"
                        @click=${() => (this._drawerMode = did)}
                        title="Tap for ${dev.name} quick timers & lockout options"
                      >
                        <div class="device-icon-wrap compact ${tone}">
                          <ha-icon icon="${this._getDeviceIcon(dev)}" style="--mdc-icon-size:16px;"></ha-icon>
                        </div>
                        <div class="drawer-dev-text">
                          <div class="drawer-dev-name">${dev.name}</div>
                          <div class="drawer-dev-sub">${this._getDeviceSubline(dev)}</div>
                        </div>
                      </div>
                      <div class="drawer-dev-actions">
                        ${dev.locked
                          ? html`
                              <button
                                type="button"
                                class="quick-chip sky"
                                @click=${(ev) =>
                                  this._startTimerAction(
                                    did,
                                    { mode: "unlock", duration: 20, unit: "minutes" },
                                    ev
                                  )}
                              >
                                +20m
                              </button>
                            `
                          : html`
                              <button
                                type="button"
                                class="quick-chip amber"
                                @click=${(ev) =>
                                  this._startTimerAction(
                                    did,
                                    { mode: "lock", duration: 30, unit: "minutes" },
                                    ev
                                  )}
                              >
                                Lock 30m
                              </button>
                            `}
                        <button
                          type="button"
                          class="icon-mini-btn ${isActive ? "active" : ""}"
                          @click=${(ev) => this._toggleDevicePower(dev, ev)}
                          title="Toggle Power / Wi-Fi"
                        >
                          <ha-icon icon="mdi:power" style="--mdc-icon-size:14px;"></ha-icon>
                        </button>
                        <button
                          type="button"
                          class="device-lock-btn ${dev.locked ? "locked" : "unlocked"}"
                          @click=${(ev) => this._setLockout(did, !dev.locked, {}, ev)}
                        >
                          <ha-icon
                            icon="${dev.locked ? "mdi:lock" : "mdi:lock-open-variant"}"
                            style="--mdc-icon-size:14px;"
                          ></ha-icon>
                        </button>
                      </div>
                    </div>
                  `;
                })}
          </div>
        </div>
      `;
    }

    const did = this._drawerMode;
    const dev = devices?.[did];
    if (!dev) return "";
    const tone = this._getDeviceTone(dev);
    const isActive = this._isTargetActive(dev);
    const timerMs = this._getTimerRemainingMs(dev);
    const isSwitch = dev.device_type === "network_switch";

    return html`
      <div class="screen-time-drawer">
        <div class="drawer-header">
          <div class="drawer-title-group">
            <div class="device-icon-wrap compact ${tone}">
              <ha-icon icon="${this._getDeviceIcon(dev)}" style="--mdc-icon-size:16px;"></ha-icon>
            </div>
            <div>
              <div class="drawer-title">${dev.name}</div>
              <div class="drawer-sub">${this._getDeviceSubline(dev)}</div>
            </div>
          </div>

          <div class="drawer-actions">
            <button
              type="button"
              class="drawer-filter-btn"
              @click=${() => (this._drawerMode = "all")}
              title="Back to all screens"
            >
              ← All
            </button>
            <button
              type="button"
              class="drawer-filter-btn ${isActive ? "active" : ""}"
              @click=${(ev) => this._toggleDevicePower(dev, ev)}
              title="${isSwitch ? "Toggle Wi-Fi Pause" : "Toggle Power"}"
            >
              <ha-icon icon="mdi:power" style="--mdc-icon-size:13px;"></ha-icon>
              <span>${isSwitch ? (isActive ? "Wi-Fi On" : "Paused") : isActive ? "On" : "Off"}</span>
            </button>
            <button
              type="button"
              class="drawer-manage-btn"
              @click=${(ev) => this._openModal("schedules", did, ev)}
            >
              <span>Schedules</span>
              <ha-icon icon="mdi:open-in-new" style="--mdc-icon-size:13px;"></ha-icon>
            </button>
            <button
              type="button"
              class="drawer-close-btn"
              @click=${() => (this._drawerMode = null)}
              title="Collapse drawer"
            >
              <ha-icon icon="mdi:close" style="--mdc-icon-size:16px;"></ha-icon>
            </button>
          </div>
        </div>

        ${timerMs > 0
          ? html`
              <div class="drawer-timer-banner ${dev.timer_mode === "lock" ? "amber" : dev.timer_mode === "wind_down" ? "violet" : "sky"}">
                <div class="drawer-timer-info">
                  <ha-icon icon="mdi:timer-sand" style="--mdc-icon-size:15px;"></ha-icon>
                  <span>
                    ${dev.timer_mode === "lock"
                      ? "Lockout Timer"
                      : dev.timer_mode === "wind_down"
                        ? "Wind-Down"
                        : "Viewing Timer"}
                    · <strong>${this._formatRemainingCompact(dev)}</strong>
                  </span>
                </div>
                <div class="drawer-timer-btns">
                  <button type="button" class="quick-chip" @click=${(ev) => this._extendTimer(did, 5, ev)}>+5m</button>
                  <button type="button" class="quick-chip" @click=${(ev) => this._extendTimer(did, 15, ev)}>+15m</button>
                  <button type="button" class="quick-chip danger" @click=${(ev) => this._cancelTimer(did, ev)}>Cancel</button>
                </div>
              </div>
            `
          : ""}

        <div class="drawer-quick-grid">
          <div class="quick-group">
            <span class="quick-group-label">Lockout</span>
            <div class="quick-chips-row">
              <button
                type="button"
                class="quick-chip ${dev.locked ? "green" : "amber"}"
                @click=${(ev) => this._setLockout(did, !dev.locked, {}, ev)}
              >
                ${dev.locked ? "Unlock Now" : "Lock Now"}
              </button>
              <button
                type="button"
                class="quick-chip amber"
                @click=${(ev) =>
                  this._startTimerAction(did, { mode: "lock", duration: 30, unit: "minutes" }, ev)}
              >
                Lock 30m
              </button>
              <button
                type="button"
                class="quick-chip amber"
                @click=${(ev) =>
                  this._startTimerAction(did, { mode: "lock", duration: 60, unit: "minutes" }, ev)}
              >
                Lock 1h
              </button>
              <button
                type="button"
                class="quick-chip danger"
                @click=${(ev) =>
                  this._setLockout(did, true, { rest_of_day: true }, ev)}
              >
                Rest of Day
              </button>
            </div>
          </div>

          <div class="quick-group">
            <span class="quick-group-label">
              ${dev.locked ? "Allow Viewing" : "Wind-Down & Bonus"}
            </span>
            <div class="quick-chips-row">
              ${dev.locked
                ? html`
                    ${[15, 20, 30, 45].map(
                      (m) => html`
                        <button
                          type="button"
                          class="quick-chip sky"
                          @click=${(ev) =>
                            this._startTimerAction(
                              did,
                              { mode: "unlock", duration: m, unit: "minutes" },
                              ev
                            )}
                        >
                          Allow ${m}m
                        </button>
                      `
                    )}
                  `
                : html`
                    ${[5, 10, 15].map(
                      (m) => html`
                        <button
                          type="button"
                          class="quick-chip violet"
                          @click=${(ev) =>
                            this._startTimerAction(
                              did,
                              { mode: "wind_down", duration: m, unit: "minutes" },
                              ev
                            )}
                        >
                          Wind-Down ${m}m
                        </button>
                      `
                    )}
                    <button
                      type="button"
                      class="quick-chip sky"
                      @click=${(ev) =>
                        this._startTimerAction(
                          did,
                          { mode: "unlock", duration: 20, unit: "minutes" },
                          ev
                        )}
                    >
                      Allow 20m
                    </button>
                  `}
              ${dev.track_screen_time !== false && dev.daily_limit_enabled
                ? html`
                    <button
                      type="button"
                      class="quick-chip green"
                      @click=${(ev) => this._adjustBonusTime(did, 15, false, ev)}
                    >
                      +15m Limit
                    </button>
                  `
                : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderFooterStrip(restrictions, metrics) {
    if (this.config?.show_footer_strip === false) return "";
    return html`
      <div class="engine-footer-strip">
        <div class="footer-chips">
          ${(restrictions || []).map((r) => {
            const isOn = this.hass?.states?.[r.entity]?.state === "on" || r.is_active;
            return html`
              <button
                type="button"
                class="footer-chip ${isOn ? "danger" : ""}"
                @click=${(ev) => this._toggleRestriction(r.entity, ev)}
                title="Toggle household restriction: ${r.name}"
              >
                <ha-icon icon="${r.icon || "mdi:shield-alert-outline"}" style="--mdc-icon-size:13px;"></ha-icon>
                <span>${r.name}</span>
              </button>
            `;
          })}
          <button
            type="button"
            class="footer-chip ${metrics.scheduleEnabledCount > 0 ? "sky" : ""}"
            @click=${(ev) => this._openModal("schedules", null, ev)}
          >
            <ha-icon icon="mdi:calendar-clock" style="--mdc-icon-size:13px;"></ha-icon>
            <span>Schedules · ${metrics.scheduleEnabledCount}/${metrics.totalDevices}</span>
          </button>
          <button
            type="button"
            class="footer-chip ${metrics.timerCount > 0 ? "amber" : ""}"
            @click=${(ev) => this._openModal("timers", null, ev)}
          >
            <ha-icon icon="mdi:timer-sand" style="--mdc-icon-size:13px;"></ha-icon>
            <span>Timers${metrics.timerCount > 0 ? ` · ${metrics.timerCount}` : ""}</span>
          </button>
        </div>

        <button
          type="button"
          class="footer-command-link"
          @click=${(ev) => this._openModal("controls", null, ev)}
        >
          Command Center →
        </button>
      </div>
    `;
  }

  // =========================================================================
  // 4-TAB COMMAND CENTER VIEWS
  // =========================================================================

  _renderModalControlsTab(devices, restrictions, metrics) {
    const entries = Object.entries(devices || {});
    const anyLocked = metrics.lockedCount > 0 || metrics.activeRestrictions.length > 0;

    return html`
      <div class="modal-tab-body">
        <div class="kpi-grid">
          <div class="kpi-card ${metrics.lockedCount > 0 ? "warn" : ""}">
            <span class="kpi-label">Locked</span>
            <span class="kpi-val ${metrics.lockedCount > 0 ? "amber" : "green"}">
              ${metrics.lockedCount}/${metrics.totalDevices}
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Watching</span>
            <span class="kpi-val green">${metrics.watchingCount}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Timers</span>
            <span class="kpi-val sky">${metrics.timerCount}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Today</span>
            <span class="kpi-val">${this._formatMins(metrics.totalMinutes)}</span>
          </div>
        </div>

        <div class="passable-section-card">
          <div class="passable-section-header">
            <span class="passable-section-title">Master & Household Restrictions</span>
            <div style="display:flex; gap:6px; align-items:center;">
              <button
                type="button"
                class="master-pill-btn ${anyLocked ? "locked" : ""}"
                @click=${(ev) => this._setLockout("all", !anyLocked, {}, ev)}
              >
                ${anyLocked ? "Unlock All" : "Lock All"}
              </button>
              <button
                type="button"
                class="quick-chip danger"
                @click=${(ev) => this._setLockout("all", true, { rest_of_day: true }, ev)}
              >
                Rest of Day All
              </button>
            </div>
          </div>

          ${restrictions.length > 0
            ? html`
                <div class="restrictions-chips-wrap">
                  ${restrictions.map((r) => {
                    const isOn = this.hass?.states?.[r.entity]?.state === "on" || r.is_active;
                    return html`
                      <button
                        type="button"
                        class="restriction-pill-btn ${isOn ? "active" : ""}"
                        @click=${(ev) => this._toggleRestriction(r.entity, ev)}
                      >
                        <span class="restriction-dot ${isOn ? "active" : ""}"></span>
                        <span>${r.name}</span>
                        <span class="restriction-state">${isOn ? "ON" : "OFF"}</span>
                      </button>
                    `;
                  })}
                </div>
              `
            : html`
                <div class="muted-hint">
                  No household restriction entities configured.
                  ${!this.config?.hide_admin_setup
                    ? html`<button
                        type="button"
                        class="inline-link-btn"
                        @click=${() => {
                          this._modalTab = "activity";
                          this._activitySubTab = "setup";
                        }}
                      >Configure in Setup →</button>`
                    : ""}
                </div>
              `}
        </div>

        ${entries.length === 0
          ? html`
              <div class="modal-empty-state">
                No screen time devices configured yet.
                ${!this.config?.hide_admin_setup
                  ? html` Open <strong>Activity → Setup</strong> to add TVs or switches.`
                  : ""}
              </div>
            `
          : entries.map(([did, dev]) => {
              const tone = this._getDeviceTone(dev);
              const isActive = this._isTargetActive(dev);
              const timerMs = this._getTimerRemainingMs(dev);
              const usage = dev.screen_time_today_minutes || 0;
              const limit = dev.effective_daily_limit_minutes;
              const pct =
                dev.track_screen_time !== false && dev.daily_limit_enabled && limit
                  ? Math.min(100, Math.round((usage / Math.max(1, limit)) * 100))
                  : 0;

              return html`
                <div class="passable-section-card device-control-card ${tone}">
                  <div class="room-card-header">
                    <div class="room-card-title-group">
                      <div class="device-icon-wrap compact ${tone}">
                        <ha-icon icon="${this._getDeviceIcon(dev)}" style="--mdc-icon-size:17px;"></ha-icon>
                      </div>
                      <div>
                        <div class="room-card-title">${dev.name}</div>
                        <div class="drawer-sub">${this._getDeviceSubline(dev)}</div>
                      </div>
                    </div>

                    <div class="room-card-controls">
                      <button
                        type="button"
                        class="icon-mini-btn ${isActive ? "active" : ""}"
                        @click=${(ev) => this._toggleDevicePower(dev, ev)}
                        title="Toggle Power / Wi-Fi"
                      >
                        <ha-icon icon="mdi:power" style="--mdc-icon-size:15px;"></ha-icon>
                      </button>
                      <button
                        type="button"
                        class="room-pill-toggle ${dev.locked ? "amber" : "green"}"
                        @click=${(ev) => this._setLockout(did, !dev.locked, {}, ev)}
                      >
                        ${dev.locked ? "Locked · Unlock" : "Permitted · Lock"}
                      </button>
                    </div>
                  </div>

                  ${timerMs > 0
                    ? html`
                        <div class="drawer-timer-banner ${dev.timer_mode === "lock" ? "amber" : dev.timer_mode === "wind_down" ? "violet" : "sky"}">
                          <div class="drawer-timer-info">
                            <ha-icon icon="mdi:timer-sand" style="--mdc-icon-size:14px;"></ha-icon>
                            <span>${dev.timer_mode === "lock" ? "Lockout" : dev.timer_mode === "wind_down" ? "Wind-Down" : "Viewing"}: <strong>${this._formatRemainingCompact(dev)}</strong></span>
                          </div>
                          <div class="drawer-timer-btns">
                            <button type="button" class="quick-chip" @click=${(ev) => this._extendTimer(did, 15, ev)}>+15m</button>
                            <button type="button" class="quick-chip danger" @click=${(ev) => this._cancelTimer(did, ev)}>Cancel</button>
                          </div>
                        </div>
                      `
                    : ""}

                  ${dev.track_screen_time !== false
                    ? html`
                        <div class="usage-progress-row">
                          <div class="usage-progress-labels">
                            <span>Screen Time Today</span>
                            <span>
                              <strong>${this._formatMins(usage)}</strong>
                              ${dev.daily_limit_enabled && limit
                                ? ` / ${this._formatMins(limit)}${dev.bonus_minutes_today ? ` (+${dev.bonus_minutes_today}m bonus)` : ""}`
                                : " (Unlimited)"}
                            </span>
                          </div>
                          ${dev.daily_limit_enabled && limit
                            ? html`
                                <div class="progress-track">
                                  <div
                                    class="progress-fill ${pct >= 100 ? "over" : pct >= 80 ? "warn" : ""}"
                                    style="width:${pct}%"
                                  ></div>
                                </div>
                              `
                            : ""}
                        </div>
                      `
                    : ""}

                  <div class="control-card-actions">
                    <button
                      type="button"
                      class="quick-chip sky"
                      @click=${() => {
                        this._selectedDeviceId = did;
                        this._timerScope = did;
                        this._modalTab = "timers";
                      }}
                    >
                      ⏱ Timers
                    </button>
                    <button
                      type="button"
                      class="quick-chip"
                      @click=${() => {
                        this._selectDevice(did);
                        this._modalTab = "schedules";
                      }}
                    >
                      📅 Schedule
                    </button>
                    <button
                      type="button"
                      class="quick-chip danger"
                      @click=${(ev) => this._setLockout(did, true, { rest_of_day: true }, ev)}
                    >
                      Rest of Day
                    </button>
                    ${dev.track_screen_time !== false && dev.daily_limit_enabled
                      ? html`
                          <button
                            type="button"
                            class="quick-chip green"
                            @click=${(ev) => this._adjustBonusTime(did, 15, false, ev)}
                          >
                            +15m Bonus
                          </button>
                        `
                      : ""}
                  </div>
                </div>
              `;
            })}
      </div>
    `;
  }

  _renderModalTimersTab(devices) {
    const entries = Object.entries(devices || {});
    const activeTimerEntries = entries.filter(
      ([, d]) => this._getTimerRemainingMs(d) > 0
    );

    const presets =
      this._timerMode === "wind_down"
        ? [
            { label: "5m", val: 5, unit: "minutes" },
            { label: "10m", val: 10, unit: "minutes" },
            { label: "15m", val: 15, unit: "minutes" },
            { label: "20m", val: 20, unit: "minutes" },
            { label: "30m", val: 30, unit: "minutes" },
          ]
        : this._timerMode === "lock"
          ? [
              { label: "15m", val: 15, unit: "minutes" },
              { label: "30m", val: 30, unit: "minutes" },
              { label: "45m", val: 45, unit: "minutes" },
              { label: "1h", val: 1, unit: "hours" },
              { label: "2h", val: 2, unit: "hours" },
            ]
          : [
              { label: "15m", val: 15, unit: "minutes" },
              { label: "20m", val: 20, unit: "minutes" },
              { label: "30m", val: 30, unit: "minutes" },
              { label: "45m", val: 45, unit: "minutes" },
              { label: "1h", val: 1, unit: "hours" },
              { label: "2h", val: 2, unit: "hours" },
            ];

    return html`
      <div class="modal-tab-body">
        <!-- Target Scope Selector -->
        <div class="device-switcher-row">
          <button
            type="button"
            class="device-switch-pill ${this._timerScope === "all" ? "active" : ""}"
            @click=${() => (this._timerScope = "all")}
          >
            All Screens
          </button>
          ${entries.map(
            ([did, dev]) => html`
              <button
                type="button"
                class="device-switch-pill ${this._timerScope === did ? "active" : ""}"
                @click=${() => (this._timerScope = did)}
              >
                <ha-icon icon="${this._getDeviceIcon(dev)}" style="--mdc-icon-size:13px;"></ha-icon>
                <span>${dev.name}</span>
              </button>
            `
          )}
        </div>

        <!-- Active Timers -->
        ${activeTimerEntries.length > 0
          ? html`
              <div class="passable-section-card">
                <div class="passable-section-header">
                  <span class="passable-section-title">Active Timers (${activeTimerEntries.length})</span>
                </div>
                ${activeTimerEntries.map(
                  ([did, dev]) => html`
                    <div class="drawer-timer-banner ${dev.timer_mode === "lock" ? "amber" : dev.timer_mode === "wind_down" ? "violet" : "sky"}">
                      <div class="drawer-timer-info">
                        <ha-icon icon="${this._getDeviceIcon(dev)}" style="--mdc-icon-size:15px;"></ha-icon>
                        <span>
                          <strong>${dev.name}</strong> ·
                          ${dev.timer_mode === "lock"
                            ? "Locked"
                            : dev.timer_mode === "wind_down"
                              ? "Wind-Down"
                              : "Viewing"}
                          (${this._formatRemainingCompact(dev)})
                        </span>
                      </div>
                      <div class="drawer-timer-btns">
                        <button type="button" class="quick-chip" @click=${(ev) => this._extendTimer(did, 5, ev)}>+5m</button>
                        <button type="button" class="quick-chip" @click=${(ev) => this._extendTimer(did, 15, ev)}>+15m</button>
                        <button type="button" class="quick-chip danger" @click=${(ev) => this._cancelTimer(did, ev)}>Cancel</button>
                      </div>
                    </div>
                  `
                )}
              </div>
            `
          : ""}

        <!-- Timer Mode Tabs -->
        <div class="segmented-tabs">
          <button
            type="button"
            class="seg-tab ${this._timerMode === "unlock" ? "active sky" : ""}"
            @click=${() => {
              this._timerMode = "unlock";
              this._timerDuration = 20;
              this._timerUnit = "minutes";
            }}
          >
            Allow Viewing
          </button>
          <button
            type="button"
            class="seg-tab ${this._timerMode === "lock" ? "active amber" : ""}"
            @click=${() => {
              this._timerMode = "lock";
              this._timerDuration = 30;
              this._timerUnit = "minutes";
            }}
          >
            Temp Lockout
          </button>
          <button
            type="button"
            class="seg-tab ${this._timerMode === "wind_down" ? "active violet" : ""}"
            @click=${() => {
              this._timerMode = "wind_down";
              this._timerDuration = 10;
              this._timerUnit = "minutes";
            }}
          >
            Wind-Down
          </button>
        </div>

        <div class="passable-section-card">
          <div class="passable-section-header">
            <span class="passable-section-title">
              ${this._timerMode === "unlock"
                ? "Allow Temporary Viewing (One More Show)"
                : this._timerMode === "lock"
                  ? "Lock Temporarily & Auto-Unlock"
                  : "Finish Episode & Auto-Lock"}
            </span>
          </div>
          <p class="muted-hint">
            ${this._timerMode === "unlock"
              ? "Unlocks immediately (bypasses schedules & daily limits while active) and locks automatically when time expires."
              : this._timerMode === "lock"
                ? "Locks and turns off the device immediately, then automatically unlocks when the timer expires (unless inside an active schedule)."
                : "Keeps the screen unlocked during the countdown, then automatically locks and powers off when time is up."}
          </p>

          <div class="preset-chips-row">
            ${presets.map(
              (p) => html`
                <button
                  type="button"
                  class="preset-chip ${this._timerDuration === p.val && this._timerUnit === p.unit ? "active" : ""}"
                  @click=${() => {
                    this._timerDuration = p.val;
                    this._timerUnit = p.unit;
                  }}
                >
                  ${p.label}
                </button>
              `
            )}
          </div>

          <div class="two-col-grid">
            <div class="field-group">
              <label class="field-label">Duration</label>
              <input
                type="number"
                min="1"
                class="field-input"
                .value=${String(this._timerDuration)}
                @input=${(e) =>
                  (this._timerDuration = Math.max(1, parseFloat(e.target.value) || 1))}
              />
            </div>
            <div class="field-group">
              <label class="field-label">Unit</label>
              <select
                class="field-input"
                .value=${this._timerUnit}
                @change=${(e) => (this._timerUnit = e.target.value)}
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          </div>

          ${this._timerMode === "unlock"
            ? html`
                <label class="inline-check-row">
                  <input
                    type="checkbox"
                    .checked=${this._timerPowerOn}
                    @change=${(e) => (this._timerPowerOn = e.target.checked)}
                  />
                  <span>Power on TV / media player immediately</span>
                </label>
              `
            : ""}

          <button
            type="button"
            class="primary-cta-btn ${this._timerMode === "lock" ? "amber" : this._timerMode === "wind_down" ? "violet" : "sky"}"
            @click=${() =>
              this._startTimerAction(this._timerScope, {
                mode: this._timerMode,
                duration: this._timerDuration,
                unit: this._timerUnit,
                power_on: this._timerMode === "unlock" ? this._timerPowerOn : false,
              })}
          >
            <ha-icon icon="mdi:play" style="--mdc-icon-size:17px;"></ha-icon>
            <span>
              ${this._timerMode === "unlock"
                ? `Allow ${this._timerDuration} ${this._timerUnit}`
                : this._timerMode === "lock"
                  ? `Lock for ${this._timerDuration} ${this._timerUnit}`
                  : `Lock in ${this._timerDuration} ${this._timerUnit}`}
            </span>
          </button>

          <!-- Until Specific Time & Rest-of-Day Shortcut -->
          <div class="until-row">
            <div class="field-group" style="flex:1;">
              <label class="field-label">Or Until Local Time</label>
              <input
                type="time"
                class="field-input"
                .value=${this._timerUntilTime}
                @change=${(e) => (this._timerUntilTime = e.target.value)}
              />
            </div>
            <button
              type="button"
              class="secondary-cta-btn"
              @click=${() =>
                this._startTimerAction(this._timerScope, {
                  mode: this._timerMode,
                  until_time: this._timerUntilTime,
                  power_on: this._timerMode === "unlock" ? this._timerPowerOn : false,
                })}
            >
              ${this._timerMode === "lock" ? "Lock Until" : this._timerMode === "wind_down" ? "Wind-Down Until" : "Allow Until"} ${this._formatTime12(this._timerUntilTime)}
            </button>
          </div>

          ${this._timerMode === "lock"
            ? html`
                <button
                  type="button"
                  class="danger-outline-btn"
                  @click=${(ev) =>
                    this._setLockout(this._timerScope, true, { rest_of_day: true }, ev)}
                >
                  <ha-icon icon="mdi:weather-night" style="--mdc-icon-size:16px;"></ha-icon>
                  <span>Lock for Rest of Today (Clears at Midnight)</span>
                </button>
              `
            : ""}
        </div>
      </div>
    `;
  }

  _renderModalSchedulesTab(devices) {
    const entries = Object.entries(devices || {});
    if (entries.length === 0) {
      return html`<div class="modal-empty-state">Add a device first to configure schedules.</div>`;
    }

    const did = this._selectedDeviceId && devices[this._selectedDeviceId]
      ? this._selectedDeviceId
      : entries[0][0];
    const dev = devices[did];
    if (!this._schedDraft || this._schedDraft.deviceId !== did) {
      this._loadSchedDraft(did, dev);
    }
    const draft = this._schedDraft;
    const otherDevices = entries.filter(([id]) => id !== did);
    const nextEv = dev.next_schedule_event;

    return html`
      <div class="modal-tab-body">
        <!-- Device Switcher -->
        <div class="device-switcher-row">
          ${entries.map(
            ([id, d]) => html`
              <button
                type="button"
                class="device-switch-pill ${id === did ? "active" : ""}"
                @click=${() => this._selectDevice(id)}
              >
                <ha-icon icon="${this._getDeviceIcon(d)}" style="--mdc-icon-size:13px;"></ha-icon>
                <span>${d.name}</span>
              </button>
            `
          )}
        </div>

        <!-- Master Schedule Toggle + Next Transition Banner -->
        <div class="passable-section-card">
          <div class="switch-control-row">
            <div>
              <div class="switch-title">Automated Downtime Schedules</div>
              <div class="switch-sub">
                ${dev.in_schedule_window
                  ? `Active now: ${dev.active_schedule_name || "Downtime"}${nextEv ? ` • unlocks ${nextEv.day} ${this._formatTime12(nextEv.time)}` : ""}`
                  : nextEv
                    ? `Next lockout: ${nextEv.rule_name} (${nextEv.day} ${this._formatTime12(nextEv.time)})`
                    : draft.schedule_enabled
                      ? "No upcoming transitions in next 7 days"
                      : "Schedules paused for this device"}
              </div>
            </div>
            <button
              type="button"
              class="m3-switch ${draft.schedule_enabled ? "on" : ""}"
              @click=${() =>
                this._updateSchedDraft({ schedule_enabled: !draft.schedule_enabled })}
            >
              <span class="m3-knob"></span>
            </button>
          </div>
        </div>

        <!-- Schedule Windows List -->
        <div class="passable-section-card" style="opacity:${draft.schedule_enabled ? 1 : 0.6};">
          <div class="passable-section-header">
            <span class="passable-section-title">Downtime Windows (${draft.schedules.length})</span>
            <select
              class="template-select"
              @change=${(e) => {
                if (e.target.value) {
                  this._addScheduleFromTemplate(e.target.value);
                  e.target.value = "";
                }
              }}
            >
              <option value="">+ Add Window...</option>
              ${SCHEDULE_TEMPLATES.map(
                (t) => html`<option value="${t.id}">+ ${t.label}</option>`
              )}
            </select>
          </div>

          ${draft.schedules.length === 0
            ? html`<div class="muted-hint">No schedule windows configured. Use "+ Add Window" above to create one.</div>`
            : draft.schedules.map((rule, idx) => {
                const overnight = this._isOvernight(rule.start, rule.end);
                return html`
                  <div class="schedule-rule-card">
                    <div class="rule-header">
                      <input
                        type="text"
                        class="rule-name-input"
                        .value=${rule.name}
                        @input=${(e) =>
                          this._updateScheduleRule(idx, { name: e.target.value })}
                        placeholder="Schedule name"
                      />
                      <div class="rule-header-actions">
                        ${overnight
                          ? html`<span class="zone-inline-chip info">🌙 Overnight</span>`
                          : ""}
                        <button
                          type="button"
                          class="m3-switch small ${rule.enabled ? "on" : ""}"
                          @click=${() =>
                            this._updateScheduleRule(idx, { enabled: !rule.enabled })}
                          title="${rule.enabled ? "Disable window" : "Enable window"}"
                        >
                          <span class="m3-knob"></span>
                        </button>
                        <button
                          type="button"
                          class="icon-mini-btn danger"
                          @click=${() => this._removeScheduleRule(idx)}
                          title="Delete window"
                        >
                          <ha-icon icon="mdi:trash-can-outline" style="--mdc-icon-size:14px;"></ha-icon>
                        </button>
                      </div>
                    </div>

                    <div class="day-presets-row">
                      ${[
                        { label: "Sun–Thu", days: ["sun", "mon", "tue", "wed", "thu"] },
                        { label: "Mon–Fri", days: ["mon", "tue", "wed", "thu", "fri"] },
                        { label: "Fri–Sat", days: ["fri", "sat"] },
                        { label: "Weekends", days: ["sat", "sun"] },
                        { label: "All", days: [...DAYS_LIST] },
                      ].map(
                        (p) => html`
                          <button
                            type="button"
                            class="tiny-preset-btn"
                            @click=${() =>
                              this._updateScheduleRule(idx, { days: [...p.days] })}
                          >
                            ${p.label}
                          </button>
                        `
                      )}
                    </div>

                    <div class="day-chips">
                      ${DAYS_LIST.map((day, dIdx) => {
                        const sel = (rule.days || []).includes(day);
                        return html`
                          <button
                            type="button"
                            class="day-chip ${sel ? "selected" : ""}"
                            @click=${() => this._toggleRuleDay(idx, day)}
                          >
                            ${DAYS_SHORT[dIdx]}
                          </button>
                        `;
                      })}
                    </div>

                    <div class="two-col-grid">
                      <div class="field-group">
                        <label class="field-label">Lock Starts</label>
                        <input
                          type="time"
                          class="field-input"
                          .value=${rule.start}
                          @change=${(e) =>
                            this._updateScheduleRule(idx, { start: e.target.value })}
                        />
                      </div>
                      <div class="field-group">
                        <label class="field-label">Lock Ends</label>
                        <input
                          type="time"
                          class="field-input"
                          .value=${rule.end}
                          @change=${(e) =>
                            this._updateScheduleRule(idx, { end: e.target.value })}
                        />
                      </div>
                    </div>

                    <div class="recurrence-row">
                      <button
                        type="button"
                        class="seg-mini-btn ${rule.recurrence !== "biweekly" ? "active" : ""}"
                        @click=${() =>
                          this._updateScheduleRule(idx, {
                            recurrence: "weekly",
                            anchor_date: null,
                          })}
                      >
                        Every Week
                      </button>
                      <button
                        type="button"
                        class="seg-mini-btn ${rule.recurrence === "biweekly" ? "active" : ""}"
                        @click=${() =>
                          this._updateScheduleRule(idx, {
                            recurrence: "biweekly",
                            anchor_date:
                              rule.anchor_date || this._getMondayOfWeek(new Date(), 0),
                          })}
                      >
                        Every 2 Weeks
                      </button>
                    </div>

                    ${rule.recurrence === "biweekly"
                      ? html`
                          <div class="recurrence-row">
                            <button
                              type="button"
                              class="seg-mini-btn ${this._isBiweeklyActiveThisWeek(rule.anchor_date) ? "active" : ""}"
                              @click=${() =>
                                this._updateScheduleRule(idx, {
                                  anchor_date: this._getMondayOfWeek(new Date(), 0),
                                })}
                            >
                              Active This Week
                            </button>
                            <button
                              type="button"
                              class="seg-mini-btn ${!this._isBiweeklyActiveThisWeek(rule.anchor_date) ? "active" : ""}"
                              @click=${() =>
                                this._updateScheduleRule(idx, {
                                  anchor_date: this._getMondayOfWeek(new Date(), 1),
                                })}
                            >
                              Active Next Week
                            </button>
                          </div>
                        `
                      : ""}
                  </div>
                `;
              })}
        </div>

        <!-- Daily Screen Time Limits Card -->
        <div class="passable-section-card">
          <div class="passable-section-header">
            <span class="passable-section-title">Daily Screen Time Limits</span>
          </div>

          <div class="switch-control-row">
            <div>
              <div class="switch-title">Track Screen Time</div>
              <div class="switch-sub">Accumulate daily viewing minutes & active apps</div>
            </div>
            <button
              type="button"
              class="m3-switch ${draft.track_screen_time ? "on" : ""}"
              @click=${() =>
                this._updateSchedDraft({ track_screen_time: !draft.track_screen_time })}
            >
              <span class="m3-knob"></span>
            </button>
          </div>

          ${draft.track_screen_time
            ? html`
                <div class="switch-control-row">
                  <div>
                    <div class="switch-title">Enforce Daily Limit</div>
                    <div class="switch-sub">Auto-lock device once daily budget is reached</div>
                  </div>
                  <button
                    type="button"
                    class="m3-switch ${draft.daily_limit_enabled ? "on" : ""}"
                    @click=${() =>
                      this._updateSchedDraft({
                        daily_limit_enabled: !draft.daily_limit_enabled,
                      })}
                  >
                    <span class="m3-knob"></span>
                  </button>
                </div>

                ${draft.daily_limit_enabled
                  ? html`
                      <div class="recurrence-row">
                        <button
                          type="button"
                          class="seg-mini-btn ${draft.daily_limit_mode !== "weekday_weekend" ? "active" : ""}"
                          @click=${() =>
                            this._updateSchedDraft({ daily_limit_mode: "uniform" })}
                        >
                          Uniform Daily Limit
                        </button>
                        <button
                          type="button"
                          class="seg-mini-btn ${draft.daily_limit_mode === "weekday_weekend" ? "active" : ""}"
                          @click=${() =>
                            this._updateSchedDraft({ daily_limit_mode: "weekday_weekend" })}
                        >
                          Weekday / Weekend Split
                        </button>
                      </div>

                      ${draft.daily_limit_mode === "weekday_weekend"
                        ? html`
                            <div class="two-col-grid">
                              <div class="field-group">
                                <label class="field-label">Mon–Fri Limit (min)</label>
                                <input
                                  type="number"
                                  min="15"
                                  step="15"
                                  class="field-input"
                                  .value=${String(draft.daily_limit_weekday_minutes)}
                                  @input=${(e) =>
                                    this._updateSchedDraft({
                                      daily_limit_weekday_minutes:
                                        parseInt(e.target.value, 10) || 60,
                                    })}
                                />
                              </div>
                              <div class="field-group">
                                <label class="field-label">Sat–Sun Limit (min)</label>
                                <input
                                  type="number"
                                  min="15"
                                  step="15"
                                  class="field-input"
                                  .value=${String(draft.daily_limit_weekend_minutes)}
                                  @input=${(e) =>
                                    this._updateSchedDraft({
                                      daily_limit_weekend_minutes:
                                        parseInt(e.target.value, 10) || 120,
                                    })}
                                />
                              </div>
                            </div>
                          `
                        : html`
                            <div class="preset-chips-row">
                              ${[30, 60, 90, 120, 180, 240].map(
                                (m) => html`
                                  <button
                                    type="button"
                                    class="preset-chip ${draft.daily_limit_minutes === m ? "active" : ""}"
                                    @click=${() =>
                                      this._updateSchedDraft({ daily_limit_minutes: m })}
                                  >
                                    ${this._formatMins(m)}
                                  </button>
                                `
                              )}
                            </div>
                            <div class="field-group">
                              <label class="field-label">Custom Daily Limit (minutes)</label>
                              <input
                                type="number"
                                min="15"
                                step="15"
                                class="field-input"
                                .value=${String(draft.daily_limit_minutes)}
                                @input=${(e) =>
                                  this._updateSchedDraft({
                                    daily_limit_minutes:
                                      parseInt(e.target.value, 10) || 120,
                                  })}
                              />
                            </div>
                          `}
                    `
                  : ""}
              `
            : ""}
        </div>

        <!-- Save & Copy Footer -->
        <div class="sched-footer-actions">
          <button
            type="button"
            class="primary-cta-btn ${this._schedDirty ? "sky" : ""}"
            @click=${() => this._saveScheduleDraft()}
          >
            <ha-icon icon="mdi:content-save-outline" style="--mdc-icon-size:17px;"></ha-icon>
            <span>${this._schedDirty ? "Save Schedule & Limits *" : "Save Schedule & Limits"}</span>
          </button>

          ${otherDevices.length > 0
            ? html`
                <button
                  type="button"
                  class="secondary-cta-btn"
                  @click=${() => (this._copyTrayOpen = !this._copyTrayOpen)}
                >
                  <ha-icon icon="mdi:content-copy" style="--mdc-icon-size:16px;"></ha-icon>
                  <span>Copy to Devices</span>
                </button>
              `
            : ""}
        </div>

        ${this._copyTrayOpen && otherDevices.length > 0
          ? html`
              <div class="passable-section-card">
                <div class="passable-section-header">
                  <span class="passable-section-title">Copy Settings from ${dev.name}</span>
                  <button
                    type="button"
                    class="inline-link-btn"
                    @click=${() =>
                      (this._copyTargets = otherDevices.map(([id]) => id))}
                  >
                    Select All
                  </button>
                </div>

                <div class="copy-checks-row">
                  <label class="inline-check-row">
                    <input
                      type="checkbox"
                      .checked=${this._copySchedulesFlag}
                      @change=${(e) => (this._copySchedulesFlag = e.target.checked)}
                    />
                    <span>Copy Schedules</span>
                  </label>
                  <label class="inline-check-row">
                    <input
                      type="checkbox"
                      .checked=${this._copyLimitsFlag}
                      @change=${(e) => (this._copyLimitsFlag = e.target.checked)}
                    />
                    <span>Copy Daily Limits</span>
                  </label>
                </div>

                <div class="copy-targets-grid">
                  ${otherDevices.map(([id, d]) => {
                    const checked = this._copyTargets.includes(id);
                    return html`
                      <button
                        type="button"
                        class="preset-chip ${checked ? "active" : ""}"
                        @click=${() => {
                          const set = new Set(this._copyTargets);
                          if (set.has(id)) set.delete(id);
                          else set.add(id);
                          this._copyTargets = [...set];
                        }}
                      >
                        ${d.name}
                      </button>
                    `;
                  })}
                </div>

                <button
                  type="button"
                  class="primary-cta-btn sky"
                  ?disabled=${this._copyTargets.length === 0}
                  @click=${() => this._applyCopySettings()}
                >
                  Apply to ${this._copyTargets.length} Selected Device(s)
                </button>
              </div>
            `
          : ""}
      </div>
    `;
  }

  _renderModalActivityTab(devices, restrictions) {
    const hideAdmin = this.config?.hide_admin_setup === true;
    const entries = Object.entries(devices || {});
    const tracked = entries.filter(([, d]) => d.track_screen_time !== false);
    const candidates = this._wsData?.candidates || {
      devices: [],
      restrictions: [],
      screen_time_sensors: [],
    };
    const security = this._wsData?.security || {};

    return html`
      <div class="modal-tab-body">
        ${!hideAdmin
          ? html`
              <div class="segmented-tabs two-up">
                <button
                  type="button"
                  class="seg-tab ${this._activitySubTab === "activity" ? "active sky" : ""}"
                  @click=${() => (this._activitySubTab = "activity")}
                >
                  Activity & Apps
                </button>
                <button
                  type="button"
                  class="seg-tab ${this._activitySubTab === "setup" ? "active sky" : ""}"
                  @click=${() =>
                    this._runProtectedAction("settings", () => {
                      this._activitySubTab = "setup";
                    })}
                >
                  Setup & PIN
                </button>
              </div>
            `
          : ""}

        ${this._activitySubTab === "activity" || hideAdmin
          ? html`
              <div class="passable-section-card">
                <div class="passable-section-header">
                  <span class="passable-section-title">Today's Screen Time Breakdown</span>
                  <button
                    type="button"
                    class="drawer-manage-btn"
                    @click=${() => this._reconcileAllHistory()}
                  >
                    <ha-icon icon="mdi:refresh" style="--mdc-icon-size:13px;"></ha-icon>
                    <span>Reconcile</span>
                  </button>
                </div>

                ${tracked.length === 0
                  ? html`<div class="muted-hint">No devices currently have screen time tracking enabled.</div>`
                  : tracked.map(([, dev]) => {
                      const usage = dev.screen_time_today_minutes || 0;
                      const limit = dev.effective_daily_limit_minutes;
                      const pct =
                        dev.daily_limit_enabled && limit
                          ? Math.min(100, Math.round((usage / Math.max(1, limit)) * 100))
                          : Math.min(100, Math.round((usage / 180) * 100));
                      const apps = dev.apps_used_today || [];
                      return html`
                        <div class="activity-device-block">
                          <div class="usage-progress-labels">
                            <strong>${dev.name}</strong>
                            <span>
                              ${this._formatMins(usage)}
                              ${dev.daily_limit_enabled && limit
                                ? ` / ${this._formatMins(limit)} (${pct}%)`
                                : " (Unlimited)"}
                            </span>
                          </div>
                          <div class="progress-track">
                            <div
                              class="progress-fill ${dev.daily_limit_enabled && pct >= 100 ? "over" : dev.locked ? "warn" : ""}"
                              style="width:${pct}%"
                            ></div>
                          </div>
                          ${apps.length > 0
                            ? html`
                                <div class="app-badges-row">
                                  ${apps.map(
                                    (app) => html`<span class="app-badge">▶ ${app}</span>`
                                  )}
                                </div>
                              `
                            : ""}
                        </div>
                      `;
                    })}
              </div>
            `
          : html`
              <!-- ADD NEW DEVICE -->
              <div class="passable-section-card">
                <div class="passable-section-header">
                  <span class="passable-section-title">Add Screen Time Device</span>
                </div>

                <input
                  type="text"
                  class="field-input"
                  .value=${this._addDevFilter}
                  @input=${(e) => (this._addDevFilter = e.target.value)}
                  placeholder="Filter available TVs, media players, or switches..."
                />

                <select
                  class="field-input"
                  .value=${this._addDevEntity}
                  @change=${(e) => {
                    const eid = e.target.value;
                    this._addDevEntity = eid;
                    const found = (candidates.devices || []).find(
                      (c) => c.entity_id === eid
                    );
                    if (found) {
                      this._addDevName = found.name;
                      const isSw = eid.startsWith("switch.");
                      this._addDevCategory = isSw ? "network" : "tv";
                      this._addDevTrack = !isSw;
                    }
                  }}
                >
                  <option value="">Select an entity (${(candidates.devices || []).length} available)...</option>
                  ${(candidates.devices || [])
                    .filter((c) => {
                      const q = this._addDevFilter.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        c.name.toLowerCase().includes(q) ||
                        c.entity_id.toLowerCase().includes(q)
                      );
                    })
                    .map(
                      (c) => html`
                        <option value="${c.entity_id}">
                          ${c.is_recommended ? "★ " : ""}${c.name} (${c.entity_id})
                        </option>
                      `
                    )}
                </select>

                <div class="two-col-grid">
                  <div class="field-group">
                    <label class="field-label">Display Name</label>
                    <input
                      type="text"
                      class="field-input"
                      .value=${this._addDevName}
                      @input=${(e) => (this._addDevName = e.target.value)}
                      placeholder="e.g. Living Room TV"
                    />
                  </div>
                  <div class="field-group">
                    <label class="field-label">Category & Icon</label>
                    <select
                      class="field-input"
                      .value=${this._addDevCategory}
                      @change=${(e) => (this._addDevCategory = e.target.value)}
                    >
                      ${DEVICE_CATEGORY_OPTIONS.map(
                        (cat) => html`<option value="${cat.id}">${cat.label}</option>`
                      )}
                    </select>
                  </div>
                </div>

                <label class="inline-check-row">
                  <input
                    type="checkbox"
                    .checked=${this._addDevTrack}
                    @change=${(e) => (this._addDevTrack = e.target.checked)}
                  />
                  <span>Track daily screen time & enforce limits</span>
                </label>

                <div class="field-group">
                  <label class="field-label">Optional Companion Screen Time Sensor</label>
                  <select
                    class="field-input"
                    .value=${this._addDevSensor}
                    @change=${(e) => (this._addDevSensor = e.target.value)}
                  >
                    <option value="">None (use target entity state)</option>
                    ${(candidates.screen_time_sensors || []).map(
                      (s) => html`<option value="${s.entity_id}">${s.name} (${s.entity_id})</option>`
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  class="primary-cta-btn sky"
                  @click=${() => this._addNewDevice()}
                >
                  <ha-icon icon="mdi:plus" style="--mdc-icon-size:17px;"></ha-icon>
                  <span>Add Device</span>
                </button>
              </div>

              <!-- MANAGE EXISTING DEVICES -->
              <div class="passable-section-card">
                <div class="passable-section-header">
                  <span class="passable-section-title">Manage Devices (${entries.length})</span>
                  <button
                    type="button"
                    class="drawer-manage-btn"
                    @click=${() => this._importLegacyHelpers()}
                  >
                    Import Legacy
                  </button>
                </div>

                ${entries.map(([did, dev]) => {
                  const isOpen = this._manageExpandedId === did;
                  return html`
                    <div class="manage-device-item">
                      <div
                        class="manage-device-header"
                        @click=${() =>
                          (this._manageExpandedId = isOpen ? null : did)}
                      >
                        <div class="drawer-dev-left">
                          <ha-icon icon="${this._getDeviceIcon(dev)}" style="--mdc-icon-size:17px;"></ha-icon>
                          <div>
                            <div class="drawer-dev-name">${dev.name}</div>
                            <div class="drawer-dev-sub">${dev.target_entity}</div>
                          </div>
                        </div>
                        <ha-icon
                          icon="${isOpen ? "mdi:chevron-up" : "mdi:chevron-down"}"
                          style="--mdc-icon-size:18px;"
                        ></ha-icon>
                      </div>

                      ${isOpen
                        ? html`
                            <div class="manage-device-body">
                              <div class="two-col-grid">
                                <div class="field-group">
                                  <label class="field-label">Name</label>
                                  <input
                                    type="text"
                                    class="field-input"
                                    .value=${dev.name}
                                    @change=${(e) =>
                                      this._updateManagedDeviceMeta(did, {
                                        name: e.target.value,
                                      })}
                                  />
                                </div>
                                <div class="field-group">
                                  <label class="field-label">Category</label>
                                  <select
                                    class="field-input"
                                    .value=${dev.device_category || "tv"}
                                    @change=${(e) => {
                                      const cat = DEVICE_CATEGORY_OPTIONS.find(
                                        (c) => c.id === e.target.value
                                      );
                                      this._updateManagedDeviceMeta(did, {
                                        device_category: e.target.value,
                                        icon: cat?.icon || dev.icon,
                                      });
                                    }}
                                  >
                                    ${DEVICE_CATEGORY_OPTIONS.map(
                                      (cat) => html`<option value="${cat.id}">${cat.label}</option>`
                                    )}
                                  </select>
                                </div>
                              </div>

                              <div class="field-group">
                                <label class="field-label">Companion Screen Time Sensor</label>
                                <select
                                  class="field-input"
                                  .value=${dev.screen_time_entity || ""}
                                  @change=${(e) =>
                                    this._updateManagedDeviceMeta(did, {
                                      screen_time_entity: e.target.value || null,
                                    })}
                                >
                                  <option value="">None (use target entity)</option>
                                  ${(candidates.screen_time_sensors || []).map(
                                    (s) => html`<option value="${s.entity_id}">${s.name} (${s.entity_id})</option>`
                                  )}
                                </select>
                              </div>

                              <button
                                type="button"
                                class="danger-outline-btn"
                                @click=${() => this._deleteDevice(did)}
                              >
                                <ha-icon icon="mdi:trash-can-outline" style="--mdc-icon-size:15px;"></ha-icon>
                                <span>Remove Device</span>
                              </button>
                            </div>
                          `
                        : ""}
                    </div>
                  `;
                })}
              </div>

              <!-- GLOBAL RESTRICTIONS -->
              <div class="passable-section-card">
                <div class="passable-section-header">
                  <span class="passable-section-title">Global Household Restrictions</span>
                </div>
                ${restrictions.map(
                  (r, idx) => html`
                    <div class="restriction-manage-row">
                      <div>
                        <strong>${r.name}</strong>
                        <div class="drawer-dev-sub">${r.entity}</div>
                      </div>
                      <button
                        type="button"
                        class="icon-mini-btn danger"
                        @click=${() => {
                          const next = restrictions.filter((_, i) => i !== idx);
                          this._saveGlobalRestrictionsList(next);
                        }}
                      >
                        <ha-icon icon="mdi:close" style="--mdc-icon-size:14px;"></ha-icon>
                      </button>
                    </div>
                  `
                )}
                <div class="two-col-grid">
                  <select
                    class="field-input"
                    .value=${this._restrNewEntity}
                    @change=${(e) => {
                      this._restrNewEntity = e.target.value;
                      const found = (candidates.restrictions || []).find(
                        (c) => c.entity_id === e.target.value
                      );
                      if (found && !this._restrNewName) {
                        this._restrNewName = found.name;
                      }
                    }}
                  >
                    <option value="">Add restriction entity...</option>
                    ${(candidates.restrictions || []).map(
                      (c) => html`<option value="${c.entity_id}">${c.name} (${c.entity_id})</option>`
                    )}
                  </select>
                  <input
                    type="text"
                    class="field-input"
                    .value=${this._restrNewName}
                    @input=${(e) => (this._restrNewName = e.target.value)}
                    placeholder="Display label"
                  />
                </div>
                <button
                  type="button"
                  class="secondary-cta-btn"
                  ?disabled=${!this._restrNewEntity}
                  @click=${() => {
                    const next = [
                      ...restrictions,
                      {
                        entity: this._restrNewEntity,
                        name: this._restrNewName.trim() || null,
                      },
                    ];
                    this._restrNewEntity = "";
                    this._restrNewName = "";
                    this._saveGlobalRestrictionsList(next);
                  }}
                >
                  + Add Restriction Trigger
                </button>
              </div>

              <!-- PARENTAL PIN SETTINGS -->
              <div class="passable-section-card">
                <div class="passable-section-header">
                  <span class="passable-section-title">Wall-Panel Parental PIN</span>
                  <span class="zone-inline-chip ${security.pin_enabled ? "success" : "neutral"}">
                    ${security.pin_enabled ? "PIN Active" : "Disabled"}
                  </span>
                </div>

                <div class="switch-control-row">
                  <div>
                    <div class="switch-title">Enable Parental PIN Lock</div>
                    <div class="switch-sub">Protect wall-panel unlocks, timers & settings</div>
                  </div>
                  <button
                    type="button"
                    class="m3-switch ${this._secPinEnabled ? "on" : ""}"
                    @click=${() => (this._secPinEnabled = !this._secPinEnabled)}
                  >
                    <span class="m3-knob"></span>
                  </button>
                </div>

                ${security.pin_enabled
                  ? html`
                      <div class="field-group">
                        <label class="field-label">Current PIN (required to modify PIN settings)</label>
                        <input
                          type="password"
                          inputmode="numeric"
                          maxlength="6"
                          class="field-input"
                          .value=${this._secCurrentPin}
                          @input=${(e) => (this._secCurrentPin = e.target.value)}
                          placeholder="Enter current PIN"
                        />
                      </div>
                    `
                  : ""}

                <div class="field-group">
                  <label class="field-label">
                    ${security.has_pin ? "New PIN (leave blank to keep current)" : "Set 4–6 Digit PIN"}
                  </label>
                  <input
                    type="password"
                    inputmode="numeric"
                    maxlength="6"
                    class="field-input"
                    .value=${this._secNewPin}
                    @input=${(e) => (this._secNewPin = e.target.value)}
                    placeholder="4–6 digits"
                  />
                </div>

                <label class="inline-check-row">
                  <input
                    type="checkbox"
                    .checked=${this._secReqUnlock}
                    @change=${(e) => (this._secReqUnlock = e.target.checked)}
                  />
                  <span>Require PIN to unlock devices</span>
                </label>
                <label class="inline-check-row">
                  <input
                    type="checkbox"
                    .checked=${this._secReqTimers}
                    @change=${(e) => (this._secReqTimers = e.target.checked)}
                  />
                  <span>Require PIN for viewing timers & bonus time</span>
                </label>
                <label class="inline-check-row">
                  <input
                    type="checkbox"
                    .checked=${this._secReqSettings}
                    @change=${(e) => (this._secReqSettings = e.target.checked)}
                  />
                  <span>Require PIN for schedules & setup</span>
                </label>

                <button
                  type="button"
                  class="primary-cta-btn sky"
                  @click=${() => this._saveSecuritySettings()}
                >
                  Save Parental PIN Settings
                </button>
              </div>
            `}
      </div>
    `;
  }

  _renderTabContent(devices, restrictions, metrics) {
    if (this._modalTab === "timers") {
      return this._renderModalTimersTab(devices);
    }
    if (this._modalTab === "schedules") {
      return this._renderModalSchedulesTab(devices);
    }
    if (this._modalTab === "activity") {
      return this._renderModalActivityTab(devices, restrictions);
    }
    return this._renderModalControlsTab(devices, restrictions, metrics);
  }

  _renderModal(devices, restrictions, metrics) {
    if (!this._modalOpen || this.config?.display_mode === "full") return "";
    const anyLocked = metrics.lockedCount > 0 || metrics.activeRestrictions.length > 0;

    return html`
      <div
        class="popup-overlay"
        @click=${(ev) => {
          if (ev.target === ev.currentTarget) this._closeModal();
        }}
      >
        <div
          class="popup-content"
          @click=${(ev) => ev.stopPropagation()}
          @touchstart=${this._handlePopupTouchStart}
          @touchmove=${this._handlePopupTouchMove}
          @touchend=${this._handlePopupTouchEnd}
          @touchcancel=${this._handlePopupTouchCancel}
        >
          <div class="drag-handle"></div>

          <div class="popup-header">
            <div class="popup-header-left">
              <div class="device-icon-wrap ${anyLocked ? "locked" : "watching"}">
                <ha-icon icon="mdi:television-shimmer" style="--mdc-icon-size:20px;"></ha-icon>
              </div>
              <div>
                <h3>Screen Time Command Center</h3>
                <div class="popup-header-sub">
                  ${metrics.permittedCount}/${metrics.totalDevices} Permitted •
                  ${this._formatMins(metrics.totalMinutes)} today
                </div>
              </div>
            </div>

            <div class="popup-header-actions">
              ${metrics.totalDevices > 0
                ? html`
                    <button
                      type="button"
                      class="master-pill-btn ${anyLocked ? "locked" : ""}"
                      @click=${(ev) => this._setLockout("all", !anyLocked, {}, ev)}
                    >
                      ${anyLocked ? "Unlock All" : "Lock All"}
                    </button>
                  `
                : ""}
              <button
                type="button"
                class="close-button"
                @click=${() => this._closeModal()}
                aria-label="Close"
              >
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
            </div>
          </div>

          <div class="popup-tabs">
            ${MODAL_TABS.map(
              (t) => html`
                <button
                  type="button"
                  class="popup-tab ${this._modalTab === t.id ? "active-tab" : ""}"
                  @click=${() => {
                    this._fireHaptic("light");
                    this._modalTab = t.id;
                  }}
                >
                  <ha-icon icon="${t.icon}"></ha-icon>
                  <span>${t.label}</span>
                </button>
              `
            )}
          </div>

          <div class="modal-scroll-area thin-scroll">
            ${this._renderTabContent(devices, restrictions, metrics)}
          </div>
        </div>
      </div>
    `;
  }

  _renderPinModal() {
    if (!this._pinModalOpen) return "";
    const dots = [0, 1, 2, 3, 4, 5];

    return html`
      <div
        class="popup-overlay pin-overlay"
        @click=${(ev) => {
          if (ev.target === ev.currentTarget) this._closePinModal();
        }}
      >
        <div class="popup-content pin-dialog" @click=${(ev) => ev.stopPropagation()}>
          <div class="popup-header">
            <div class="popup-header-left">
              <div class="device-icon-wrap locked">
                <ha-icon icon="mdi:shield-key-outline" style="--mdc-icon-size:20px;"></ha-icon>
              </div>
              <div>
                <h3>Parent PIN Required</h3>
                <div class="popup-header-sub">Enter PIN to authorize action</div>
              </div>
            </div>
            <button
              type="button"
              class="close-button"
              @click=${() => this._closePinModal()}
            >
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>

          <div class="pin-dots-row">
            ${dots.map(
              (i) => html`
                <span class="pin-dot ${i < this._pinInput.length ? "filled" : ""}"></span>
              `
            )}
          </div>

          ${this._pinError
            ? html`<div class="pin-error-text">${this._pinError}</div>`
            : ""}

          <div class="pin-keypad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(
              (n) => html`
                <button
                  type="button"
                  class="pin-key"
                  @click=${() => this._pressPinDigit(String(n))}
                >
                  ${n}
                </button>
              `
            )}
            <button type="button" class="pin-key fn" @click=${() => this._backspacePin()}>
              ⌫
            </button>
            <button type="button" class="pin-key" @click=${() => this._pressPinDigit("0")}>
              0
            </button>
            <button type="button" class="pin-key submit" @click=${() => this._submitPin()}>
              OK
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  render() {
    if (!this.hass || !this.config) return html``;

    const c = this.config;
    const devices = this._wsData?.devices || {};
    const restrictions = this._wsData?.global_restrictions || [];
    const metrics = this._getSummaryMetrics(devices, restrictions);
    const isFullMode = c.display_mode === "full";
    const layout = c.layout || "tiles";

    return html`
      <ha-card>
        ${c.show_header !== false
          ? html`
              <div class="header">
                <div class="header-top-row">
                  <h1 class="title">
                    <ha-icon
                      icon="mdi:television-shimmer"
                      style="margin-right:8px; color: var(--primary-color);"
                    ></ha-icon>
                    ${c.title || "Screen Time"}
                  </h1>
                </div>
                <div class="header-subtitle-row">
                  <p class="subtitle">
                    ${c.subtitle ||
                    `${metrics.permittedCount}/${metrics.totalDevices} permitted • ${this._formatMins(metrics.totalMinutes)} today`}
                  </p>
                </div>
              </div>
            `
          : ""}

        ${isFullMode
          ? html`
              <div class="card-content ${c.show_header === false ? "no-header" : ""}">
                <div class="popup-tabs">
                  ${MODAL_TABS.map(
                    (t) => html`
                      <button
                        type="button"
                        class="popup-tab ${this._modalTab === t.id ? "active-tab" : ""}"
                        @click=${() => {
                          this._fireHaptic("light");
                          this._modalTab = t.id;
                        }}
                      >
                        <ha-icon icon="${t.icon}"></ha-icon>
                        <span>${t.label}</span>
                      </button>
                    `
                  )}
                </div>
                ${this._renderTabContent(devices, restrictions, metrics)}
              </div>
            `
          : html`
              <div class="card-content ${c.show_header === false ? "no-header" : ""}">
                ${layout === "strip"
                  ? html`
                      ${this._renderMinimalStripCard(devices, metrics)}
                      ${this._renderInlineDrawer(devices)}
                      ${c.show_footer_strip === true
                        ? this._renderFooterStrip(restrictions, metrics)
                        : ""}
                    `
                  : html`
                      ${c.show_summary_strip !== false
                        ? this._renderSummaryStrip(devices, metrics)
                        : ""}

                      ${layout === "compact"
                        ? this._renderConsolidatedHero(devices, restrictions, metrics)
                        : metrics.totalDevices > 0
                          ? layout === "active"
                            ? this._renderActiveOnlyDevices(devices, metrics)
                            : layout === "rings"
                              ? this._renderDeviceRings(devices)
                              : layout === "rows"
                                ? this._renderDeviceRows(devices)
                                : this._renderDeviceTiles(devices)
                          : html`
                              <div class="drawer-empty">
                                No screen time devices configured.
                                ${!c.hide_admin_setup
                                  ? html`<button
                                      type="button"
                                      class="inline-link-btn"
                                      @click=${() => {
                                        this._activitySubTab = "setup";
                                        this._openModal("activity");
                                      }}
                                    >Add Device →</button>`
                                  : ""}
                              </div>
                            `}

                      ${this._renderInlineDrawer(devices)}
                      ${c.show_footer_strip !== false
                        ? this._renderFooterStrip(restrictions, metrics)
                        : ""}
                    `}
              </div>
            `}

        ${this._toastMsg ? html`<div class="card-toast">${this._toastMsg}</div>` : ""}
        ${this._renderModal(devices, restrictions, metrics)}
        ${this._renderPinModal()}
      </ha-card>
    `;
  }

  // =========================================================================
  // PASSABLE DESIGN SYSTEM STYLES
  // =========================================================================

  static get styles() {
    return css`
      :host {
        display: block;
      }

      ha-card {
        border-radius: var(--ha-card-border-radius, 12px);
        background: var(--ha-card-background, var(--card-background-color, #fff));
        box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
        overflow: hidden;
        color: var(--primary-text-color);
        position: relative;
      }

      .header {
        padding: 16px 16px 14px;
        display: flex;
        flex-direction: column;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
        margin-bottom: 12px;
        gap: 4px;
      }
      .header-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .title {
        font-size: 24px;
        font-weight: 500;
        margin: 0;
        letter-spacing: -0.01em;
        display: flex;
        align-items: center;
      }
      .subtitle {
        color: var(--secondary-text-color, #757575);
        font-size: 14px;
        margin: 2px 0 0 0;
      }

      .card-content {
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        container-type: inline-size;
      }
      .card-content.no-header {
        padding: 10px;
      }
      .header + .card-content {
        padding-top: 0;
      }

      /* SUMMARY STRIP */
      .screen-time-summary-strip {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 6px 10px;
        padding: 7px 12px;
        border-radius: max(12px, calc(var(--ha-card-border-radius, 20px) - 8px));
        min-height: 36px;
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.1));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
        box-sizing: border-box;
      }
      .screen-time-summary-strip.locked {
        background: rgba(245, 158, 11, 0.08);
        border-color: rgba(245, 158, 11, 0.3);
      }
      .screen-time-summary-strip.danger {
        background: rgba(239, 68, 68, 0.08);
        border-color: rgba(239, 68, 68, 0.32);
      }
      .screen-time-summary-strip.watching {
        background: rgba(34, 197, 94, 0.08);
        border-color: rgba(34, 197, 94, 0.28);
      }
      .screen-time-summary-strip.timer {
        background: rgba(14, 165, 233, 0.08);
        border-color: rgba(14, 165, 233, 0.28);
      }
      .summary-strip-left,
      .summary-strip-right {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }
      .summary-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        background: var(--disabled-text-color, #94a3b8);
      }
      .summary-status-dot.locked {
        background: #f59e0b;
        box-shadow: 0 0 6px rgba(245, 158, 11, 0.65);
      }
      .summary-status-dot.danger {
        background: #ef4444;
        box-shadow: 0 0 6px rgba(239, 68, 68, 0.65);
      }
      .summary-status-dot.watching {
        background: #22c55e;
        box-shadow: 0 0 6px rgba(34, 197, 94, 0.65);
      }
      .summary-status-dot.timer {
        background: #0ea5e9;
        box-shadow: 0 0 6px rgba(14, 165, 233, 0.65);
      }
      .summary-sep {
        opacity: 0.4;
        font-size: 12px;
      }
      .strip-active-pill {
        padding: 2px 9px;
        border-radius: 999px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: var(--card-background-color, rgba(128, 128, 128, 0.1));
        color: var(--primary-text-color);
        cursor: pointer;
        transition: all 0.18s ease;
      }
      .strip-active-pill.locked {
        background: rgba(245, 158, 11, 0.15);
        border-color: rgba(245, 158, 11, 0.4);
        color: #d97706;
      }
      .strip-active-pill.danger {
        background: rgba(239, 68, 68, 0.15);
        border-color: rgba(239, 68, 68, 0.4);
        color: #dc2626;
      }
      .strip-active-pill.drawer-open {
        box-shadow: 0 0 0 1px var(--primary-color, #0284c7);
      }
      .strip-metric-text {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--secondary-text-color);
      }
      .strip-metric-text.success {
        color: #16a34a;
      }
      .master-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 9px;
        border-radius: 999px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.26));
        background: var(--card-background-color, rgba(128, 128, 128, 0.1));
        color: var(--primary-text-color);
      }
      .master-pill-btn.locked {
        background: rgba(245, 158, 11, 0.16);
        border-color: rgba(245, 158, 11, 0.4);
        color: #d97706;
      }
      .icon-circle-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--card-background-color, rgba(128, 128, 128, 0.1));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.2));
        color: var(--primary-text-color);
        cursor: pointer;
        padding: 0;
      }
      .icon-circle-btn.pin-unlocked {
        color: #16a34a;
        border-color: rgba(34, 197, 94, 0.4);
        background: rgba(34, 197, 94, 0.12);
      }

      /* INLINE CHIPS */
      .zone-inline-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        font-family: inherit;
        font-size: 11.5px;
        font-weight: 700;
        line-height: 1.25;
        white-space: nowrap;
        border: 1px solid transparent;
      }
      .zone-inline-chip.info {
        background: rgba(14, 165, 233, 0.16);
        color: #0284c7;
        border-color: rgba(14, 165, 233, 0.3);
      }
      .zone-inline-chip.warning {
        background: rgba(245, 158, 11, 0.16);
        color: #d97706;
        border-color: rgba(245, 158, 11, 0.35);
      }
      .zone-inline-chip.danger {
        background: rgba(239, 68, 68, 0.16);
        color: #dc2626;
        border-color: rgba(239, 68, 68, 0.35);
      }
      .zone-inline-chip.success {
        background: rgba(34, 197, 94, 0.16);
        color: #16a34a;
        border-color: rgba(34, 197, 94, 0.35);
      }
      .zone-inline-chip.neutral {
        background: rgba(128, 128, 128, 0.14);
        color: var(--secondary-text-color);
        border-color: rgba(128, 128, 128, 0.24);
      }
      .zone-inline-chip.clickable {
        cursor: pointer;
      }

      /* COMPACT DEVICE TILES / ROWS / RINGS */
      .device-tiles-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
      }
      @container (max-width: 340px) {
        .device-tiles-grid {
          grid-template-columns: 1fr;
        }
      }
      .screen-zone-card {
        position: relative;
        overflow: hidden;
        border-radius: max(12px, calc(var(--ha-card-border-radius, 20px) - 8px));
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.1));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.14));
        cursor: pointer;
        transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .screen-zone-card.locked {
        background: rgba(245, 158, 11, 0.08);
        border-color: rgba(245, 158, 11, 0.34);
      }
      .screen-zone-card.danger {
        background: rgba(239, 68, 68, 0.09);
        border-color: rgba(239, 68, 68, 0.36);
      }
      .screen-zone-card.watching {
        background: rgba(34, 197, 94, 0.09);
        border-color: rgba(34, 197, 94, 0.36);
      }
      .screen-zone-card.timer {
        background: rgba(14, 165, 233, 0.09);
        border-color: rgba(14, 165, 233, 0.36);
      }
      .screen-zone-card.winddown {
        background: rgba(139, 92, 246, 0.09);
        border-color: rgba(139, 92, 246, 0.36);
      }
      .screen-zone-card.selected {
        border-color: var(--primary-color, #0284c7);
        box-shadow: 0 0 0 1px var(--primary-color, #0284c7);
      }
      .screen-zone-card.tile {
        padding: 8px 10px 10px;
      }
      .screen-zone-card.tile.span-2 {
        grid-column: span 2;
      }
      @container (max-width: 340px) {
        .screen-zone-card.tile.span-2 {
          grid-column: span 1;
        }
      }
      .tile-main {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .tile-identity {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .device-icon-wrap {
        width: 38px;
        height: 38px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: rgba(128, 128, 128, 0.14);
        color: var(--secondary-text-color);
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
      }
      .device-icon-wrap.compact {
        width: 32px;
        height: 32px;
        border-radius: 10px;
      }
      .device-icon-wrap.locked {
        background: rgba(245, 158, 11, 0.2);
        color: #d97706;
        border-color: rgba(245, 158, 11, 0.45);
      }
      .device-icon-wrap.danger {
        background: rgba(239, 68, 68, 0.2);
        color: #dc2626;
        border-color: rgba(239, 68, 68, 0.45);
      }
      .device-icon-wrap.watching {
        background: rgba(34, 197, 94, 0.2);
        color: #16a34a;
        border-color: rgba(34, 197, 94, 0.45);
      }
      .device-icon-wrap.timer {
        background: rgba(14, 165, 233, 0.2);
        color: #0284c7;
        border-color: rgba(14, 165, 233, 0.45);
      }
      .device-icon-wrap.winddown {
        background: rgba(139, 92, 246, 0.2);
        color: #7c3aed;
        border-color: rgba(139, 92, 246, 0.45);
      }
      .tile-text {
        min-width: 0;
        flex: 1;
      }
      .tile-name-row {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .tile-name {
        font-size: 13px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .status-dot.danger {
        background: #ef4444;
      }
      .status-dot.override {
        background: #0ea5e9;
      }
      .tile-sub {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 11.5px;
        color: var(--secondary-text-color);
        min-width: 0;
      }
      .tile-sub.locked {
        color: #d97706;
        font-weight: 600;
      }
      .tile-sub.watching {
        color: #16a34a;
        font-weight: 600;
      }
      .tile-sub.timer {
        color: #0284c7;
        font-weight: 600;
      }
      .tile-sub.winddown {
        color: #7c3aed;
        font-weight: 600;
      }
      .tile-sub.danger {
        color: #dc2626;
        font-weight: 600;
      }
      .sub-truncate {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tile-controls {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .tile-stat {
        font-size: 12px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--secondary-text-color);
      }
      .tile-stat.timer {
        color: #0284c7;
      }
      .tile-stat.watching {
        color: #16a34a;
      }
      .device-lock-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.25));
        background: var(--card-background-color, rgba(128, 128, 128, 0.12));
        color: var(--secondary-text-color);
        cursor: pointer;
        padding: 0;
      }
      .device-lock-btn.locked {
        background: #f59e0b;
        border-color: #f59e0b;
        color: #ffffff;
      }
      .device-lock-btn.unlocked {
        color: #16a34a;
        border-color: rgba(34, 197, 94, 0.4);
      }
      .tile-hairline {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 2.5px;
        background: rgba(148, 163, 184, 0.15);
      }
      .tile-hairline-fill {
        height: 100%;
        transition: width 0.25s ease;
      }

      /* CONSOLIDATED HERO SUMMARY LAYOUT */
      .screen-zone-card.hero-summary {
        padding: 10px 12px 12px;
      }
      .hero-zone-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        min-width: 0;
      }
      .hero-zone-identity {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1;
        overflow: hidden;
      }
      .hero-zone-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
        flex: 1;
        overflow: hidden;
      }
      .hero-zone-title-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        min-width: 0;
      }
      .hero-zone-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--primary-text-color);
        margin: 0;
        line-height: 1.2;
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hero-zone-subtitle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--secondary-text-color);
        min-width: 0;
        line-height: 1.25;
      }
      .hero-inline-expand-btn {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--card-background-color, rgba(128, 128, 128, 0.12));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .hero-inline-expand-btn.open,
      .hero-inline-expand-btn:hover {
        border-color: var(--primary-color, #0284c7);
        background: rgba(14, 165, 233, 0.12);
      }
      .hero-zone-primary {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-shrink: 0;
      }
      .hero-primary-stack {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        margin-right: 2px;
        font-variant-numeric: tabular-nums;
      }
      .hero-primary-val {
        font-size: 18px;
        font-weight: 800;
        line-height: 1.05;
        color: var(--primary-text-color);
      }
      .hero-primary-val.locked { color: #d97706; }
      .hero-primary-val.danger { color: #dc2626; }
      .hero-primary-val.timer { color: #0284c7; }
      .hero-primary-val.watching { color: #16a34a; }
      .hero-primary-sub {
        font-size: 11px;
        font-weight: 700;
        color: var(--secondary-text-color);
      }
      .strip-brand-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--primary-text-color);
        white-space: nowrap;
      }
      .active-idle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-radius: 10px;
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.08));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.14));
        font-size: 12.5px;
        font-weight: 600;
        color: var(--secondary-text-color);
        cursor: pointer;
      }
      .drawer-dev-left.clickable {
        cursor: pointer;
        flex: 1;
      }

      /* ROWS LAYOUT */
      .device-rows-stack {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .screen-zone-card.row {
        padding: 8px 10px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .row-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1;
      }
      .row-text {
        min-width: 0;
        flex: 1;
      }
      .row-title-line {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
      }
      .row-title {
        font-size: 13.5px;
        font-weight: 700;
      }
      .row-sub {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .row-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .row-stat {
        font-size: 13px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }

      /* RINGS LAYOUT */
      .device-rings-grid {
        display: grid;
        gap: 4px;
      }
      .ring-tile-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 6px 2px;
        border-radius: 11px;
        background: transparent;
        border: 1px solid transparent;
        font-family: inherit;
        cursor: pointer;
      }
      .ring-tile-btn.selected {
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.12));
        border-color: var(--primary-color, #0284c7);
      }
      .ring-wrap {
        position: relative;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ring-svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }
      .ring-val {
        position: absolute;
        font-size: 10.5px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--primary-text-color);
      }
      .ring-name {
        font-size: 12px;
        font-weight: 700;
        color: var(--primary-text-color);
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ring-sub {
        font-size: 11px;
        color: var(--secondary-text-color);
      }

      /* INLINE DRAWER */
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-3px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .screen-time-drawer {
        border-top: 1px dashed var(--divider-color, rgba(128, 128, 128, 0.25));
        padding-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        animation: slideDown 0.18s ease-out forwards;
      }
      .drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
      }
      .drawer-title-group {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .drawer-title {
        font-size: 13px;
        font-weight: 700;
      }
      .drawer-sub {
        font-size: 11.5px;
        color: var(--secondary-text-color);
      }
      .drawer-actions {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .drawer-filter-btn {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 7px;
        border-radius: 6px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.24));
        background: transparent;
        color: var(--secondary-text-color);
        font-family: inherit;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .drawer-filter-btn.active {
        border-color: rgba(34, 197, 94, 0.45);
        background: rgba(34, 197, 94, 0.14);
        color: #16a34a;
      }
      .drawer-manage-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 9px;
        border-radius: 999px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.1));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .drawer-close-btn {
        background: none;
        border: none;
        padding: 2px;
        color: var(--secondary-text-color);
        cursor: pointer;
        display: inline-flex;
      }
      .drawer-list {
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .drawer-device-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 10px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
        background: var(--card-background-color, rgba(128, 128, 128, 0.06));
      }
      .drawer-dev-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .drawer-dev-name {
        font-size: 12.5px;
        font-weight: 700;
      }
      .drawer-dev-sub {
        font-size: 11px;
        color: var(--secondary-text-color);
      }
      .drawer-dev-actions {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
      }
      .drawer-empty {
        padding: 12px 8px;
        text-align: center;
        font-size: 12.5px;
        color: var(--secondary-text-color);
      }
      .drawer-timer-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        padding: 7px 10px;
        border-radius: 10px;
        font-size: 12px;
      }
      .drawer-timer-banner.sky {
        background: rgba(14, 165, 233, 0.12);
        border: 1px solid rgba(14, 165, 233, 0.3);
      }
      .drawer-timer-banner.amber {
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.3);
      }
      .drawer-timer-banner.violet {
        background: rgba(139, 92, 246, 0.12);
        border: 1px solid rgba(139, 92, 246, 0.3);
      }
      .drawer-timer-info,
      .drawer-timer-btns {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .drawer-quick-grid {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .quick-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .quick-group-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--secondary-text-color);
      }
      .quick-chips-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .quick-chip {
        padding: 4px 10px;
        border-radius: 999px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.24));
        background: var(--card-background-color, rgba(128, 128, 128, 0.08));
        color: var(--primary-text-color);
      }
      .quick-chip.sky {
        background: rgba(14, 165, 233, 0.14);
        border-color: rgba(14, 165, 233, 0.38);
        color: #0284c7;
      }
      .quick-chip.amber {
        background: rgba(245, 158, 11, 0.14);
        border-color: rgba(245, 158, 11, 0.38);
        color: #d97706;
      }
      .quick-chip.violet {
        background: rgba(139, 92, 246, 0.14);
        border-color: rgba(139, 92, 246, 0.38);
        color: #7c3aed;
      }
      .quick-chip.green {
        background: rgba(34, 197, 94, 0.14);
        border-color: rgba(34, 197, 94, 0.38);
        color: #16a34a;
      }
      .quick-chip.danger {
        background: rgba(239, 68, 68, 0.14);
        border-color: rgba(239, 68, 68, 0.38);
        color: #dc2626;
      }
      .icon-mini-btn {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: var(--card-background-color, rgba(128, 128, 128, 0.08));
        color: var(--secondary-text-color);
        cursor: pointer;
        padding: 0;
      }
      .icon-mini-btn.active {
        color: #0284c7;
        border-color: rgba(14, 165, 233, 0.45);
        background: rgba(14, 165, 233, 0.14);
      }
      .icon-mini-btn.danger {
        color: #dc2626;
      }

      /* FOOTER STRIP */
      .engine-footer-strip {
        padding-top: 6px;
        border-top: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .footer-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .footer-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 9px;
        border-radius: 999px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.1));
        color: var(--secondary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .footer-chip.sky {
        background: rgba(14, 165, 233, 0.15);
        border-color: rgba(14, 165, 233, 0.35);
        color: #0284c7;
      }
      .footer-chip.amber {
        background: rgba(245, 158, 11, 0.15);
        border-color: rgba(245, 158, 11, 0.38);
        color: #d97706;
      }
      .footer-chip.danger {
        background: rgba(239, 68, 68, 0.15);
        border-color: rgba(239, 68, 68, 0.38);
        color: #dc2626;
      }
      .footer-command-link,
      .inline-link-btn {
        background: none;
        border: none;
        padding: 0;
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        color: var(--primary-color, #0284c7);
        cursor: pointer;
      }

      /* TOAST */
      .card-toast {
        position: fixed;
        bottom: 18px;
        right: 18px;
        z-index: 10002;
        padding: 7px 14px;
        border-radius: 10px;
        background: var(--ha-card-background, #1c1c1e);
        border: 1px solid var(--primary-color, #0284c7);
        color: var(--primary-text-color);
        font-size: 12.5px;
        font-weight: 600;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        pointer-events: none;
      }

      /* COMMAND CENTER MODAL */
      @keyframes ha-popup-backdrop-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes ha-popup-backdrop-fade-out {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes ha-popup-dialog-in {
        from { opacity: 0; transform: translateY(20px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes ha-popup-dialog-out {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to { opacity: 0; transform: translateY(12px) scale(0.97); }
      }
      .popup-overlay {
        position: fixed;
        inset: 0;
        background-color: var(--mdc-dialog-scrim-color, rgba(0, 0, 0, 0.42));
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 16px;
        box-sizing: border-box;
        overscroll-behavior: contain;
        z-index: 9999;
        animation: ha-popup-backdrop-fade-in 220ms cubic-bezier(0.2, 0, 0, 1) forwards;
      }
      .popup-overlay.pin-overlay {
        z-index: 10001;
      }
      .popup-overlay.closing {
        animation: ha-popup-backdrop-fade-out 170ms cubic-bezier(0.2, 0, 0, 1) forwards;
      }
      .popup-content {
        background-color: var(--ha-card-background, var(--card-background-color, #fff));
        padding: 16px 18px 20px;
        border-radius: var(--ha-dialog-border-radius, var(--ha-card-border-radius, 24px));
        width: 100%;
        max-width: 540px;
        max-height: 90vh;
        overflow: hidden;
        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
        box-sizing: border-box;
        animation: ha-popup-dialog-in 220ms cubic-bezier(0.2, 0, 0, 1) forwards;
      }
      .popup-content.pin-dialog {
        max-width: 360px;
      }
      .popup-content.closing {
        animation: ha-popup-dialog-out 170ms cubic-bezier(0.2, 0, 0, 1) forwards;
      }
      .drag-handle {
        display: none;
      }
      @media (max-width: 560px) {
        .popup-overlay {
          align-items: flex-end;
          padding: 0;
        }
        .popup-content {
          max-width: 100%;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }
        .drag-handle {
          display: block;
          width: 36px;
          height: 4px;
          border-radius: 999px;
          background: var(--divider-color, rgba(128, 128, 128, 0.4));
          margin: 0 auto 4px;
        }
      }
      .popup-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
      }
      .popup-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .popup-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
      }
      .popup-header-sub {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .popup-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .close-button {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: var(--primary-text-color);
        display: flex;
        border-radius: 50%;
      }
      .popup-tabs {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.12));
        padding: 4px;
        border-radius: 14px;
        gap: 4px;
      }
      .popup-tab {
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 7px 4px;
        border-radius: 10px;
        background: transparent;
        border: none;
        font-family: inherit;
        color: var(--secondary-text-color);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .popup-tab ha-icon {
        --mdc-icon-size: 16px;
      }
      .popup-tab.active-tab {
        background: var(--primary-color, #0284c7);
        color: var(--text-primary-color, #ffffff);
        font-weight: 700;
      }
      .modal-scroll-area {
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        max-height: 60vh;
        padding-right: 2px;
      }
      .modal-tab-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .modal-empty-state {
        padding: 28px 12px;
        text-align: center;
        font-size: 13px;
        color: var(--secondary-text-color);
      }

      /* KPI & SECTION CARDS */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 7px;
      }
      .kpi-card {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 9px;
        border-radius: 12px;
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.08));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
      }
      .kpi-card.warn {
        border-color: rgba(245, 158, 11, 0.45);
        background: rgba(245, 158, 11, 0.1);
      }
      .kpi-label {
        font-size: 11.5px;
        font-weight: 700;
        color: var(--secondary-text-color);
      }
      .kpi-val {
        font-size: 16px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .kpi-val.green { color: #16a34a; }
      .kpi-val.amber { color: #d97706; }
      .kpi-val.sky { color: #0284c7; }

      .passable-section-card {
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.08));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.14));
        border-radius: 16px;
        padding: 11px 12px;
        display: flex;
        flex-direction: column;
        gap: 9px;
      }
      .passable-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .passable-section-title {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .muted-hint {
        margin: 0;
        font-size: 12px;
        color: var(--secondary-text-color);
        line-height: 1.4;
      }
      .room-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .room-card-title-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .room-card-title {
        font-size: 13.5px;
        font-weight: 700;
      }
      .room-card-controls {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .room-pill-toggle {
        padding: 4px 10px;
        border-radius: 999px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .room-pill-toggle.green {
        background: rgba(34, 197, 94, 0.15);
        border-color: rgba(34, 197, 94, 0.4);
        color: #16a34a;
      }
      .room-pill-toggle.amber {
        background: rgba(245, 158, 11, 0.15);
        border-color: rgba(245, 158, 11, 0.4);
        color: #d97706;
      }
      .usage-progress-row,
      .activity-device-block {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .usage-progress-labels {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
      }
      .progress-track {
        width: 100%;
        height: 7px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.22);
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: 999px;
        background: #22c55e;
      }
      .progress-fill.warn {
        background: #f59e0b;
      }
      .progress-fill.over {
        background: #ef4444;
      }
      .control-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      /* RESTRICTIONS */
      .restrictions-chips-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .restriction-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.25));
        background: var(--card-background-color, rgba(128, 128, 128, 0.08));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .restriction-pill-btn.active {
        background: rgba(239, 68, 68, 0.14);
        border-color: rgba(239, 68, 68, 0.45);
        color: #dc2626;
      }
      .restriction-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #94a3b8;
      }
      .restriction-dot.active {
        background: #ef4444;
      }
      .restriction-state {
        font-size: 11px;
        font-weight: 800;
      }

      /* DEVICE SWITCHER, TIMERS & SCHEDULES */
      .device-switcher-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .device-switch-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.24));
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.08));
        color: var(--secondary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .device-switch-pill.active {
        background: var(--primary-color, #0284c7);
        border-color: var(--primary-color, #0284c7);
        color: #ffffff;
      }
      .segmented-tabs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
        border-radius: 12px;
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.12));
      }
      .segmented-tabs.two-up {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .seg-tab {
        padding: 6px 8px;
        border-radius: 9px;
        border: none;
        background: transparent;
        color: var(--secondary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .seg-tab.active.sky {
        background: #0284c7;
        color: #ffffff;
      }
      .seg-tab.active.amber {
        background: #d97706;
        color: #ffffff;
      }
      .seg-tab.active.violet {
        background: #7c3aed;
        color: #ffffff;
      }
      .preset-chips-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .preset-chip {
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.25));
        background: var(--card-background-color, rgba(128, 128, 128, 0.08));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .preset-chip.active {
        background: var(--primary-color, #0284c7);
        border-color: var(--primary-color, #0284c7);
        color: #ffffff;
      }
      .two-col-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .field-label {
        font-size: 11.5px;
        font-weight: 700;
        color: var(--secondary-text-color);
      }
      .field-input,
      .template-select,
      .rule-name-input {
        width: 100%;
        box-sizing: border-box;
        padding: 7px 10px;
        border-radius: 9px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.28));
        background: var(--card-background-color, rgba(128, 128, 128, 0.06));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 13px;
      }
      .template-select {
        width: auto;
        font-size: 12px;
        padding: 4px 8px;
      }
      .inline-check-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12.5px;
        cursor: pointer;
      }
      .until-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
      }
      .primary-cta-btn,
      .secondary-cta-btn,
      .danger-outline-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 9px 14px;
        border-radius: 11px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .primary-cta-btn {
        background: var(--primary-color, #0284c7);
        color: #ffffff;
      }
      .primary-cta-btn.sky { background: #0284c7; color: #ffffff; }
      .primary-cta-btn.amber { background: #d97706; color: #ffffff; }
      .primary-cta-btn.violet { background: #7c3aed; color: #ffffff; }
      .primary-cta-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .secondary-cta-btn {
        background: var(--card-background-color, rgba(128, 128, 128, 0.1));
        border-color: var(--divider-color, rgba(128, 128, 128, 0.28));
        color: var(--primary-text-color);
      }
      .danger-outline-btn {
        background: transparent;
        border-color: rgba(239, 68, 68, 0.5);
        color: #dc2626;
      }

      /* SCHEDULE RULES & M3 SWITCH */
      .switch-control-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .switch-title {
        font-size: 13px;
        font-weight: 700;
      }
      .switch-sub {
        font-size: 11.5px;
        color: var(--secondary-text-color);
      }
      .m3-switch {
        width: 44px;
        height: 26px;
        border-radius: 999px;
        border: 1.5px solid var(--divider-color, #94a3b8);
        background: rgba(148, 163, 184, 0.24);
        position: relative;
        cursor: pointer;
        padding: 0;
        flex-shrink: 0;
      }
      .m3-switch.small {
        width: 36px;
        height: 22px;
      }
      .m3-switch.on {
        background: var(--primary-color, #0284c7);
        border-color: var(--primary-color, #0284c7);
      }
      .m3-knob {
        position: absolute;
        top: 50%;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #ffffff;
        transform: translateY(-50%);
        transition: left 0.18s ease;
      }
      .m3-switch.small .m3-knob {
        width: 14px;
        height: 14px;
      }
      .m3-switch.on .m3-knob {
        left: calc(100% - 21px);
      }
      .m3-switch.small.on .m3-knob {
        left: calc(100% - 17px);
      }
      .schedule-rule-card {
        padding: 10px;
        border-radius: 12px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.2));
        background: var(--card-background-color, rgba(128, 128, 128, 0.05));
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .rule-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .rule-name-input {
        font-weight: 700;
        padding: 5px 8px;
      }
      .rule-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .day-presets-row,
      .recurrence-row,
      .copy-checks-row,
      .copy-targets-grid,
      .sched-footer-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .sched-footer-actions > button {
        flex: 1;
      }
      .tiny-preset-btn {
        padding: 2px 7px;
        border-radius: 6px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: transparent;
        color: var(--secondary-text-color);
        font-family: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .day-chips {
        display: flex;
        justify-content: space-between;
        gap: 6px;
      }
      .day-chip {
        flex: 1;
        height: 32px;
        border-radius: 50%;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.28));
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.1));
        color: var(--secondary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .day-chip.selected {
        background: var(--primary-color, #0284c7);
        border-color: var(--primary-color, #0284c7);
        color: #ffffff;
      }
      .seg-mini-btn {
        flex: 1;
        padding: 5px 8px;
        border-radius: 8px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.24));
        background: transparent;
        color: var(--secondary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .seg-mini-btn.active {
        background: rgba(2, 132, 199, 0.16);
        border-color: #0284c7;
        color: #0284c7;
      }

      /* ACTIVITY & MANAGE */
      .app-badges-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .app-badge {
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11.5px;
        font-weight: 600;
        background: var(--card-background-color, rgba(128, 128, 128, 0.1));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.2));
      }
      .manage-device-item {
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.18));
        border-radius: 10px;
        overflow: hidden;
      }
      .manage-device-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        cursor: pointer;
        background: var(--card-background-color, rgba(128, 128, 128, 0.05));
      }
      .manage-device-body {
        padding: 10px;
        border-top: 1px solid var(--divider-color, rgba(128, 128, 128, 0.14));
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .restriction-manage-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
      }

      /* PIN KEYPAD */
      .pin-dots-row {
        display: flex;
        justify-content: center;
        gap: 10px;
        padding: 10px 0 4px;
      }
      .pin-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 1.5px solid var(--secondary-text-color);
      }
      .pin-dot.filled {
        background: var(--primary-color, #0284c7);
        border-color: var(--primary-color, #0284c7);
      }
      .pin-error-text {
        text-align: center;
        color: #dc2626;
        font-size: 12px;
        font-weight: 700;
      }
      .pin-keypad {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .pin-key {
        height: 48px;
        border-radius: 12px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.24));
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.1));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 18px;
        font-weight: 700;
        cursor: pointer;
      }
      .pin-key.submit {
        background: var(--primary-color, #0284c7);
        border-color: var(--primary-color, #0284c7);
        color: #ffffff;
        font-size: 14px;
      }
      .pin-key.fn {
        font-size: 16px;
      }
    `;
  }
}

// ===========================================================================
// VISUAL CONFIG EDITOR (Passable Design System Parity)
// ===========================================================================

class PassableScreenTimeCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      config: { state: true },
    };
  }

  setConfig(config) {
    this.config = { ...config };
  }

  _updateConfig(patch) {
    const next = { ...(this.config || {}), ...patch };
    this.config = next;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.hass || !this.config) return html``;
    const c = this.config;
    const layout = c.layout || "tiles";
    const defaultStrips = !["compact", "strip"].includes(layout);

    return html`
      <div class="editor-container">
        <div class="section-box">
          <h3>Appearance & Layout</h3>

          <ha-textfield
            label="Card Title"
            .value=${c.title ?? "Screen Time"}
            @input=${(ev) => this._updateConfig({ title: ev.target.value })}
          ></ha-textfield>

          <ha-textfield
            label="Card Subtitle"
            .value=${c.subtitle ?? "Smart Screen Time & Lockout Hub"}
            @input=${(ev) => this._updateConfig({ subtitle: ev.target.value })}
          ></ha-textfield>

          <div class="form-group">
            <label class="form-label">Display Mode</label>
            <select
              class="custom-select"
              .value=${c.display_mode || "summary"}
              @change=${(ev) =>
                this._updateConfig({ display_mode: ev.target.value })}
            >
              <option value="summary">Summary Card + Popup Command Center (Recommended)</option>
              <option value="full">Full Embedded Command Center</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Device Summary Layout</label>
            <select
              class="custom-select"
              .value=${layout}
              @change=${(ev) => {
                const nextLayout = ev.target.value;
                const next = { ...(this.config || {}), layout: nextLayout };
                if (["compact", "strip"].includes(nextLayout)) {
                  delete next.show_summary_strip;
                  delete next.show_footer_strip;
                }
                this.config = next;
                this.dispatchEvent(
                  new CustomEvent("config-changed", {
                    detail: { config: next },
                    bubbles: true,
                    composed: true,
                  })
                );
              }}
            >
              <option value="compact">Consolidated Hero Card — 1 Summary Tile (Wall Panel Recommended)</option>
              <option value="strip">Minimal Single Bar — Ultra-Compact 1-Line Strip</option>
              <option value="active">Active Only — Hide Idle / Off Devices</option>
              <option value="tiles">Compact 2-Column Tiles (All Devices)</option>
              <option value="rows">Stacked Device Rows (All Devices)</option>
              <option value="rings">Circular Progress Rings (All Devices)</option>
            </select>
          </div>

          <div class="switch-row">
            <label class="form-label">Show Card Header</label>
            <ha-switch
              .checked=${c.show_header === true}
              @change=${(ev) =>
                this._updateConfig({ show_header: ev.target.checked })}
            ></ha-switch>
          </div>

          <div class="switch-row">
            <label class="form-label">Show Top Summary Strip</label>
            <ha-switch
              .checked=${c.show_summary_strip !== undefined
                ? Boolean(c.show_summary_strip)
                : defaultStrips}
              @change=${(ev) =>
                this._updateConfig({ show_summary_strip: ev.target.checked })}
            ></ha-switch>
          </div>

          <div class="switch-row">
            <label class="form-label">Show Bottom Footer Strip</label>
            <ha-switch
              .checked=${c.show_footer_strip !== undefined
                ? Boolean(c.show_footer_strip)
                : defaultStrips}
              @change=${(ev) =>
                this._updateConfig({ show_footer_strip: ev.target.checked })}
            ></ha-switch>
          </div>

          <div class="switch-row">
            <label class="form-label">Show Activity Button</label>
            <ha-switch
              .checked=${c.show_stats_button !== false}
              @change=${(ev) =>
                this._updateConfig({ show_stats_button: ev.target.checked })}
            ></ha-switch>
          </div>

          <ha-textfield
            label="Default Expanded Drawer (device_id or 'all')"
            .value=${c.default_expanded_drawer || ""}
            @input=${(ev) =>
              this._updateConfig({ default_expanded_drawer: ev.target.value })}
          ></ha-textfield>
        </div>

        <div class="section-box">
          <h3>Wall Panel & Access Control</h3>

          <div class="form-group">
            <label class="form-label">Parental PIN Requirement</label>
            <select
              class="custom-select"
              .value=${String(c.require_pin ?? "auto")}
              @change=${(ev) => {
                const v = ev.target.value;
                this._updateConfig({
                  require_pin: v === "true" ? true : v === "false" ? false : "auto",
                });
              }}
            >
              <option value="auto">Auto (Use Integration PIN Settings)</option>
              <option value="true">Always Enforce on This Card</option>
              <option value="false">Bypass on This Card (Trusted Parent Dashboard)</option>
            </select>
          </div>

          <div class="switch-row">
            <label class="form-label">Hide Admin Setup Tab (Wall Panel Kiosk)</label>
            <ha-switch
              .checked=${c.hide_admin_setup === true}
              @change=${(ev) =>
                this._updateConfig({ hide_admin_setup: ev.target.checked })}
            ></ha-switch>
          </div>
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .editor-container {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .section-box {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .section-box h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
      }
      .switch-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .form-label {
        font-size: 13px;
        color: var(--primary-text-color);
      }
      .custom-select {
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--divider-color, #ccc);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        font-family: inherit;
      }
    `;
  }
}

if (!customElements.get("passable-screen-time-card")) {
  customElements.define("passable-screen-time-card", PassableScreenTimeCard);
}
if (!customElements.get("passable-device-lockout-card")) {
  customElements.define(
    "passable-device-lockout-card",
    class extends PassableScreenTimeCard {}
  );
}
if (!customElements.get("passable-screen-time-card-editor")) {
  customElements.define(
    "passable-screen-time-card-editor",
    PassableScreenTimeCardEditor
  );
}

window.customCards = window.customCards || [];
const cardEntry = {
  type: "passable-screen-time-card",
  name: "Passable Screen Time Card",
  preview: true,
  description:
    "Passable design-system screen time summary card with inline quick-drawer, 4-tab Command Center, multi-window schedules, and Parental PIN.",
};

const existingIndex = window.customCards.findIndex(
  (c) => c.type === "passable-screen-time-card"
);
if (existingIndex >= 0) {
  window.customCards[existingIndex] = cardEntry;
} else {
  window.customCards.push(cardEntry);
}
