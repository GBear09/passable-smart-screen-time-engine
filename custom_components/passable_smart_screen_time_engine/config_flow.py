"""Config flow for Passable Smart Screen Time Engine."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import selector
import voluptuous as vol

from .const import (
    CONF_DEVICES,
    CONF_GLOBAL_RESTRICTIONS,
    DEFAULT_DAILY_LIMIT,
    DOMAIN,
)
from .storage import get_default_device_data

_LOGGER = logging.getLogger(__name__)


class PassableScreenTimeConfigFlow(
    config_entries.ConfigFlow, domain=DOMAIN
):
    """Handle a config flow for Passable Smart Screen Time Engine."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial setup step."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title="Passable Smart Screen Time Engine",
                data=user_input,
            )

        # Default multi-select entities
        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_DEVICES, default=[]
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain=["media_player", "switch"],
                        multiple=True,
                    )
                ),
                vol.Optional(
                    CONF_GLOBAL_RESTRICTIONS, default=[]
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain=["input_boolean", "group"],
                        multiple=True,
                    )
                ),
                vol.Optional(
                    "import_helpers", default=True
                ): selector.BooleanSelector(),
            }
        )

        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        """Get options flow handler."""
        return PassableScreenTimeOptionsFlow(config_entry)


class PassableScreenTimeOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow to add/remove devices and restrictions."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        super().__init__()
        self._config_entry = config_entry

    @property
    def config_entry(self) -> config_entries.ConfigEntry:
        """Return the config entry."""
        return self._config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage devices and settings."""
        engine = self.hass.data.get(DOMAIN, {}).get(self.config_entry.entry_id)
        if not engine:
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            # Sync devices in storage
            selected_entities = user_input.get(CONF_DEVICES, [])
            current_devices = engine.storage.get_all_devices()

            # Add newly selected devices
            for entity_id in selected_entities:
                dev_id = entity_id.split(".", 1)[-1]
                if dev_id not in current_devices:
                    state_obj = self.hass.states.get(entity_id)
                    name = (
                        state_obj.attributes.get("friendly_name")
                        if state_obj
                        else dev_id.replace("_", " ").title()
                    )
                    payload = get_default_device_data(
                        dev_id, entity_id, name=name
                    )
                    await engine.storage.async_update_device(dev_id, payload)

            # Update restrictions
            restrictions = [
                {"entity": e}
                for e in user_input.get(CONF_GLOBAL_RESTRICTIONS, [])
            ]
            await engine.storage.async_update_global_restrictions(restrictions)

            if user_input.get("import_helpers"):
                await engine.storage.async_import_legacy_helpers()

            engine.async_rebuild_device_listeners()
            await engine.async_evaluate_schedules()

            return self.async_create_entry(title="", data=user_input)

        # Pre-fill currently tracked entities
        current_devices = engine.storage.get_all_devices()
        current_entities = [
            d.get("target_entity")
            for d in current_devices.values()
            if d.get("target_entity")
        ]
        current_restrictions = [
            r.get("entity")
            for r in engine.storage.get_global_restrictions()
            if r.get("entity")
        ]

        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_DEVICES, default=current_entities
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain=["media_player", "switch"],
                        multiple=True,
                    )
                ),
                vol.Optional(
                    CONF_GLOBAL_RESTRICTIONS, default=current_restrictions
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain=["input_boolean", "group"],
                        multiple=True,
                    )
                ),
                vol.Optional(
                    "import_helpers", default=False
                ): selector.BooleanSelector(),
            }
        )

        return self.async_show_form(step_id="init", data_schema=schema)
