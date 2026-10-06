# Changelog

All notable changes to **Passable Smart Screen Time Engine** will be documented in this file.

## [1.3.0] - 2026-10-06

### ✨ Added
- **Recorder-Backed Screen Time Telemetry**: Integrated directly with Home Assistant Recorder (`state_changes_during_period`) to accurately reconcile and backfill cumulative active screen time and streaming apps used today. Screen time stats now reliably survive restarts, reloads, and manual migrations instead of relying on a volatile runtime counter.
- **Downtime Schedule Auto-Unlock**: Enhanced the schedule evaluation engine to automatically release device lockouts when scheduled downtime ends, while tracking schedule lock origin (`locked_by_schedule`) so manual parent lockouts outside schedule hours remain locked.
- **Automatic Network Switch Unpause**: When devices controlled via network switches (such as tablet wireless pause switches) are unlocked, the integration automatically issues `switch.turn_off` to restore Wi-Fi access immediately.
- **Reconcile Screen Time Service**: Added `passable_smart_screen_time_engine.reconcile_screen_time` service for on-demand or automated history synchronization.

### 🐛 Fixed
- **Persistent Screen Time Across Imports**: Fixed an issue where running legacy helper migration or updating devices would overwrite accumulated minutes with zero. Existing telemetry (`screen_time_today_minutes`, `apps_used_today`, `screen_time_date`, and `locked_by_schedule`) is now strictly preserved.
- **Accurate Active Media Player Detection**: Expanded active state evaluation beyond `"on"` to also include `"playing"`, `"idle"`, and `"paused"` states, preventing screen time gaps when pausing media.

## [1.2.0] - 2026-10-05

### ✨ Added & Redesigned (Smart Lock Engine Design Parity)
- **Unified Design System**: Completely rebuilt `passable-screen-time-card.js` with the exact visual styling, colors, CSS variables, and layout structure of the Passable Smart Lock Engine card (`passable-lock-manager-card.js`).
- **Hero Device Cards (`.doors-grid` & `.door-card`)**:
  - Colored left-border accents: Green (`var(--success-color, #4caf50)`) for permitted viewing, Orange (`var(--warning-color, #ff9800)`) for restricted screen time.
  - Circular icon wrapper (`.door-icon-wrapper`) with TV/tablet icons and power active glow indicator.
  - Telemetry sublines showing today's screen time, active streaming app badges, and daily limit progress bars.
  - Header pills matching smart lock diagnostics: Countdown timer pills (`.battery-pill.warning`) and daily screen time status pills (`.battery-pill.good`/`.warning`/`.critical`).
  - Full-width `.door-toggle-btn.btn-locked` and `.btn-unlocked` action buttons with dedicated icon boxes, bold action labels ("Restricted (Locked)" / "Permitted (Unlocked)"), and intuitive sub-labels.
  - Quick secondary action buttons for immediate device power toggle and settings drawer access.
- **Card Header & Global Status**:
  - Engine badge (`.engine-badge.native`) labeled `SCREEN TIME HUB`.
  - Global status pill (`.status-pill.locked` / `.status-pill.unlocked`) showing real-time restricted device counts.
  - Master action button (`.lock-all-btn`) to permit or restrict all screens with a single tap.
- **Household Restrictions Section**: Interactive restriction pills with glowing status indicators for active downtime/bedtime automations.
- **24-Hour Screen Time Activity Breakdown (`.activity-section`)**:
  - Timeline filter pills to switch between "All Screens" and individual devices.
  - Continuous device usage bars comparing screen time against configured daily limits.
  - Collapsible recent activity feed (`.activity-expand-bar` and `.event-feed-container`) tracking streaming applications, lockout state changes, and timer sessions.
- **Enhanced Edit Drawer**:
  - Modern header with back button and real-time status.
  - Live timer banner with active countdown and one-tap cancellation.
  - Material 3 switches (`.toggle-switch` & `.toggle-knob`) for manual lockout and power control.
  - Collapsible accordion sections (`.section`) for Screen Time Limits, Viewing Timer ("One More Show" with presets), Downtime Schedule (with circular day chips and bi-weekly recurrence), and Device Management.
- **Visual Dashboard Editor**: Added `passable-screen-time-card-editor` for visual configuration in the Lovelace UI.

## [1.1.2] - 2026-10-05

