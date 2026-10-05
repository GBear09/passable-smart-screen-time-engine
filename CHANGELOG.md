# Changelog

All notable changes to **Passable Smart Screen Time Engine** will be documented in this file.

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
