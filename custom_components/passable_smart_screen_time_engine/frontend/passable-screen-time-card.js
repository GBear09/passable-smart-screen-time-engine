/**
 * Passable Smart Screen Time Engine Card
 * Part of the Passable Suite by GBear09
 * https://github.com/GBear09/passable-smart-screen-time-engine
 */

const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace") || customElements.get("hc-main")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

console.info(
  "%c PASSABLE-SCREEN-TIME-CARD %c v1.0.0 ",
  "color: white; background: #0284c7; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #0284c7; background: #e0f2fe; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);

// --- ICONS (SVG) ---
const Icons = {
  Lock: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>`,
  Unlock: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>`,
  Tv: html`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`,
  Tablet: html`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>`,
  Clock: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>`,
  Hourglass: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>`,
  Calendar: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
  Power: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`,
  Play: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
  Save: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`,
  Trash: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`,
  ChevronDown: html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  ArrowLeft: html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
  Sparkles: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>`,
};

class PassableScreenTimeCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _backendData: { state: true },
      _editingDeviceId: { state: true },
      _openSections: { state: true },
      _localSchedEnabled: { state: true },
      _localSchedDays: { state: true },
      _localSchedStart: { state: true },
      _localSchedEnd: { state: true },
      _localSchedRecurrence: { state: true },
      _localSchedAnchorDate: { state: true },
      _localTimerDuration: { state: true },
      _localTimerUnit: { state: true },
    };
  }

  constructor() {
    super();
    this._backendData = { devices: {}, global_restrictions: [] };
    this._editingDeviceId = null;
    this._openSections = { activity: true, timer: true, schedule: false };
    this._fullDaysList = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    this._shortDaysList = ["S", "M", "T", "W", "T", "F", "S"];
    this._localTimerDuration = 20;
    this._localTimerUnit = "minutes";
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this.config = config;
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
      const res = await this.hass.callWS({
        type: "passable_smart_screen_time_engine/get_data",
      });
      if (res) {
        this._backendData = res;
        this.requestUpdate();
      }
    } catch (e) {
      // Integration may still be loading or using legacy fallback
    }
  }

  _toggleSection(key) {
    this._openSections = {
      ...this._openSections,
      [key]: !this._openSections[key],
    };
  }

  _formatRemaining(expiresAtStr) {
    if (!expiresAtStr) return "";
    const ms = new Date(expiresAtStr).getTime() - Date.now();
    if (ms <= 0) return "Expiring...";
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m remaining`;
    }
    return `${mins}m ${secs.toString().padStart(2, "0")}s remaining`;
  }

  _formatMins(mins) {
    if (!mins || mins <= 0) return "0m";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // --- ACTIONS ---

  async _setLockout(deviceId, locked, powerOn = false) {
    await this.hass.callWS({
      type: "passable_smart_screen_time_engine/set_lockout",
      device_id: deviceId,
      locked: locked,
      power_on: powerOn,
    });
    this._fetchData();
  }

  async _startTimer(deviceId) {
    await this.hass.callWS({
      type: "passable_smart_screen_time_engine/start_timer",
      device_id: deviceId,
      duration: parseFloat(this._localTimerDuration) || 20,
      unit: this._localTimerUnit || "minutes",
    });
    this._fetchData();
  }

  async _cancelTimer(deviceId) {
    await this.hass.callWS({
      type: "passable_smart_screen_time_engine/cancel_timer",
      device_id: deviceId,
    });
    this._fetchData();
  }

  async _saveSchedule(deviceId) {
    await this.hass.callWS({
      type: "passable_smart_screen_time_engine/save_device",
      device_id: deviceId,
      schedule_enabled: Boolean(this._localSchedEnabled),
      schedule_days: this._localSchedDays || this._fullDaysList,
      schedule_start: this._localSchedStart || "08:00",
      schedule_end: this._localSchedEnd || "20:00",
      schedule_recurrence: this._localSchedRecurrence || "weekly",
      schedule_anchor_date: this._localSchedAnchorDate,
    });
    this._fetchData();
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

  _openEdit(deviceId) {
    const dev = this._backendData.devices[deviceId] || {};
    this._editingDeviceId = deviceId;
    this._localSchedEnabled = dev.schedule_enabled ?? true;
    this._localSchedDays = dev.schedule_days ? [...dev.schedule_days] : [...this._fullDaysList];
    this._localSchedStart = dev.schedule_start || "08:00";
    this._localSchedEnd = dev.schedule_end || "20:00";
    this._localSchedRecurrence = dev.schedule_recurrence || "weekly";
    this._localSchedAnchorDate = dev.schedule_anchor_date || null;
    this._localTimerDuration = dev.timer_duration || 20;
    this._localTimerUnit = dev.timer_unit || "minutes";
  }

  _closeEdit() {
    this._editingDeviceId = null;
  }

  _toggleDevicePower(targetEntity, isSwitch) {
    if (!this.hass || !targetEntity) return;
    if (isSwitch) {
      this.hass.callService("switch", "toggle", { entity_id: targetEntity });
    } else {
      this.hass.callService("media_player", "toggle", { entity_id: targetEntity });
    }
  }

  render() {
    if (!this.hass) return html``;

    return html`
      <ha-card class="container">
        ${this._editingDeviceId
          ? this._renderEditView()
          : this._renderGridView()}
      </ha-card>
    `;
  }

  // =========================================================================
  // MAIN VIEW (TILES & RESTRICTIONS)
  // =========================================================================

  _renderGridView() {
    const devices = this._backendData.devices || {};
    const devKeys = Object.keys(devices);
    const restrictions = this._backendData.global_restrictions || [];

    return html`
      <div class="view fade-in">
        <!-- HEADER -->
        <div class="card-header">
          <div>
            <h1 class="card-title">${this.config.title || "Screen Time & Device Access"}</h1>
            <p class="card-subtitle">${this.config.subtitle || "Smart Screen Time & Downtime Engine"}</p>
          </div>
        </div>

        <!-- GLOBAL RESTRICTIONS -->
        ${restrictions.length > 0
          ? html`
              <div class="restrictions-container">
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
                      <span class="restriction-status">${isOn ? "Active" : "Off"}</span>
                    </div>
                  `;
                })}
              </div>
            `
          : ""}

        <!-- DEVICE TILES -->
        <div class="tiles-grid">
          ${devKeys.map((did) => {
            const dev = devices[did];
            const isSwitch = dev.device_type === "network_switch";
            const targetState = this.hass.states[dev.target_entity];
            const isPowerOn = isSwitch
              ? targetState && targetState.state === "off" // unpaused
              : targetState && ["on", "playing", "idle"].includes(targetState.state);
            const isLocked = dev.locked;
            const timerActive = dev.timer_expires_at && new Date(dev.timer_expires_at).getTime() > Date.now();

            return html`
              <div class="device-tile ${isLocked ? 'locked' : 'unlocked'}" @click=${() => this._openEdit(did)}>
                <div class="tile-header">
                  <div class="icon-circle ${isPowerOn ? 'active' : ''}">
                    ${isSwitch ? Icons.Tablet : Icons.Tv}
                  </div>
                  <div class="status-chip ${isLocked ? 'locked' : 'unlocked'}">
                    ${isLocked ? Icons.Lock : Icons.Unlock}
                    <span>${isLocked ? "Locked" : "Unlocked"}</span>
                  </div>
                </div>

                <div class="tile-body">
                  <h3 class="device-name">${dev.name}</h3>
                  <div class="telemetry-row">
                    <span class="metric-pill">
                      ${Icons.Clock} ${this._formatMins(dev.screen_time_today_minutes)}
                    </span>
                    ${dev.active_app && dev.active_app !== "None"
                      ? html`<span class="app-pill">${dev.active_app}</span>`
                      : ""}
                  </div>

                  ${timerActive
                    ? html`
                        <div class="timer-badge pulsing">
                          ${Icons.Hourglass} ${this._formatRemaining(dev.timer_expires_at)}
                        </div>
                      `
                    : ""}
                </div>

                <div class="tile-actions" @click=${(e) => e.stopPropagation()}>
                  <button
                    class="action-btn ${isPowerOn ? 'active' : ''}"
                    title="Toggle Power / Pause"
                    @click=${() => this._toggleDevicePower(dev.target_entity, isSwitch)}
                  >
                    ${Icons.Power}
                  </button>
                  <button
                    class="action-btn ${isLocked ? 'warn' : ''}"
                    title="Toggle Lockout"
                    @click=${() => this._setLockout(did, !isLocked, !isLocked ? false : true)}
                  >
                    ${isLocked ? Icons.Unlock : Icons.Lock}
                  </button>
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // DETAIL VIEW (EDIT ACCORDION)
  // =========================================================================

  _renderEditView() {
    const dev = this._backendData.devices[this._editingDeviceId];
    if (!dev) return html``;

    const isSwitch = dev.device_type === "network_switch";
    const targetState = this.hass.states[dev.target_entity];
    const isPowerOn = isSwitch
      ? targetState && targetState.state === "off"
      : targetState && ["on", "playing", "idle"].includes(targetState.state);
    const isLocked = dev.locked;
    const timerActive = dev.timer_expires_at && new Date(dev.timer_expires_at).getTime() > Date.now();
    const limitMins = dev.daily_limit_minutes || 120;
    const pct = Math.min(100, Math.round(((dev.screen_time_today_minutes || 0) / limitMins) * 100));

    return html`
      <div class="view fade-in">
        <!-- HEADER -->
        <div class="edit-header">
          <button class="back-btn" @click=${this._closeEdit}>
            ${Icons.ArrowLeft} <span>Back</span>
          </button>
          <div class="edit-header-right">
            <div class="icon-circle ${isPowerOn ? 'active' : ''}">
              ${isSwitch ? Icons.Tablet : Icons.Tv}
            </div>
            <div>
              <h2 class="edit-title">${dev.name}</h2>
              <span class="status-chip ${isLocked ? 'locked' : 'unlocked'}">
                ${isLocked ? "Locked" : "Unlocked"}
              </span>
            </div>
          </div>
        </div>

        <div class="edit-body">
          <!-- QUICK CONTROLS -->
          <div class="quick-controls-card">
            <div class="toggle-row" @click=${() => this._setLockout(this._editingDeviceId, !isLocked)}>
              <div class="toggle-info">
                <span class="${isLocked ? 'coral' : 'teal'}">${isLocked ? Icons.Lock : Icons.Unlock}</span>
                <div>
                  <div class="toggle-title">Device Locked</div>
                  <div class="toggle-desc">Manual override to immediately restrict or permit usage</div>
                </div>
              </div>
              <div class="toggle-switch ${isLocked ? 'active' : ''}">
                <div class="toggle-knob ${isLocked ? 'active' : ''}"></div>
              </div>
            </div>

            <div class="toggle-row no-border" @click=${() => this._toggleDevicePower(dev.target_entity, isSwitch)}>
              <div class="toggle-info">
                <span class="${isPowerOn ? 'teal' : ''}">${Icons.Power}</span>
                <div>
                  <div class="toggle-title">${isSwitch ? "Wi-Fi Access Active" : "Power State"}</div>
                  <div class="toggle-desc">${isPowerOn ? "Device is currently powered on / unpaused" : "Device is currently off / paused"}</div>
                </div>
              </div>
              <div class="toggle-switch ${isPowerOn ? 'active' : ''}">
                <div class="toggle-knob ${isPowerOn ? 'active' : ''}"></div>
              </div>
            </div>
          </div>

          <!-- 1. ACTIVITY & SCREEN TIME SECTION -->
          ${this._renderSection(
            "activity",
            "Screen Time & Activity",
            Icons.Sparkles,
            html`
              <div class="metric-container">
                <div class="metric-header">
                  <span class="metric-label">Today's Usage</span>
                  <span class="metric-value">${this._formatMins(dev.screen_time_today_minutes)} / ${this._formatMins(limitMins)} limit</span>
                </div>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill ${pct >= 100 ? 'over' : ''}" style="width: ${pct}%"></div>
                </div>
              </div>

              ${dev.apps_used_today && dev.apps_used_today.length > 0
                ? html`
                    <div style="margin-top: 14px;">
                      <label class="input-label" style="margin-bottom: 8px; display: block;">Apps Used Today</label>
                      <div class="app-chip-list">
                        ${dev.apps_used_today.map(
                          (app) => html`<span class="app-badge">▶ ${app}</span>`
                        )}
                      </div>
                    </div>
                  `
                : html`<div class="empty-state">No streaming apps used yet today.</div>`}
            `
          )}

          <!-- 2. TIMER SECTION ("One More Show") -->
          ${this._renderSection(
            "timer",
            "Viewing Timer (One More Show)",
            Icons.Clock,
            html`
              ${timerActive
                ? html`
                    <div class="active-timer-box">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="teal">${Icons.Hourglass}</span>
                        <div>
                          <div style="font-weight: 600; font-size: 13px;">Active Countdown</div>
                          <div style="font-size: 12px; color: var(--secondary-text-color);">
                            ${this._formatRemaining(dev.timer_expires_at)}
                          </div>
                        </div>
                      </div>
                      <button class="cancel-timer-btn" @click=${() => this._cancelTimer(this._editingDeviceId)}>
                        Cancel
                      </button>
                    </div>
                  `
                : ""}

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
                        class="pill-btn ${this._localTimerDuration === p.val && this._localTimerUnit === p.unit ? 'selected' : ''}"
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

              <div style="margin-top: 16px;">
                <button
                  class="primary-btn"
                  @click=${() => this._startTimer(this._editingDeviceId)}
                >
                  ${Icons.Play}
                  <span style="margin-left: 8px;">
                    ${timerActive ? "Restart Timer & Unlock" : "Start Timer & Unlock Device"}
                  </span>
                </button>
              </div>
            `
          )}

          <!-- 3. SCHEDULE SECTION (Smart Lock Parity) -->
          ${this._renderSection(
            "schedule",
            "Downtime Schedule",
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
                    class="recurrence-btn ${this._localSchedRecurrence !== 'biweekly' ? 'active' : ''}"
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
                    class="recurrence-btn ${this._localSchedRecurrence === 'biweekly' ? 'active' : ''}"
                    ?disabled=${!this._localSchedEnabled}
                    @click=${() => {
                      this._localSchedRecurrence = "biweekly";
                      this.requestUpdate();
                    }}
                  >
                    Every 2 Weeks
                  </button>
                </div>
              </div>

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
                  <label class="input-label">Start Time</label>
                  <input
                    type="time"
                    class="custom-input"
                    .value=${(this._localSchedStart || "08:00").slice(0, 5)}
                    @change=${(e) => (this._localSchedStart = e.target.value)}
                    ?disabled=${!this._localSchedEnabled}
                  />
                </div>
                <div class="input-group">
                  <label class="input-label">End Time</label>
                  <input
                    type="time"
                    class="custom-input"
                    .value=${(this._localSchedEnd || "20:00").slice(0, 5)}
                    @change=${(e) => (this._localSchedEnd = e.target.value)}
                    ?disabled=${!this._localSchedEnabled}
                  />
                </div>
              </div>

              <div class="footer-actions">
                <button
                  class="outline-danger-btn"
                  @click=${() => {
                    this._localSchedDays = [];
                    this.requestUpdate();
                  }}
                >
                  ${Icons.Trash} Clear Days
                </button>
                <button
                  class="primary-btn"
                  style="flex: 1;"
                  @click=${() => this._saveSchedule(this._editingDeviceId)}
                >
                  ${Icons.Save} Save Schedule
                </button>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  _renderSection(key, title, icon, content) {
    const isOpen = this._openSections[key] || false;
    return html`
      <div class="section-box">
        <div class="section-header ${isOpen ? 'open' : ''}" @click=${() => this._toggleSection(key)}>
          <div class="section-title">
            <span class="section-icon">${icon}</span>
            <span>${title}</span>
          </div>
          <div class="section-chevron" style="transform: rotate(${isOpen ? '180deg' : '0deg'});">
            ${Icons.ChevronDown}
          </div>
        </div>
        <div class="section-body" style="max-height: ${isOpen ? '1000px' : '0px'}; opacity: ${isOpen ? '1' : '0'};">
          <div class="section-content">${content}</div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // CARD STYLES
  // =========================================================================

  static get styles() {
    return css`
      :host {
        display: block;
      }
      .container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background-color: var(--ha-card-background, #10191c);
        color: var(--primary-text-color, #e1e7ec);
        border-radius: var(--ha-card-border-radius, 12px);
        padding: 16px;
        box-sizing: border-box;
      }
      .card-header {
        margin-bottom: 16px;
      }
      .card-title {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 4px 0;
        color: var(--primary-text-color, #e1e7ec);
      }
      .card-subtitle {
        font-size: 13px;
        margin: 0;
        color: var(--secondary-text-color, #8ca0aa);
      }

      /* RESTRICTIONS */
      .restrictions-container {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .restriction-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .restriction-pill.active {
        background: rgba(244, 67, 54, 0.15);
        border-color: rgba(244, 67, 54, 0.4);
      }
      .restriction-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--secondary-text-color, #757575);
      }
      .restriction-dot.active {
        background: #f44336;
        box-shadow: 0 0 6px #f44336;
      }

      /* TILES GRID */
      .tiles-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
      }
      .device-tile {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 14px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 12px;
        transition: all 0.2s;
      }
      .device-tile:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(65, 189, 245, 0.3);
      }
      .tile-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .icon-circle {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--secondary-text-color, #8ca0aa);
      }
      .icon-circle.active {
        background: rgba(65, 189, 245, 0.15);
        color: #41bdf5;
      }
      .status-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .status-chip.unlocked {
        background: rgba(76, 175, 80, 0.15);
        color: #4caf50;
      }
      .status-chip.locked {
        background: rgba(255, 152, 0, 0.15);
        color: #ff9800;
      }
      .device-name {
        margin: 0 0 6px 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--primary-text-color, #fff);
      }
      .telemetry-row {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .metric-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(255, 255, 255, 0.05);
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        color: #8ca0aa;
      }
      .app-pill {
        background: rgba(65, 189, 245, 0.12);
        color: #41bdf5;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
      }
      .timer-badge {
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(65, 189, 245, 0.15);
        border: 1px solid rgba(65, 189, 245, 0.3);
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        color: #41bdf5;
      }
      .pulsing {
        animation: pulseGlow 2s infinite ease-in-out;
      }
      @keyframes pulseGlow {
        0%, 100% { opacity: 0.85; }
        50% { opacity: 1; border-color: rgba(65, 189, 245, 0.6); }
      }
      .tile-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .action-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--secondary-text-color, #8ca0aa);
        border-radius: 8px;
        padding: 6px 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .action-btn:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .action-btn.active {
        color: #41bdf5;
        border-color: rgba(65, 189, 245, 0.3);
      }
      .action-btn.warn {
        color: #ff9800;
        border-color: rgba(255, 152, 0, 0.3);
      }

      /* EDIT VIEW */
      .edit-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        margin-bottom: 16px;
      }
      .back-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: none;
        color: var(--secondary-text-color, #8ca0aa);
        font-size: 14px;
        cursor: pointer;
        padding: 6px 0;
      }
      .back-btn:hover {
        color: var(--primary-text-color, #fff);
      }
      .edit-header-right {
        display: flex;
        align-items: center;
        gap: 12px;
        text-align: right;
      }
      .edit-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
      }
      .quick-controls-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 14px;
      }
      .toggle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        cursor: pointer;
      }
      .toggle-row.no-border {
        border-bottom: none;
      }
      .toggle-row.no-pad {
        padding: 0;
      }
      .toggle-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .toggle-title {
        font-size: 14px;
        font-weight: 500;
      }
      .toggle-desc {
        font-size: 12px;
        color: var(--secondary-text-color, #8ca0aa);
      }
      .toggle-switch {
        width: 44px;
        height: 24px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        position: relative;
        transition: all 0.2s;
      }
      .toggle-switch.active {
        background: #41bdf5;
      }
      .toggle-knob {
        width: 18px;
        height: 18px;
        background: #fff;
        border-radius: 50%;
        position: absolute;
        top: 3px;
        left: 3px;
        transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
      }
      .toggle-knob.active {
        left: 23px;
      }

      /* ACCORDION BOX */
      .section-box {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 12px;
      }
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.02);
      }
      .section-header.open {
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .section-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 600;
      }
      .section-icon {
        color: #41bdf5;
        display: flex;
      }
      .section-chevron {
        color: var(--secondary-text-color, #8ca0aa);
        transition: transform 0.3s;
      }
      .section-body {
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .section-content {
        padding: 16px;
      }

      /* PROGRESS BAR */
      .metric-header {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        margin-bottom: 8px;
      }
      .metric-value {
        font-weight: 600;
        color: #41bdf5;
      }
      .progress-bar-bg {
        width: 100%;
        height: 8px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        overflow: hidden;
      }
      .progress-bar-fill {
        height: 100%;
        background: #41bdf5;
        border-radius: 4px;
        transition: width 0.3s;
      }
      .progress-bar-fill.over {
        background: #f44336;
      }
      .app-chip-list {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .app-badge {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
      }
      .empty-state {
        font-size: 12px;
        color: var(--secondary-text-color, #8ca0aa);
        font-style: italic;
      }

      /* TIMER */
      .active-timer-box {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(65, 189, 245, 0.12);
        border: 1px solid rgba(65, 189, 245, 0.3);
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 14px;
      }
      .cancel-timer-btn {
        background: transparent;
        border: 1px solid rgba(244, 67, 54, 0.4);
        color: #f44336;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        cursor: pointer;
      }
      .pill-btn {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: var(--secondary-text-color, #8ca0aa);
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
      }
      .pill-btn.selected {
        background: #41bdf5;
        color: #fff;
        border-color: #41bdf5;
      }
      .inline-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .input-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .input-label {
        font-size: 12px;
        color: var(--secondary-text-color, #8ca0aa);
      }
      .custom-input, .custom-select {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 8px 12px;
        color: #fff;
        font-size: 14px;
        outline: none;
      }
      .primary-btn {
        width: 100%;
        background: #41bdf5;
        border: none;
        color: #fff;
        padding: 10px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .primary-btn:hover {
        background: #0284c7;
      }

      /* DAY CHIPS & SCHEDULE */
      .recurrence-btn {
        flex: 1;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: var(--secondary-text-color, #8ca0aa);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      }
      .recurrence-btn.active {
        background: #41bdf5;
        color: #fff;
        border-color: #41bdf5;
      }
      .day-chips {
        display: flex;
        justify-content: space-between;
        gap: 6px;
      }
      .day-chip {
        flex: 1;
        aspect-ratio: 1;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: var(--secondary-text-color, #8ca0aa);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .day-chip.selected {
        background: #41bdf5;
        color: #fff;
        border-color: #41bdf5;
      }
      .footer-actions {
        display: flex;
        gap: 12px;
        margin-top: 18px;
      }
      .outline-danger-btn {
        background: transparent;
        border: 1px solid rgba(244, 67, 54, 0.4);
        color: #f44336;
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .teal { color: #41bdf5; }
      .coral { color: #ff9800; }
    `;
  }
}

// Register both primary name and legacy alias for 100% backward compatibility
if (!customElements.get("passable-screen-time-card")) {
  customElements.define("passable-screen-time-card", PassableScreenTimeCard);
}
if (!customElements.get("passable-device-lockout-card")) {
  customElements.define("passable-device-lockout-card", PassableScreenTimeCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "passable-screen-time-card",
  name: "Passable Screen Time Card",
  preview: true,
  description: "Screen time monitor, viewing timer, and access schedule card for the Passable suite.",
});