### 🐛 Fixed
- **Synchronized Entity Removals in Options Flow**: Deselecting devices in the integration options flow now properly and permanently removes them from `.storage` and automatically cleans up their associated entities from Home Assistant's Entity Registry.
- **Strict Speaker & Virtual Player Exclusion**: Filtered out all `device_class: speaker`, `mass_player_type`, and virtual Music Assistant entities during legacy helper migration to prevent unwanted audio players (e.g. Master Bedroom Speaker MA, Living Room TV MA) from being mapped instead of actual televisions.
- **Standardized Canonical Device Keying**: Standardized internal device IDs by target entity slug (`living_room_tv_2`, `office_tv_2`, `master_bedroom_tv`) across both legacy migration and manual selection, eliminating duplicate tiles.
- **Automatic Migration & Duplicate Sanitization**: On load, `.storage` automatically identifies and purges stale speaker entries and duplicate device keys targeting the same hardware device.
- **Orphan Entity Cleanup on Reload**: When managed devices are removed, any lingering entities in Home Assistant are automatically deregistered from the Entity Registry.
- **Guarded Helper Auto-Import**: Auto-import now runs only once on initial setup so subsequent configuration reloads never resurrect previously deleted devices.

### ✨ Added
- **Delete Device Action & Service**: Added `passable_smart_screen_time_engine.delete_device` service action and WebSocket command `passable_smart_screen_time_engine/delete_device` for 1-click device removal.
- **Card UI Device Removal**: Added "Remove Device from Engine" button to the card's edit dialog to delete devices directly from the Lovelace card.


## [1.1.1] - 2026-10-05

### 🐛 Fixed
- **Resolved 500 Internal Server Error**: Fixed missing `SIGNAL_STORAGE_UPDATED` in `const.py` which caused an `ImportError` when loading `binary_sensor.py` during entry setup.
- **Smart Target Entity Resolution**: Enhanced `async_import_legacy_helpers` to prioritize actual smart TVs over speakers and virtual MA players, correctly mapping TV hardware entities.
- **Robust Config Flow Initialization**: Fixed options flow base class inheritance and added graceful fallback handling.
- **Flexible Setup Ingestion**: Enabled automated helper importing even when no initial entities are manually selected in the setup dialog.

## [1.1.0] - 2026-10-05

### ✨ Added
- **Native Active Lockouts Sensor**: Added `binary_sensor.passable_screen_time_active_lockouts` (`Active Device Lockouts`) reporting collective lockout status and rich attributes (`locked_count`, `locked_devices`, `locked_device_names`, `all_locked`, `active_restrictions`).
- **Master Device Lockout Switch**: Added `switch.passable_master_device_lockout` to lock, unlock, or toggle all managed devices simultaneously without requiring custom scripts.
- **Master Toggle Service**: Added `passable_smart_screen_time_engine.toggle_all_lockouts` service action for easy 1-touch dashboard automation.
- **Automated Setup Migration Checkbox**: Added `import_helpers` boolean selector in config flow and options flow to automatically import existing schedules upon initial setup.
- **Friendly Configuration Flow Descriptions**: Added comprehensive `strings.json` and `translations/en.json` explaining each setting, supported entity types (`media_player` TVs, `switch` Eero pauses), and human-friendly labels.
- **Component Brand Assets**: Bundled `icon.png`, `logo.png`, and `brand/` assets directly inside `custom_components/passable_smart_screen_time_engine/` so Home Assistant's "Add Integration" brand picker displays the official icon.

## [1.0.0] - 2026-10-05

### ✨ Added
- Initial release of **Passable Smart Screen Time Engine**.
- **Universal Multi-Device Support**: Unified supervision across Smart TVs (`media_player`) and Personal Tablets / Network Switches (`network_switch` / Eero Wi-Fi pause).
- **Persistent Countdown Timers ("One More Show")**: Temporary viewing windows (`15m`, `20m`, `30m`, `45m`, custom) with millisecond-precision UTC deadline tracking that survives Home Assistant reboots and automatically relocks / powers off devices.
- **7-Day Schedule Engine**: Weekly and bi-weekly downtime schedules with multi-day circular chips (`S M T W T F S`) and overnight time span evaluation.
- **Live Screen Time Telemetry**: In-memory cumulative minute tracking (`sensor.<dev>_screen_time_today`) with automatic midnight rolling reset.
- **Streaming App Intelligence**: Translates Android TV / Google TV package IDs and webOS sources into clean brand titles (`Netflix`, `Disney+`, `YouTube`, `Prime Video`, `Plex`, `PBS KIDS`).
- **Atomic `.storage` Persistence**: Zero helper clutter—eliminates `input_boolean`, `input_text`, and `timer` entities in favor of secure Home Assistant internal storage.
- **1-Click Legacy Helper Migration**: Built-in automated importer to ingest existing `input_text.device_lockout_schedule_*` and `input_boolean.device_lockout_*` helpers with zero manual re-entry.
- **Bundled Next-Gen Dashboard Card**: Includes `passable-screen-time-card.js` with smart lock visual styling, circular day bubbles, and an alias for `custom:passable-device-lockout-card` for instant backwards compatibility.
