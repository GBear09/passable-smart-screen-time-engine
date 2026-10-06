/**
 * Passable Smart Screen Time Engine Card
 * Part of the Passable Suite by GBear09
 * https://github.com/GBear09/passable-smart-screen-time-engine
 * 
 * Version 1.2.0 - Full UI, color, layout & design parity with Passable Smart Lock Engine
 */

const CARD_VERSION = "1.2.0";

const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace") ||
  customElements.get("hui-entities-card") ||
  customElements.get("hc-main")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

console.info(
  `%c PASSABLE-SCREEN-TIME-CARD %c v${CARD_VERSION} IS LOADED `,
  "color: white; background: #0284c7; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #0284c7; background: #e0f2fe; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);

// --- INLINE SVG ICONS (Lucide & MDI) ---
const Icons = {
  Lock: html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>`,
  Unlock: html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>`,
  Tv: html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`,
  Tablet: html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>`,
  Power: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`,
  Clock: html`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>`,
  ClockLg: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>`,
  Hourglass: html`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>`,
  Calendar: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>`,
  Play: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>`,
  Check: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>`,
  AlertTriangle: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>`,
  History: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>`,
  RefreshCw: html`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>`,
  ArrowLeft: html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>`,
  ChevronDown: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>`,
  ChevronUp: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>`,
  Save: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>`,
  Trash2: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>`,
  Sliders: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/></svg>`,
  Sparkles: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>`,
};

class PassableScreenTimeCard extends LitElement {
  static getConfigElement() {
    return document.createElement("passable-screen-time-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Screen Time & Device Access",
      subtitle: "Smart Screen Time Command Center",
      show_lock_all: true,
      show_timeline: true,
      timeline_hours: 24,
      default_expand_activity: false,
    };
  }

  static properties = {
    hass: { attribute: false },
    config: { state: true },
    _backendData: { state: true },
    _editingDeviceId: { state: true },
    _localName: { state: true },
    _localDailyLimit: { state: true },
    _localSchedEnabled: { state: true },
    _localSchedDays: { state: true },
    _localSchedStart: { state: true },
    _localSchedEnd: { state: true },
    _localSchedRecurrence: { state: true },
    _localSchedAnchorDate: { state: true },
    _localTimerDuration: { state: true },
    _localTimerUnit: { state: true },
    _openSections: { state: true },
    _expandedRecentActivity: { state: true },
    _selectedTimelineFilter: { state: true },
    _isFetchingActivity: { state: true },
    _saveError: { state: true },
  };

  constructor() {
    super();
    this._backendData = { devices: {}, global_restrictions: [] };
    this._editingDeviceId = null;
    this._localName = "";
    this._localDailyLimit = 120;
    this._localSchedEnabled = true;
    this._localSchedDays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    this._localSchedStart = "08:00";
    this._localSchedEnd = "20:00";
    this._localSchedRecurrence = "weekly";
    this._localSchedAnchorDate = null;
    this._localTimerDuration = 20;
    this._localTimerUnit = "minutes";
    this._openSections = { limits: true, timer: true, schedule: false };
    this._expandedRecentActivity = false;
    this._selectedTimelineFilter = "all";
    this._isFetchingActivity = false;
    this._saveError = null;

    this._fullDaysList = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    this._shortDaysList = ["S", "M", "T", "W", "T", "F", "S"];
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this.config = {
      title: "Screen Time & Device Access",
      subtitle: "Smart Screen Time Command Center",
      show_lock_all: true,
      show_timeline: true,
      timeline_hours: 24,
      default_expand_activity: false,
      ...config,
    };
    if (this.config.default_expand_activity !== undefined) {
      this._expandedRecentActivity = this.config.default_expand_activity;
    }
  }

  getCardSize() {
    return 6;
  }

  connectedCallback() {
    super.connectedCallback();
    this._fetchData();
    this._timerInterval = setInterval(() => this.requestUpdate(), 1000);
    this._pollInterval = setInterval(() => this._fetchData(), 15000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._timerInterval) clearInterval(this._timerInterval);
    if (this._pollInterval) clearInterval(this._pollInterval);
  }

  async _fetchData() {
    if (!this.hass) return;
    try {
      this._isFetchingActivity = true;
      const res = await this.hass.callWS({
        type: "passable_smart_screen_time_engine/get_data",
      });
      if (res) {
        this._backendData = res;
      }
    } catch (e) {
      // Integration may still be loading
    } finally {
      this._isFetchingActivity = false;
      this.requestUpdate();
    }
  }

  // --- TIME & DURATION HELPERS ---
  _formatMins(mins) {
    if (!mins || mins <= 0) return "0m";
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  _formatRemainingShort(expiresAtStr) {
    if (!expiresAtStr) return "";
    const ms = new Date(expiresAtStr).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m left`;
    }
    return `${mins}m ${secs.toString().padStart(2, "0")}s left`;
  }

  _formatRemainingFull(expiresAtStr) {
    if (!expiresAtStr) return "Expired";
    const ms = new Date(expiresAtStr).getTime() - Date.now();
    if (ms <= 0) return "Expired (clearing...)";
    const totalMinutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) {
      return `${hours} hr${hours > 1 ? "s" : ""} ${mins} min${mins > 1 ? "s" : ""} remaining`;
    }
    const secs = Math.floor((ms % (60 * 1000)) / 1000);
    return `${mins} min${mins > 1 ? "s" : ""} ${secs}s remaining`;
  }

  _getMondayOfWeek(date = new Date(), offsetWeeks = 0) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() + (day === 0 ? -6 : 1 - day) + offsetWeeks * 7;
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, "0");
    const dt = String(monday.getDate()).padStart(2, "0");
    return `${year}-${month}-${dt}`;
  }

  _isBiweeklyActiveThisWeek(anchorDateStr) {
    if (!anchorDateStr) return true;
    try {
      const anchorMondayStr = this._getMondayOfWeek(new Date(anchorDateStr + "T12:00:00"));
      const currentMondayStr = this._getMondayOfWeek(new Date());
      const anchorTime = new Date(anchorMondayStr + "T12:00:00").getTime();
      const currentTime = new Date(currentMondayStr + "T12:00:00").getTime();
      const diffWeeks = Math.round((currentTime - anchorTime) / (7 * 86400 * 1000));
      return Math.abs(diffWeeks) % 2 === 0;
    } catch (e) {
      return true;
    }
  }

  // --- ACTIONS ---
  async _setLockout(deviceId, locked, powerOn = false) {
    try {
      await this.hass.callWS({
        type: "passable_smart_screen_time_engine/set_lockout",
        device_id: deviceId,
        locked: locked,
        power_on: powerOn,
      });
      await this._fetchData();
    } catch (e) {
      console.error("Set lockout failed", e);
    }
  }

  async _lockAllDevices(devices, shouldLock) {
    if (!devices || Object.keys(devices).length === 0) return;
    // Check if master switch is available first
    if (this.hass?.states["switch.passable_master_device_lockout"]) {
      this.hass.callService("switch", shouldLock ? "turn_on" : "turn_off", {
        entity_id: "switch.passable_master_device_lockout",
      });
      setTimeout(() => this._fetchData(), 800);
      return;
    }
    // Fallback: iterate over devices
    const promises = Object.keys(devices).map((did) =>
      this._setLockout(did, shouldLock)
    );
    await Promise.all(promises);
  }

  async _startTimer(deviceId) {
    try {
      await this.hass.callWS({
        type: "passable_smart_screen_time_engine/start_timer",
        device_id: deviceId,
        duration: parseFloat(this._localTimerDuration) || 20,
        unit: this._localTimerUnit || "minutes",
      });
      await this._fetchData();
    } catch (e) {
      this._saveError = "Failed to start timer: " + (e?.message || e);
    }
  }

  async _cancelTimer(deviceId) {
    try {
      await this.hass.callWS({
        type: "passable_smart_screen_time_engine/cancel_timer",
        device_id: deviceId,
      });
      await this._fetchData();
    } catch (e) {
      console.error("Cancel timer failed", e);
    }
  }

  async _saveDeviceDetails(deviceId) {
    this._saveError = null;
    try {
      await this.hass.callWS({
        type: "passable_smart_screen_time_engine/save_device",
        device_id: deviceId,
        name: this._localName || undefined,
        daily_limit_minutes: parseInt(this._localDailyLimit, 10) || 120,
        schedule_enabled: Boolean(this._localSchedEnabled),
        schedule_days: this._localSchedDays || this._fullDaysList,
        schedule_start: this._localSchedStart || "08:00",
        schedule_end: this._localSchedEnd || "20:00",
        schedule_recurrence: this._localSchedRecurrence || "weekly",
        schedule_anchor_date:
          this._localSchedRecurrence === "biweekly"
            ? (this._localSchedAnchorDate || this._getMondayOfWeek(new Date(), 0))
            : null,
      });
      this._closeEdit();
      await this._fetchData();
    } catch (e) {
      this._saveError = e?.message || "Failed to save settings.";
      this.requestUpdate();
    }
  }

  async _deleteDevice(deviceId) {
    const dev = this._backendData.devices[deviceId];
    const devName = dev?.name || deviceId;
    if (!confirm(`Are you sure you want to remove "${devName}" from the Screen Time Engine?`)) {
      return;
    }
    try {
      await this.hass.callWS({
        type: "passable_smart_screen_time_engine/delete_device",
        device_id: deviceId,
      });
      this._editingDeviceId = null;
      await this._fetchData();
    } catch (e) {
      console.error("Failed to delete device:", e);
    }
  }

  _toggleDevicePower(targetEntity, isSwitch) {
    if (!this.hass || !targetEntity) return;
    if (isSwitch) {
      this.hass.callService("switch", "toggle", { entity_id: targetEntity });
    } else {
      this.hass.callService("media_player", "toggle", { entity_id: targetEntity });
    }
  }

  _toggleSection(key) {
    this._openSections = {
      ...this._openSections,
      [key]: !this._openSections[key],
    };
  }

  _openEdit(deviceId) {
    const dev = this._backendData.devices[deviceId] || {};
    this._editingDeviceId = deviceId;
    this._localName = dev.name || "";
    this._localDailyLimit = dev.daily_limit_minutes || 120;
    this._localSchedEnabled = dev.schedule_enabled ?? true;
    this._localSchedDays = dev.schedule_days ? [...dev.schedule_days] : [...this._fullDaysList];
    this._localSchedStart = dev.schedule_start || "08:00";
    this._localSchedEnd = dev.schedule_end || "20:00";
    this._localSchedRecurrence = dev.schedule_recurrence || "weekly";
    this._localSchedAnchorDate = dev.schedule_anchor_date || null;
    this._localTimerDuration = dev.timer_duration || 20;
    this._localTimerUnit = dev.timer_unit || "minutes";
    this._saveError = null;
  }

  _closeEdit() {
    this._editingDeviceId = null;
    this._saveError = null;
  }

  _toggleDay(day) {
    let days = [...(this._localSchedDays || [])];
    if (days.includes(day)) {
      days = days.filter((d) => d !== day);
    } else {
      days.push(day);
    }
    this._localSchedDays = days;
    this.requestUpdate();
  }

  // --- RENDER ---
  render() {
    if (!this.hass) return html`<div class="loading">Loading Screen Time Hub...</div>`;

    return html`
      <ha-card class="container">
        ${this._editingDeviceId
          ? this._renderEditView()
          : this._renderMainView()}
      </ha-card>
    `;
  }

  // =========================================================================
  // MAIN VIEW (HERO SCREENS, RESTRICTIONS, & 24H ACTIVITY TIMELINE)
  // =========================================================================

  _renderMainView() {
    const devices = this._backendData.devices || {};
    const devKeys = Object.keys(devices);
    const totalDevices = devKeys.length;
    const restrictions = this._backendData.global_restrictions || [];

    const title = this.config?.title || "Screen Time & Device Access";
    const subtitle = this.config?.subtitle || "Smart Screen Time Command Center";

    // Global Lock Status Computation
    let lockedCount = 0;
    let anyLocked = false;
    let anyTimerActive = false;

    devKeys.forEach((k) => {
      const dev = devices[k];
      if (dev.locked) {
        lockedCount++;
        anyLocked = true;
      }
      if (dev.timer_expires_at && new Date(dev.timer_expires_at).getTime() > Date.now()) {
        anyTimerActive = true;
      }
    });

    const masterLockState = this.hass?.states["switch.passable_master_device_lockout"]?.state;
    if (masterLockState === "on") {
      anyLocked = true;
    }

    const showTimeline = this.config?.show_timeline !== false;

    return html`
      <div class="view fade-in">
        <!-- Main Card Header (Smart Lock Engine Parity) -->
        <div class="header">
          <div class="header-left">
            <h1 class="title">
              <ha-icon icon="mdi:television-shimmer" style="margin-right: 8px; color: var(--primary-color);"></ha-icon>
              ${title}
              <span class="engine-badge native">SCREEN TIME HUB</span>
            </h1>
            <p class="subtitle">${subtitle}</p>
          </div>

          <div class="header-right">
            <div class="global-status">
              ${anyLocked
                ? html`
                    <span class="status-pill locked">
                      ${Icons.Lock} ${lockedCount > 0 ? `${lockedCount} Restricted` : "Restricted"}
                    </span>
                  `
                : html`
                    <span class="status-pill unlocked">
                      ${Icons.Check} All Permitted
                    </span>
                  `}
              ${this.config?.show_lock_all !== false && totalDevices > 0
                ? html`
                    <button
                      class="lock-all-btn"
                      @click=${() => this._lockAllDevices(devices, !anyLocked)}
                      title="${anyLocked ? 'Permit all screens' : 'Lock all screens'}"
                    >
                      ${anyLocked ? Icons.Unlock : Icons.Lock}
                      ${anyLocked ? "Unlock All" : "Lock All"}
                    </button>
                  `
                : ""}
            </div>
          </div>
        </div>

        <!-- 1. Household Restrictions Section -->
        ${restrictions.length > 0 ? this._renderRestrictionsSection(restrictions) : ""}

        <!-- 2. Hero Devices Section (Matching .doors-section & .doors-grid) -->
        ${totalDevices > 0 ? this._renderDevicesSection(devices, devKeys) : html`
          <div class="empty-feed" style="padding: 24px 0;">
            No screen time devices configured. Add entities in the integration settings.
          </div>
        `}

        <!-- 3. 24-Hour Timeline & Screen Time Breakdown (Matching .activity-section) -->
        ${showTimeline && totalDevices > 0 ? this._renderActivitySection(devices, devKeys) : ""}
      </div>
    `;
  }

  // --- HOUSEHOLD RESTRICTIONS ROW ---
  _renderRestrictionsSection(restrictions) {
    return html`
      <div class="restrictions-section">
        <div class="section-label-row">
          <span class="section-label-text">Household Restrictions & Schedules</span>
        </div>
        <div class="restrictions-grid">
          ${restrictions.map((r) => {
            const stateObj = this.hass.states[r.entity];
            const isOn = stateObj && stateObj.state === "on";
            const name = r.name || stateObj?.attributes?.friendly_name || r.entity;
            return html`
              <div
                class="restriction-pill ${isOn ? 'active' : ''}"
                @click=${() => this.hass.callService("homeassistant", "toggle", { entity_id: r.entity })}
              >
                <span class="restriction-dot ${isOn ? 'active' : ''}"></span>
                <span class="restriction-title">${name}</span>
                <span class="restriction-status ${isOn ? 'active' : ''}">${isOn ? "Active" : "Off"}</span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  // --- HERO DEVICES SECTION (Smart Lock .doors-section Parity) ---
  _renderDevicesSection(devices, devKeys) {
    const totalCount = devKeys.length;
    const permittedCount = devKeys.filter((k) => !devices[k].locked).length;

    return html`
      <div class="doors-section">
        <div class="section-label-row">
          <span class="section-label-text">Controlled Screens & Devices</span>
          <div class="slots-badge-counter">
            ${permittedCount}<span class="divider">/</span>${totalCount} Permitted
          </div>
        </div>

        <div class="doors-grid">
          ${devKeys.map((did) => this._renderDeviceCard(did, devices[did]))}
        </div>
      </div>
    `;
  }

  _renderDeviceCard(did, dev) {
    const isSwitch = dev.device_type === "network_switch";
    const targetState = this.hass?.states[dev.target_entity];
    const isPowerOn = isSwitch
      ? targetState && targetState.state === "off" // unpaused
      : targetState && ["on", "playing", "idle"].includes(targetState.state);
    const isLocked = Boolean(dev.locked);
    const timerActive = dev.timer_expires_at && new Date(dev.timer_expires_at).getTime() > Date.now();
    const limitMins = dev.daily_limit_minutes || 120;
    const usageMins = dev.screen_time_today_minutes || 0;
    const pct = Math.min(100, Math.round((usageMins / limitMins) * 100));

    return html`
      <div class="door-card ${isLocked ? 'locked' : 'unlocked'}">
        <div class="door-card-header">
          <div class="door-icon-wrapper ${isLocked ? 'locked' : 'unlocked'} ${isPowerOn ? 'powered' : ''}">
            ${isSwitch ? Icons.Tablet : Icons.Tv}
          </div>

          <div class="door-title-wrapper" @click=${() => this._openEdit(did)} style="cursor: pointer;">
            <h3 class="door-name">${dev.name}</h3>
            <span class="door-time">
              ${this._formatMins(usageMins)} watched today • ${isPowerOn ? "Power On" : "Power Off"}
            </span>
          </div>

          <!-- Top-right Pills (Usage & Timer) -->
          <div style="display: flex; gap: 6px; align-items: center;">
            ${timerActive
              ? html`
                  <div class="battery-pill warning" title="One More Show Timer Active">
                    ${Icons.Hourglass}
                    <span>${this._formatRemainingShort(dev.timer_expires_at)}</span>
                  </div>
                `
              : ""}
            <div
              class="battery-pill ${pct >= 100 ? 'critical' : pct >= 75 ? 'warning' : 'good'}"
              title="Screen Time: ${this._formatMins(usageMins)} / ${this._formatMins(limitMins)} limit"
            >
              ${Icons.Clock}
              <span>${this._formatMins(usageMins)}</span>
            </div>
          </div>
        </div>

        <!-- Telemetry & Active Streaming App Bar -->
        <div class="device-telemetry-row">
          <div class="progress-bar-bg" title="Daily limit: ${pct}% reached">
            <div
              class="progress-bar-fill ${pct >= 100 ? 'over' : ''}"
              style="width: ${pct}%;"
            ></div>
          </div>
          ${dev.active_app && dev.active_app !== "None"
            ? html`
                <div class="app-chip" title="Current Active Application">
                  ▶ ${dev.active_app}
                </div>
              `
            : ""}
        </div>

        <!-- Primary Action Row (Smart Lock .door-toggle-btn Parity) -->
        <div class="door-action-row">
          <button
            class="door-toggle-btn ${isLocked ? 'btn-unlocked' : 'btn-locked'}"
            @click=${() => this._setLockout(did, !isLocked, isLocked)}
            title="${isLocked ? 'Tap to permit screen time' : 'Tap to lock screen'}"
          >
            <div class="btn-icon">
              ${isLocked ? Icons.Lock : Icons.Unlock}
            </div>
            <div class="btn-text">
              <span class="btn-action-label">
                ${isLocked ? "Restricted (Locked)" : "Permitted (Unlocked)"}
              </span>
              <span class="btn-sub-label">
                ${isLocked ? "Tap to permit access" : "Tap to restrict screen"}
              </span>
            </div>
          </button>

          <!-- Quick Secondary Action Buttons -->
          <button
            class="icon-button ${isPowerOn ? 'active' : ''}"
            title="${isSwitch ? 'Toggle Wi-Fi Pause' : 'Toggle Power'}"
            @click=${() => this._toggleDevicePower(dev.target_entity, isSwitch)}
          >
            ${Icons.Power}
          </button>

          <button
            class="icon-button"
            title="Device Schedule & Settings"
            @click=${() => this._openEdit(did)}
          >
            ${Icons.Sliders}
          </button>
        </div>
      </div>
    `;
  }

  // --- 24-HOUR ACTIVITY & TIMELINE SECTION (Smart Lock .activity-section Parity) ---
  _renderActivitySection(devices, devKeys) {
    const hours = this.config?.timeline_hours || 24;
    const filter = this._selectedTimelineFilter || "all";
    const isExpanded = this._expandedRecentActivity;

    // Filter devices for breakdown
    const targetDevKeys = filter === "all" ? devKeys : [filter].filter((k) => devices[k]);

    return html`
      <div class="activity-section">
        <div class="section-label-row">
          <div class="activity-title-group">
            <span class="activity-icon-header">${Icons.History}</span>
            <span class="section-label-text">
              ${hours}-Hour Screen Time Activity
            </span>
          </div>

          <div class="timeline-header-actions">
            <button
              class="feed-refresh-btn ${this._isFetchingActivity ? 'spinning' : ''}"
              @click=${() => this._fetchData()}
              title="Refresh screen time telemetry"
            >
              ${Icons.RefreshCw}
            </button>

            <div class="timeline-filter-pills">
              <button
                class="filter-pill ${filter === 'all' ? 'active' : ''}"
                @click=${() => (this._selectedTimelineFilter = 'all')}
              >
                All Screens
              </button>
              ${devKeys.map((k) => {
                const dev = devices[k];
                return html`
                  <button
                    class="filter-pill ${filter === k ? 'active' : ''}"
                    @click=${() => (this._selectedTimelineFilter = k)}
                  >
                    ${dev.name}
                  </button>
                `;
              })}
            </div>
          </div>
        </div>

        <!-- 24-Hour Device Usage Progress Breakdown -->
        <div class="timeline-bar-wrapper">
          <div class="activity-bars-list">
            ${targetDevKeys.map((k) => {
              const dev = devices[k];
              const usage = dev.screen_time_today_minutes || 0;
              const limit = dev.daily_limit_minutes || 120;
              const pct = Math.min(100, Math.round((usage / limit) * 100));
              const isLocked = dev.locked;
              return html`
                <div class="timeline-device-row">
                  <div class="timeline-device-meta">
                    <span class="timeline-device-name">${dev.name}</span>
                    <span class="timeline-device-time">
                      ${this._formatMins(usage)} / ${this._formatMins(limit)} (${pct}%)
                    </span>
                  </div>
                  <div class="timeline-bar">
                    <div
                      class="timeline-segment ${isLocked ? 'locked' : pct >= 100 ? 'over' : 'unlocked'}"
                      style="width: ${pct}%;"
                    ></div>
                  </div>
                </div>
              `;
            })}
          </div>

          <!-- Time Axis Ticks -->
          <div class="timeline-axis">
            <span class="axis-tick">Start of Day (00:00)</span>
            <span class="axis-tick">Midday (12:00)</span>
            <span class="axis-tick">Now</span>
          </div>
        </div>

        <!-- Collapsible Recent Activity Expander Bar -->
        <div
          class="activity-expand-bar ${isExpanded ? 'open' : ''}"
          role="button"
          tabindex="0"
          @click=${() => (this._expandedRecentActivity = !this._expandedRecentActivity)}
        >
          <div class="expand-bar-left">
            <span class="expand-chevron">
              ${isExpanded ? Icons.ChevronUp : Icons.ChevronDown}
            </span>
            <span>
              ${isExpanded ? "Hide Streaming & Screen Time Log" : "Show Recent Activity & App History"}
            </span>
          </div>
          <span class="expand-hint">
            ${isExpanded ? "Collapse" : "View"}
          </span>
        </div>

        <!-- Detailed Event List (Smart Lock .event-feed-container Parity) -->
        ${isExpanded
          ? html`
              <div class="event-feed-container fade-in">
                <div class="event-list-scrollable">
                  ${targetDevKeys.map((k) => {
                    const dev = devices[k];
                    const apps = dev.apps_used_today || [];
                    const timerActive = dev.timer_expires_at && new Date(dev.timer_expires_at).getTime() > Date.now();

                    return html`
                      <!-- Device Status Event Row -->
                      <div class="event-row">
                        <div class="event-icon-box ${dev.locked ? 'unlocked' : 'locked'}">
                          ${dev.locked ? Icons.Lock : Icons.Unlock}
                        </div>
                        <div class="event-details">
                          <div class="event-top-line">
                            <span class="event-door-badge">${dev.name}</span>
                            <span class="event-action ${dev.locked ? 'unlocked' : 'locked'}">
                              ${dev.locked ? "Lockout Active (Restricted)" : "Viewing Permitted"}
                            </span>
                          </div>
                          <div class="event-sub-line">
                            <span class="event-actor">
                              ${dev.active_app && dev.active_app !== "None"
                                ? `Currently Watching: ${dev.active_app}`
                                : `Total Screen Time: ${this._formatMins(dev.screen_time_today_minutes)}`}
                            </span>
                          </div>
                        </div>
                        <div class="event-time-box">
                          <span class="event-time-clock">Today</span>
                          <span class="event-time-rel">${dev.locked ? "Locked" : "Permitted"}</span>
                        </div>
                      </div>

                      <!-- Streaming Apps Event Rows -->
                      ${apps.map(
                        (app) => html`
                          <div class="event-row">
                            <div class="event-icon-box info">
                              ${Icons.Play}
                            </div>
                            <div class="event-details">
                              <div class="event-top-line">
                                <span class="event-door-badge">${dev.name}</span>
                                <span class="event-action info">Streaming Application</span>
                              </div>
                              <div class="event-sub-line">
                                <span class="event-actor">${app}</span>
                              </div>
                            </div>
                            <div class="event-time-box">
                              <span class="event-time-clock">Active</span>
                              <span class="event-time-rel">App Session</span>
                            </div>
                          </div>
                        `
                      )}

                      <!-- Timer Event Row if active -->
                      ${timerActive
                        ? html`
                            <div class="event-row">
                              <div class="event-icon-box timer">
                                ${Icons.Hourglass}
                              </div>
                              <div class="event-details">
                                <div class="event-top-line">
                                  <span class="event-door-badge">${dev.name}</span>
                                  <span class="event-action timer">One More Show Countdown</span>
                                </div>
                                <div class="event-sub-line">
                                  <span class="event-actor">${this._formatRemainingFull(dev.timer_expires_at)}</span>
                                </div>
                              </div>
                              <div class="event-time-box">
                                <span class="event-time-clock">Active</span>
                                <span class="event-time-rel">Temporary</span>
                              </div>
                            </div>
                          `
                        : ""}
                    `;
                  })}
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }

  // =========================================================================
  // DETAIL & EDIT DRAWER VIEW (Smart Lock .edit-body & Accordions Parity)
  // =========================================================================

  _renderEditView() {
    const did = this._editingDeviceId;
    const dev = this._backendData.devices[did];
    if (!dev) return html``;

    const isSwitch = dev.device_type === "network_switch";
    const targetState = this.hass?.states[dev.target_entity];
    const isPowerOn = isSwitch
      ? targetState && targetState.state === "off"
      : targetState && ["on", "playing", "idle"].includes(targetState.state);
    const isLocked = Boolean(dev.locked);
    const isTimerActive = dev.timer_expires_at && new Date(dev.timer_expires_at).getTime() > Date.now();

    const limitMins = parseInt(this._localDailyLimit, 10) || 120;
    const usageMins = dev.screen_time_today_minutes || 0;
    const pct = Math.min(100, Math.round((usageMins / limitMins) * 100));

    return html`
      <div class="view fade-in">
        <!-- Edit Drawer Header (Smart Lock .edit-header Parity) -->
        <div class="edit-header">
          <button class="back-button" @click=${this._closeEdit}>
            ${Icons.ArrowLeft} Back
          </button>
          <div class="edit-header-right">
            <div class="icon-box active circle">
              ${isSwitch ? Icons.Tablet : Icons.Tv}
            </div>
            <div style="text-align: right">
              <h2 class="edit-title">${dev.name}</h2>
              <span class="edit-status ${isLocked ? 'warning' : 'success'}">
                ${isLocked ? "Restricted (Locked)" : "Permitted (Unlocked)"}
              </span>
            </div>
          </div>
        </div>

        ${this._saveError
          ? html`
              <div class="error-banner">
                ${this._saveError}
              </div>
            `
          : ""}

        <!-- Active Timer Live Banner (Smart Lock Parity) -->
        ${isTimerActive && dev.timer_expires_at
          ? html`
              <div class="timer-live-banner">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                  <span style="color: var(--primary-color, #2196f3); display: flex; align-items: center;">
                    ${Icons.Hourglass}
                  </span>
                  <div>
                    <div style="font-weight: 600; font-size: 13px;">Viewing Timer Active ("One More Show")</div>
                    <div style="font-size: 12px; color: var(--secondary-text-color);">
                      ${this._formatRemainingFull(dev.timer_expires_at)}
                    </div>
                  </div>
                </div>
                <button
                  class="button-outline"
                  style="flex: 0 0 auto; width: auto; white-space: nowrap; height: 30px; border-radius: 15px; padding: 0 14px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--error-color, #f44336); border-color: rgba(var(--rgb-error-color, 244, 67, 54), 0.4);"
                  @click=${() => this._cancelTimer(did)}
                >
                  Cancel Timer
                </button>
              </div>
            `
          : ""}

        <div class="edit-body">
          <!-- Device Name Input -->
          <div class="input-group">
            <label class="input-label">Device Name</label>
            <div class="input-wrapper">
              <div class="icon-absolute">${isSwitch ? Icons.Tablet : Icons.Tv}</div>
              <input
                class="custom-input"
                .value=${this._localName}
                @input=${(e) => (this._localName = e.target.value)}
                placeholder="Device Display Name"
              />
            </div>
          </div>

          <!-- Quick Controls Toggles (Smart Lock Material 3 Switch Parity) -->
          <div class="settings-list">
            <div
              class="toggle-row"
              @click=${() => this._setLockout(did, !isLocked, isLocked)}
            >
              <div class="toggle-info">
                <div style="color: ${isLocked ? 'var(--warning-color, #ff9800)' : 'var(--success-color, #4caf50)'};">
                  ${isLocked ? Icons.Lock : Icons.Unlock}
                </div>
                <div>
                  <div class="toggle-title">Device Lockout</div>
                  <div class="toggle-desc">
                    Immediately enforce restriction or permit viewing access
                  </div>
                </div>
              </div>
              <div class="toggle-switch ${isLocked ? 'active' : ''}">
                <div class="toggle-knob ${isLocked ? 'active' : ''}"></div>
              </div>
            </div>

            <div
              class="toggle-row no-border"
              @click=${() => this._toggleDevicePower(dev.target_entity, isSwitch)}
            >
              <div class="toggle-info">
                <div style="color: ${isPowerOn ? 'var(--primary-color, #2196f3)' : 'var(--secondary-text-color)'};">
                  ${Icons.Power}
                </div>
                <div>
                  <div class="toggle-title">${isSwitch ? "Wi-Fi Access Active" : "Device Power State"}</div>
                  <div class="toggle-desc">
                    ${isPowerOn ? "Device is currently powered on / unpaused" : "Device is currently powered off / paused"}
                  </div>
                </div>
              </div>
              <div class="toggle-switch ${isPowerOn ? 'active' : ''}">
                <div class="toggle-knob ${isPowerOn ? 'active' : ''}"></div>
              </div>
            </div>
          </div>

          <!-- SECTION 1: SCREEN TIME & DAILY LIMITS -->
          ${this._renderSection(
            "limits",
            "Screen Time & Usage Limits",
            Icons.Sparkles,
            html`
              <div class="metric-container">
                <div class="metric-header">
                  <span class="metric-label">Today's Usage</span>
                  <span class="metric-value">
                    ${this._formatMins(usageMins)} / ${this._formatMins(limitMins)}
                  </span>
                </div>
                <div class="progress-bar-bg">
                  <div
                    class="progress-bar-fill ${pct >= 100 ? 'over' : ''}"
                    style="width: ${pct}%"
                  ></div>
                </div>
              </div>

              <div class="inline-grid" style="margin-top: 14px;">
                <div class="input-group">
                  <label class="input-label">Daily Limit (Minutes)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    class="custom-input"
                    .value=${this._localDailyLimit}
                    @input=${(e) => (this._localDailyLimit = parseInt(e.target.value, 10) || 120)}
                  />
                </div>
                <div class="input-group">
                  <label class="input-label">Quick Limit Presets</label>
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${[60, 90, 120, 180].map(
                      (m) => html`
                        <button
                          type="button"
                          class="button-outline"
                          style="flex: 1; padding: 6px; font-size: 11px; border-radius: 8px; ${this._localDailyLimit === m ? 'background: var(--primary-color); color: #fff; border-color: var(--primary-color);' : ''}"
                          @click=${() => {
                            this._localDailyLimit = m;
                            this.requestUpdate();
                          }}
                        >
                          ${m / 60}h
                        </button>
                      `
                    )}
                  </div>
                </div>
              </div>

              ${dev.apps_used_today && dev.apps_used_today.length > 0
                ? html`
                    <div style="margin-top: 14px;">
                      <label class="input-label" style="margin-bottom: 8px; display: block;">Streaming Apps Used Today</label>
                      <div class="app-chip-list">
                        ${dev.apps_used_today.map(
                          (app) => html`<span class="app-badge">▶ ${app}</span>`
                        )}
                      </div>
                    </div>
                  `
                : html`<div class="empty-feed" style="margin-top: 10px;">No streaming apps launched today.</div>`}
            `
          )}

          <!-- SECTION 2: VIEWING TIMER ("ONE MORE SHOW") -->
          ${this._renderSection(
            "timer",
            "Viewing Timer (One More Show)",
            Icons.ClockLg,
            html`
              <div style="margin-bottom: 12px;">
                <label class="input-label" style="margin-bottom: 6px; display: block;">Quick Presets</label>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  ${[
                    { label: "15m", val: 15, unit: "minutes" },
                    { label: "20m (Show)", val: 20, unit: "minutes" },
                    { label: "30m", val: 30, unit: "minutes" },
                    { label: "45m", val: 45, unit: "minutes" },
                    { label: "1h", val: 1, unit: "hours" },
                    { label: "2h", val: 2, unit: "hours" },
                  ].map(
                    (p) => html`
                      <button
                        type="button"
                        class="button-outline"
                        style="padding: 6px 10px; font-size: 12px; border-radius: 8px; ${this._localTimerDuration === p.val && this._localTimerUnit === p.unit ? 'background: var(--primary-color); color: #fff; border-color: var(--primary-color);' : ''}"
                        @click=${() => {
                          this._localTimerDuration = p.val;
                          this._localTimerUnit = p.unit;
                          this.requestUpdate();
                        }}
                      >
                        ${p.label}
                      </button>
                    `
                  )}
                </div>
              </div>

              <div class="inline-grid">
                <div class="input-group">
                  <label class="input-label">Duration</label>
                  <input
                    type="number"
                    min="1"
                    class="custom-input"
                    .value=${this._localTimerDuration}
                    @input=${(e) => (this._localTimerDuration = parseFloat(e.target.value) || 1)}
                  />
                </div>
                <div class="input-group">
                  <label class="input-label">Unit</label>
                  <select
                    class="custom-select"
                    .value=${this._localTimerUnit}
                    @change=${(e) => {
                      this._localTimerUnit = e.target.value;
                      this.requestUpdate();
                    }}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
              </div>

              <div style="display: flex; gap: 10px; margin-top: 16px;">
                <button
                  class="button-primary"
                  style="flex: 1;"
                  @click=${() => this._startTimer(did)}
                >
                  ${Icons.Play}
                  <span style="margin-left: 8px;">
                    ${isTimerActive ? "Restart Timer & Unlock" : "Start Timer & Unlock Screen"}
                  </span>
                </button>
                ${isTimerActive
                  ? html`
                      <button
                        class="button-outline"
                        style="color: var(--error-color, #f44336); border-color: rgba(var(--rgb-error-color, 244, 67, 54), 0.4);"
                        @click=${() => this._cancelTimer(did)}
                      >
                        Cancel Timer
                      </button>
                    `
                  : ""}
              </div>
            `
          )}

          <!-- SECTION 3: DOWNTIME SCHEDULE (Smart Lock Parity) -->
          ${this._renderSection(
            "schedule",
            "Downtime Schedule & Access Rules",
            Icons.Calendar,
            html`
              <div
                class="toggle-row no-border no-pad"
                @click=${() => (this._localSchedEnabled = !this._localSchedEnabled)}
              >
                <div class="toggle-title">Enable Schedule</div>
                <div class="toggle-switch ${this._localSchedEnabled ? 'active' : ''}">
                  <div class="toggle-knob ${this._localSchedEnabled ? 'active' : ''}"></div>
                </div>
              </div>

              <div class="input-group" style="margin-top: 14px; opacity: ${this._localSchedEnabled ? '1' : '0.5'}">
                <label class="input-label">Recurrence</label>
                <div style="display: flex; gap: 8px;">
                  <button
                    type="button"
                    class="button-outline"
                    style="flex: 1; padding: 6px 12px; font-size: 13px; font-weight: 500; border-radius: 8px; ${this._localSchedRecurrence !== 'biweekly' ? 'background: var(--primary-color, #2196f3); color: #fff; border-color: var(--primary-color, #2196f3);' : ''}"
                    ?disabled=${!this._localSchedEnabled}
                    @click=${() => {
                      this._localSchedRecurrence = "weekly";
                      this.requestUpdate();
                    }}
                  >
                    Every Week
                  </button>
                  <button
                    type="button"
                    class="button-outline"
                    style="flex: 1; padding: 6px 12px; font-size: 13px; font-weight: 500; border-radius: 8px; ${this._localSchedRecurrence === 'biweekly' ? 'background: var(--primary-color, #2196f3); color: #fff; border-color: var(--primary-color, #2196f3);' : ''}"
                    ?disabled=${!this._localSchedEnabled}
                    @click=${() => {
                      this._localSchedRecurrence = "biweekly";
                      if (!this._localSchedAnchorDate) {
                        this._localSchedAnchorDate = this._getMondayOfWeek(new Date(), 0);
                      }
                      this.requestUpdate();
                    }}
                  >
                    Every 2 Weeks
                  </button>
                </div>
              </div>

              ${this._localSchedRecurrence === "biweekly"
                ? html`
                    <div class="input-group" style="margin-top: 10px; opacity: ${this._localSchedEnabled ? '1' : '0.5'}">
                      <label class="input-label">Bi-weekly Cycle</label>
                      <div style="display: flex; gap: 8px;">
                        <button
                          type="button"
                          class="button-outline"
                          style="flex: 1; padding: 6px 12px; font-size: 12px; border-radius: 8px; ${this._isBiweeklyActiveThisWeek(this._localSchedAnchorDate) ? 'background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.15); color: var(--primary-color, #2196f3); border-color: var(--primary-color, #2196f3); font-weight: 600;' : ''}"
                          ?disabled=${!this._localSchedEnabled}
                          @click=${() => {
                            this._localSchedAnchorDate = this._getMondayOfWeek(new Date(), 0);
                            this.requestUpdate();
                          }}
                        >
                          ● Active This Week
                        </button>
                        <button
                          type="button"
                          class="button-outline"
                          style="flex: 1; padding: 6px 12px; font-size: 12px; border-radius: 8px; ${!this._isBiweeklyActiveThisWeek(this._localSchedAnchorDate) ? 'background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.15); color: var(--primary-color, #2196f3); border-color: var(--primary-color, #2196f3); font-weight: 600;' : ''}"
                          ?disabled=${!this._localSchedEnabled}
                          @click=${() => {
                            this._localSchedAnchorDate = this._getMondayOfWeek(new Date(), 1);
                            this.requestUpdate();
                          }}
                        >
                          ○ Active Next Week
                        </button>
                      </div>
                    </div>
                  `
                : ""}

              <div class="input-group" style="margin-top: 14px; opacity: ${this._localSchedEnabled ? '1' : '0.5'}">
                <label class="input-label">Active Downtime Days</label>
                <div class="day-chips">
                  ${this._fullDaysList.map((day, idx) => {
                    const isSel = (this._localSchedDays || []).includes(day);
                    return html`
                      <div
                        class="day-chip ${isSel ? 'selected' : ''}"
                        @click=${() => this._localSchedEnabled && this._toggleDay(day)}
                      >
                        ${this._shortDaysList[idx]}
                      </div>
                    `;
                  })}
                </div>
              </div>

              <div class="inline-grid" style="margin-top: 14px; opacity: ${this._localSchedEnabled ? '1' : '0.5'}">
                <div class="input-group">
                  <label class="input-label">Downtime Start</label>
                  <input
                    type="time"
                    class="custom-input time-input"
                    .value=${(this._localSchedStart || "08:00").slice(0, 5)}
                    @change=${(e) => (this._localSchedStart = e.target.value)}
                    ?disabled=${!this._localSchedEnabled}
                  />
                </div>
                <div class="input-group">
                  <label class="input-label">Downtime End</label>
                  <input
                    type="time"
                    class="custom-input time-input"
                    .value=${(this._localSchedEnd || "20:00").slice(0, 5)}
                    @change=${(e) => (this._localSchedEnd = e.target.value)}
                    ?disabled=${!this._localSchedEnabled}
                  />
                </div>
              </div>
            `
          )}
        </div>

        <!-- Footer Actions (Smart Lock Parity) -->
        <div class="footer-actions">
          <button class="button-danger" @click=${() => this._deleteDevice(did)}>
            ${Icons.Trash2} Remove Device
          </button>
          <button class="button-primary" @click=${() => this._saveDeviceDetails(did)}>
            ${Icons.Save} Save
          </button>
        </div>
      </div>
    `;
  }

  // --- ACCORDION RENDERER (Smart Lock Parity) ---
  _renderSection(key, title, icon, content) {
    const isOpen = this._openSections[key] || false;
    return html`
      <div class="section">
        <div
          class="section-header ${isOpen ? 'open' : ''}"
          @click=${() => this._toggleSection(key)}
        >
          <div class="section-title">
            <span style="color: var(--primary-color)">${icon}</span>
            ${title}
          </div>
          <div
            class="section-chevron"
            style="transform: rotate(${isOpen ? '180deg' : '0deg'})"
          >
            ${Icons.ChevronDown}
          </div>
        </div>
        <div
          class="section-content-wrapper"
          style="max-height: ${isOpen ? '600px' : '0px'}; opacity: ${isOpen ? '1' : '0'}"
        >
          <div class="section-content">${content}</div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // CARD STYLES (Smart Lock Engine Parity)
  // =========================================================================

  static get styles() {
    return css`
      :host {
        display: block;
      }
      .loading {
        color: var(--primary-text-color);
        padding: 20px;
      }
      ha-card.container {
        font-family: Roboto, "Segoe UI", sans-serif;
        background-color: var(
          --ha-card-background,
          var(--card-background-color, #fff)
        );
        color: var(--primary-text-color, #212121);
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(
          --ha-card-box-shadow,
          0 2px 2px 0 rgba(0, 0, 0, 0.14),
          0 1px 5px 0 rgba(0, 0, 0, 0.12),
          0 3px 1px -2px rgba(0, 0, 0, 0.2)
        );
        box-sizing: border-box;
        width: 100%;
        overflow: hidden;
        position: relative;
        min-height: 280px;
        transition: height 0.3s ease;
      }
      .view {
        padding: 16px;
        width: 100%;
        box-sizing: border-box;
      }
      .fade-in {
        animation: fadeIn 0.3s ease-out;
      }

      /* Header */
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 16px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
        padding-bottom: 16px;
      }
      .header-left {
        display: flex;
        flex-direction: column;
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
        margin: 0;
        margin-top: 4px;
      }
      .header-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .global-status {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .status-pill {
        font-size: 12px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        gap: 6px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .status-pill.unlocked {
        background-color: rgba(var(--rgb-success-color, 76, 175, 80), 0.15);
        color: var(--success-color, #4caf50);
        border: 1px solid rgba(var(--rgb-success-color, 76, 175, 80), 0.3);
      }
      .status-pill.locked {
        background-color: rgba(var(--rgb-warning-color, 255, 152, 0), 0.15);
        color: var(--warning-color, #ff9800);
        border: 1px solid rgba(var(--rgb-warning-color, 255, 152, 0), 0.3);
      }
      .lock-all-btn {
        background-color: var(--primary-color, #2196f3);
        color: var(--text-primary-color, #fff);
        border: none;
        border-radius: 16px;
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .lock-all-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      .engine-badge {
        display: inline-flex;
        align-items: center;
        font-size: 0.68rem;
        font-weight: 600;
        padding: 1px 7px;
        border-radius: 9999px;
        margin-left: 8px;
        letter-spacing: 0.02em;
        vertical-align: middle;
      }
      .engine-badge.native {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }

      /* Restrictions Section */
      .restrictions-section {
        margin-bottom: 20px;
      }
      .restrictions-grid {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .restriction-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--secondary-background-color, rgba(255, 255, 255, 0.05));
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .restriction-pill:hover {
        border-color: var(--primary-color, #2196f3);
      }
      .restriction-pill.active {
        background: rgba(var(--rgb-error-color, 244, 67, 54), 0.12);
        border-color: rgba(var(--rgb-error-color, 244, 67, 54), 0.4);
      }
      .restriction-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--secondary-text-color, #757575);
      }
      .restriction-dot.active {
        background: var(--error-color, #f44336);
        box-shadow: 0 0 6px var(--error-color, #f44336);
      }
      .restriction-title {
        font-weight: 500;
      }
      .restriction-status {
        font-size: 11px;
        color: var(--secondary-text-color, #757575);
      }
      .restriction-status.active {
        color: var(--error-color, #f44336);
        font-weight: 600;
      }

      /* Hero Screens Section */
      .doors-section {
        margin-bottom: 24px;
      }
      .section-label-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .section-label-text {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--secondary-text-color, #757575);
      }
      .slots-badge-counter {
        font-size: 12px;
        font-weight: 500;
        color: var(--secondary-text-color, #757575);
      }
      .slots-badge-counter .divider {
        margin: 0 2px;
      }
      .doors-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 12px;
      }
      .door-card {
        background-color: var(
          --secondary-background-color,
          rgba(255, 255, 255, 0.05)
        );
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
        border-radius: var(--ha-card-border-radius, 12px);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        transition: all 0.25s ease;
        position: relative;
        overflow: hidden;
      }
      .door-card.unlocked {
        border-left: 4px solid var(--success-color, #4caf50);
      }
      .door-card.locked {
        border-left: 4px solid var(--warning-color, #ff9800);
        background-color: rgba(var(--rgb-warning-color, 255, 152, 0), 0.04);
      }
      .door-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .door-icon-wrapper {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--secondary-background-color, #eee);
        color: var(--secondary-text-color, #757575);
        flex-shrink: 0;
      }
      .door-icon-wrapper.unlocked {
        background-color: rgba(var(--rgb-success-color, 76, 175, 80), 0.15);
        color: var(--success-color, #4caf50);
      }
      .door-icon-wrapper.locked {
        background-color: rgba(var(--rgb-warning-color, 255, 152, 0), 0.15);
        color: var(--warning-color, #ff9800);
      }
      .door-icon-wrapper.powered {
        box-shadow: 0 0 10px rgba(var(--rgb-primary-color, 33, 150, 243), 0.4);
      }
      .door-title-wrapper {
        flex: 1;
        min-width: 0;
      }
      .door-name {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .door-time {
        font-size: 12px;
        color: var(--secondary-text-color, #757575);
        margin-top: 2px;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .battery-pill {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 12px;
        background-color: var(--secondary-background-color, #eee);
      }
      .battery-pill.good {
        color: var(--success-color, #4caf50);
        background-color: rgba(var(--rgb-success-color, 76, 175, 80), 0.12);
      }
      .battery-pill.warning {
        color: var(--warning-color, #ff9800);
        background-color: rgba(var(--rgb-warning-color, 255, 152, 0), 0.12);
      }
      .battery-pill.critical {
        color: var(--error-color, #f44336);
        background-color: rgba(var(--rgb-error-color, 244, 67, 54), 0.15);
        animation: pulseWarning 1.5s infinite;
      }

      /* Device Telemetry & App Row */
      .device-telemetry-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .app-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.12);
        color: var(--primary-color, #2196f3);
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        width: fit-content;
      }
      .progress-bar-bg {
        width: 100%;
        height: 6px;
        background: var(--divider-color, rgba(255, 255, 255, 0.1));
        border-radius: 3px;
        overflow: hidden;
      }
      .progress-bar-fill {
        height: 100%;
        background: var(--primary-color, #2196f3);
        border-radius: 3px;
        transition: width 0.3s ease;
      }
      .progress-bar-fill.over {
        background: var(--error-color, #f44336);
      }

      /* Action Row */
      .door-action-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .door-toggle-btn {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 16px;
        border-radius: 10px;
        border: 1px solid var(--divider-color, #e0e0e0);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-align: left;
        background-color: var(--card-background-color, #fff);
        color: var(--primary-text-color);
      }
      .door-toggle-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
      }
      .door-toggle-btn.btn-locked {
        border-color: rgba(var(--rgb-success-color, 76, 175, 80), 0.4);
      }
      .door-toggle-btn.btn-locked .btn-icon {
        color: var(--success-color, #4caf50);
        background-color: rgba(var(--rgb-success-color, 76, 175, 80), 0.12);
      }
      .door-toggle-btn.btn-unlocked {
        border-color: rgba(var(--rgb-warning-color, 255, 152, 0), 0.4);
        background-color: rgba(var(--rgb-warning-color, 255, 152, 0), 0.06);
      }
      .door-toggle-btn.btn-unlocked .btn-icon {
        color: var(--warning-color, #ff9800);
        background-color: rgba(var(--rgb-warning-color, 255, 152, 0), 0.15);
      }
      .btn-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .btn-text {
        display: flex;
        flex-direction: column;
      }
      .btn-action-label {
        font-size: 14px;
        font-weight: 600;
      }
      .btn-sub-label {
        font-size: 11px;
        color: var(--secondary-text-color, #757575);
      }

      /* 24-Hour Activity & Timeline Section */
      .activity-section {
        margin-bottom: 24px;
        background-color: var(
          --secondary-background-color,
          rgba(255, 255, 255, 0.03)
        );
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
        border-radius: var(--ha-card-border-radius, 12px);
        padding: 16px;
      }
      .activity-title-group {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .activity-icon-header {
        display: flex;
        align-items: center;
        color: var(--primary-color, #2196f3);
      }
      .timeline-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .feed-refresh-btn {
        background: transparent;
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.15));
        color: var(--secondary-text-color, #757575);
        cursor: pointer;
        padding: 4px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s;
      }
      .feed-refresh-btn:hover {
        color: var(--primary-color, #2196f3);
        border-color: var(--primary-color, #2196f3);
        background-color: rgba(var(--rgb-primary-color, 33, 150, 243), 0.08);
      }
      .feed-refresh-btn.spinning {
        animation: spin 1s linear infinite;
      }
      .timeline-filter-pills {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .filter-pill {
        background-color: transparent;
        border: 1px solid var(--divider-color, #e0e0e0);
        color: var(--secondary-text-color, #757575);
        border-radius: 12px;
        padding: 3px 10px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      .filter-pill:hover {
        background-color: rgba(var(--rgb-primary-color, 33, 150, 243), 0.08);
      }
      .filter-pill.active {
        background-color: var(--primary-color, #2196f3);
        color: var(--text-primary-color, #fff);
        border-color: var(--primary-color, #2196f3);
      }
      .timeline-bar-wrapper {
        margin-top: 14px;
      }
      .activity-bars-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .timeline-device-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .timeline-device-meta {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
      }
      .timeline-device-name {
        font-weight: 500;
      }
      .timeline-device-time {
        color: var(--secondary-text-color, #757575);
      }
      .timeline-bar {
        height: 14px;
        width: 100%;
        border-radius: 6px;
        overflow: hidden;
        display: flex;
        background-color: var(--divider-color, rgba(255, 255, 255, 0.1));
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
      }
      .timeline-segment {
        height: 100%;
        transition: width 0.3s ease;
      }
      .timeline-segment.unlocked {
        background-color: var(--primary-color, #2196f3);
      }
      .timeline-segment.locked {
        background-color: var(--warning-color, #ff9800);
      }
      .timeline-segment.over {
        background-color: var(--error-color, #f44336);
      }
      .timeline-axis {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: var(--secondary-text-color, #757575);
        margin-top: 6px;
      }

      /* Collapsible Recent Activity Expander Bar */
      .activity-expand-bar {
        margin-top: 14px;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
        background-color: rgba(255, 255, 255, 0.02);
        color: var(--primary-text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
      }
      .activity-expand-bar:hover {
        background-color: rgba(var(--rgb-primary-color, 33, 150, 243), 0.08);
        border-color: var(--primary-color, #2196f3);
      }
      .activity-expand-bar.open {
        border-color: var(--primary-color, #2196f3);
        background-color: rgba(var(--rgb-primary-color, 33, 150, 243), 0.05);
      }
      .expand-bar-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .expand-chevron {
        color: var(--primary-color, #2196f3);
        display: flex;
        align-items: center;
      }
      .expand-hint {
        font-size: 11px;
        color: var(--secondary-text-color, #757575);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      /* Event Feed Container */
      .event-feed-container {
        margin-top: 12px;
        border-top: 1px solid var(--divider-color, rgba(255, 255, 255, 0.08));
        padding-top: 12px;
      }
      .event-list-scrollable {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 380px;
        overflow-y: auto;
        padding-right: 4px;
      }
      .event-list-scrollable::-webkit-scrollbar {
        width: 4px;
      }
      .event-list-scrollable::-webkit-scrollbar-thumb {
        background-color: var(--divider-color, rgba(255, 255, 255, 0.2));
        border-radius: 4px;
      }
      .event-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        background-color: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.06));
        transition: all 0.2s;
      }
      .event-row:hover {
        background-color: rgba(var(--rgb-primary-color, 33, 150, 243), 0.04);
        border-color: rgba(var(--rgb-primary-color, 33, 150, 243), 0.2);
      }
      .event-icon-box {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .event-icon-box.locked {
        background-color: rgba(var(--rgb-success-color, 76, 175, 80), 0.15);
        color: var(--success-color, #4caf50);
      }
      .event-icon-box.unlocked {
        background-color: rgba(var(--rgb-warning-color, 255, 152, 0), 0.15);
        color: var(--warning-color, #ff9800);
      }
      .event-icon-box.info {
        background-color: rgba(var(--rgb-primary-color, 33, 150, 243), 0.15);
        color: var(--primary-color, #2196f3);
      }
      .event-icon-box.timer {
        background-color: rgba(var(--rgb-warning-color, 255, 152, 0), 0.2);
        color: var(--warning-color, #ff9800);
      }
      .event-details {
        flex: 1;
        min-width: 0;
      }
      .event-top-line {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 2px;
      }
      .event-door-badge {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        background-color: var(--secondary-background-color, #eee);
        color: var(--primary-text-color);
      }
      .event-action {
        font-size: 13px;
        font-weight: 600;
      }
      .event-action.locked {
        color: var(--success-color, #4caf50);
      }
      .event-action.unlocked {
        color: var(--warning-color, #ff9800);
      }
      .event-action.info {
        color: var(--primary-color, #2196f3);
      }
      .event-action.timer {
        color: var(--warning-color, #ff9800);
      }
      .event-sub-line {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .event-actor {
        font-size: 12px;
        color: var(--secondary-text-color, #757575);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .event-time-box {
        text-align: right;
        flex-shrink: 0;
      }
      .event-time-clock {
        font-size: 12px;
        font-weight: 600;
        display: block;
      }
      .event-time-rel {
        font-size: 10px;
        color: var(--secondary-text-color, #757575);
        display: block;
        margin-top: 2px;
      }
      .empty-feed {
        font-size: 12px;
        color: var(--secondary-text-color, #757575);
        font-style: italic;
        padding: 8px 0;
        text-align: center;
      }

      /* Edit View Styles */
      .edit-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }
      .back-button {
        display: flex;
        align-items: center;
        gap: 8px;
        background: none;
        border: none;
        color: var(--primary-text-color);
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        padding: 8px 8px 8px 0;
        transition: opacity 0.2s;
      }
      .back-button:hover {
        opacity: 0.7;
      }
      .edit-header-right {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .edit-title {
        margin: 0;
        font-size: 20px;
        font-weight: 500;
      }
      .edit-status {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .edit-status.success {
        color: var(--success-color, #4caf50);
      }
      .edit-status.warning {
        color: var(--warning-color, #ff9800);
      }
      .error-banner {
        background: rgba(var(--rgb-error-color, 244, 67, 54), 0.15);
        color: var(--error-color, #f44336);
        border: 1px solid rgba(var(--rgb-error-color, 244, 67, 54), 0.3);
        padding: 8px 12px;
        border-radius: 8px;
        margin-bottom: 12px;
        font-size: 13px;
      }
      .timer-live-banner {
        background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.12);
        border: 1px solid rgba(var(--rgb-primary-color, 33, 150, 243), 0.35);
        padding: 10px 14px;
        border-radius: 8px;
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .edit-body {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .input-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .input-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--primary-color, #2196f3);
        margin-left: 4px;
      }
      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      .icon-absolute {
        position: absolute;
        left: 12px;
        color: var(--secondary-text-color, #757575);
        display: flex;
        z-index: 1;
      }
      .custom-input {
        width: 100%;
        background-color: var(--secondary-background-color, #f5f5f5);
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, #bdbdbd);
        border-radius: var(--ha-card-border-radius, 12px);
        padding: 14px 16px 14px 44px;
        font-size: 15px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s, background-color 0.2s;
      }
      .custom-input:focus {
        border-color: var(--primary-color, #2196f3);
        background-color: var(--card-background-color, #fff);
      }
      .time-input {
        padding-left: 16px;
      }
      .custom-select {
        width: 100%;
        background-color: var(--secondary-background-color, #f5f5f5);
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, #bdbdbd);
        border-radius: var(--ha-card-border-radius, 12px);
        padding: 14px 16px;
        font-size: 15px;
        outline: none;
        box-sizing: border-box;
      }
      .icon-button {
        background: transparent;
        border: 1px solid var(--divider-color);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--secondary-text-color);
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
      }
      .icon-button:hover {
        background-color: var(--secondary-background-color);
        color: var(--primary-color);
      }
      .icon-button.active {
        color: var(--primary-color, #2196f3);
        border-color: var(--primary-color, #2196f3);
      }
      .icon-box.active.circle {
        border-radius: 50%;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(var(--rgb-primary-color, 33, 150, 243), 0.12);
        color: var(--primary-color, #2196f3);
      }

      /* Settings Toggles List */
      .settings-list {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: var(--ha-card-border-radius, 12px);
        overflow: hidden;
      }
      .toggle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background-color: var(--card-background-color, #fff);
        cursor: pointer;
        border-bottom: 1px solid var(--divider-color, #eee);
        transition: background-color 0.2s;
      }
      .toggle-row.no-border {
        border-bottom: none;
      }
      .toggle-row.no-pad {
        padding-left: 0;
        padding-right: 0;
      }
      .toggle-info {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .toggle-title {
        font-size: 15px;
        color: var(--primary-text-color);
        font-weight: 500;
      }
      .toggle-desc {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .toggle-switch {
        width: 52px;
        height: 32px;
        background-color: var(--switch-unchecked-track-color, #e7e0ec);
        border: 2px solid var(--switch-unchecked-button-color, #79747e);
        border-radius: 16px;
        position: relative;
        transition: background-color 0.2s ease, border-color 0.2s ease;
        box-sizing: border-box;
      }
      .toggle-switch.active {
        background-color: var(
          --switch-checked-track-color,
          var(--primary-color, #6750a4)
        );
        border-color: var(
          --switch-checked-track-color,
          var(--primary-color, #6750a4)
        );
      }
      .toggle-knob {
        width: 16px;
        height: 16px;
        background-color: var(--switch-unchecked-button-color, #79747e);
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 6px;
        transform: translateY(-50%);
        transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
      }
      .toggle-knob.active {
        width: 24px;
        height: 24px;
        background-color: var(--switch-checked-button-color, #ffffff);
        left: calc(100% - 24px - 2px);
      }

      /* Sections & Accordions */
      .section {
        background-color: var(--card-background-color, #fff);
        border-radius: var(--ha-card-border-radius, 12px);
        border: 1px solid var(--divider-color, #e0e0e0);
        overflow: hidden;
      }
      .section-header {
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        background-color: var(--secondary-background-color, #fafafa);
        border-bottom: 1px solid transparent;
      }
      .section-header:hover {
        background-color: var(--secondary-background-color, #eee);
      }
      .section-header.open {
        border-bottom-color: var(--divider-color, #e0e0e0);
      }
      .section-title {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      .section-chevron {
        color: var(--secondary-text-color);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .section-content-wrapper {
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .section-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .inline-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .day-chips {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .day-chip {
        flex: 1;
        aspect-ratio: 1;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        background-color: var(--secondary-background-color, #f5f5f5);
        color: var(--secondary-text-color, #757575);
        border: 1px solid var(--divider-color, #bdbdbd);
        transition: all 0.2s;
      }
      .day-chip.selected {
        background-color: var(--primary-color, #2196f3);
        color: var(--on-primary-color, #fff);
        border-color: var(--primary-color, #2196f3);
      }

      /* Metric Container */
      .metric-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .metric-header {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
      }
      .metric-value {
        font-weight: 600;
        color: var(--primary-color, #2196f3);
      }
      .app-chip-list {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .app-badge {
        background: var(--secondary-background-color, rgba(255, 255, 255, 0.06));
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
      }

      /* Buttons & Footer Actions */
      .footer-actions {
        padding: 16px 0 8px 0;
        display: flex;
        gap: 16px;
      }
      .button-primary,
      .button-danger,
      .button-outline {
        padding: 10px 24px;
        border-radius: 24px;
        font-weight: 500;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        flex: 1;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: all 0.2s;
      }
      .button-primary {
        background-color: var(--primary-color, #2196f3);
        color: var(--text-primary-color, #fff);
        border: none;
        box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.2),
          0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12);
      }
      .button-primary:hover {
        box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14),
          0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
      }
      .button-danger {
        background-color: transparent;
        color: var(--error-color, #f44336);
        border: 1px solid var(--error-color, #f44336);
      }
      .button-danger:hover {
        background-color: rgba(var(--rgb-error-color, 244, 67, 54), 0.1);
      }
      .button-outline {
        background-color: transparent;
        color: var(--primary-color, #2196f3);
        border: 1px solid var(--divider-color, #e0e0e0);
      }
      .button-outline:hover {
        background-color: rgba(var(--rgb-primary-color, 33, 150, 243), 0.1);
      }

      /* Keyframes */
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes pulseWarning {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.8;
          transform: scale(0.98);
        }
      }
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `;
  }
}

// ===========================================================================
// VISUAL CONFIG EDITOR (PassableLockManagerCardEditor Parity)
// ===========================================================================
class PassableScreenTimeCardEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _expandedSections: { state: true },
  };

  constructor() {
    super();
    this._expandedSections = {
      header: true,
      features: true,
    };
  }

  setConfig(config) {
    this._config = config;
  }

  _fireConfigChange() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _toggleSection(section, ev) {
    if (ev) ev.stopPropagation();
    this._expandedSections = {
      ...this._expandedSections,
      [section]: !this._expandedSections[section],
    };
    this.requestUpdate();
  }

  _updateConfigValue(key, value) {
    if (!this._config) return;
    const newConfig = { ...this._config };
    if (value === undefined || value === "" || value === null) {
      delete newConfig[key];
    } else {
      newConfig[key] = value;
    }
    this._config = newConfig;
    this._fireConfigChange();
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
      }
      .editor-container {
        padding: 4px 0;
        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .editor-section {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        overflow: hidden;
        background-color: var(--card-background-color, #fff);
      }
      .editor-section-header {
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;
        background-color: var(--secondary-background-color, #f5f5f5);
      }
      .editor-section-header.open {
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }
      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
      }
      .section-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `;
  }

  render() {
    if (!this.hass || !this._config) return html``;

    return html`
      <div class="editor-container">
        <!-- 1. Header & Title -->
        <div class="editor-section">
          <div
            class="editor-section-header ${this._expandedSections.header ? 'open' : ''}"
            @click=${(ev) => this._toggleSection('header', ev)}
          >
            <div class="section-title">
              <ha-icon
                icon="${this._expandedSections.header ? 'mdi:chevron-down' : 'mdi:chevron-right'}"
              ></ha-icon>
              <span>Card Header & Titles</span>
            </div>
          </div>
          <div
            class="section-body"
            style="display: ${this._expandedSections.header ? 'flex' : 'none'};"
          >
            <ha-selector
              .hass=${this.hass}
              .selector=${{ text: {} }}
              .value=${this._config.title || "Screen Time & Device Access"}
              .label=${"Card Title"}
              @value-changed=${(e) => this._updateConfigValue("title", e.detail.value)}
            ></ha-selector>

            <ha-selector
              .hass=${this.hass}
              .selector=${{ text: {} }}
              .value=${this._config.subtitle || "Smart Screen Time Command Center"}
              .label=${"Card Subtitle"}
              @value-changed=${(e) => this._updateConfigValue("subtitle", e.detail.value)}
            ></ha-selector>
          </div>
        </div>

        <!-- 2. Controls & Activity Features -->
        <div class="editor-section">
          <div
            class="editor-section-header ${this._expandedSections.features ? 'open' : ''}"
            @click=${(ev) => this._toggleSection('features', ev)}
          >
            <div class="section-title">
              <ha-icon
                icon="${this._expandedSections.features ? 'mdi:chevron-down' : 'mdi:chevron-right'}"
              ></ha-icon>
              <span>Controls & Timeline Display</span>
            </div>
          </div>
          <div
            class="section-body"
            style="display: ${this._expandedSections.features ? 'flex' : 'none'};"
          >
            <ha-selector
              .hass=${this.hass}
              .selector=${{ boolean: {} }}
              .value=${this._config.show_lock_all !== false}
              .label=${"Show 'Lock All' Quick Action Button"}
              @value-changed=${(e) => this._updateConfigValue("show_lock_all", e.detail.value)}
            ></ha-selector>

            <ha-selector
              .hass=${this.hass}
              .selector=${{ boolean: {} }}
              .value=${this._config.show_timeline !== false}
              .label=${"Show 24-Hour Screen Time Activity Section"}
              @value-changed=${(e) => this._updateConfigValue("show_timeline", e.detail.value)}
            ></ha-selector>

            <ha-selector
              .hass=${this.hass}
              .selector=${{ boolean: {} }}
              .value=${Boolean(this._config.default_expand_activity)}
              .label=${"Expand Activity Log by Default"}
              @value-changed=${(e) => this._updateConfigValue("default_expand_activity", e.detail.value)}
            ></ha-selector>
          </div>
        </div>
      </div>
    `;
  }
}

// ===========================================================================
// ELEMENT DEFINITIONS & CUSTOM CARDS REGISTRATION
// ===========================================================================
if (!customElements.get("passable-screen-time-card")) {
  customElements.define("passable-screen-time-card", PassableScreenTimeCard);
}
if (!customElements.get("passable-device-lockout-card")) {
  customElements.define("passable-device-lockout-card", PassableScreenTimeCard);
}
if (!customElements.get("passable-screen-time-card-editor")) {
  customElements.define("passable-screen-time-card-editor", PassableScreenTimeCardEditor);
}

window.customCards = window.customCards || [];
const cardEntry = {
  type: "passable-screen-time-card",
  name: "Passable Screen Time Card",
  preview: true,
  description: "Screen time monitor, viewing timer, and access schedule card mirroring the Smart Lock Engine.",
};

const existingIndex = window.customCards.findIndex(
  (c) => c.type === "passable-screen-time-card"
);
if (existingIndex >= 0) {
  window.customCards[existingIndex] = cardEntry;
} else {
  window.customCards.push(cardEntry);
}
