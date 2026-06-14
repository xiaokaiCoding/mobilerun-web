"""LLM config file sync utility."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import LLMConfig

logger = logging.getLogger(__name__)


async def sync_config_to_file(session: AsyncSession) -> None:
    """Sync the active LLM config from DB to mobilerun's config.yaml on disk."""
    try:
        from mobilerun.config_manager import ConfigLoader

        result = await session.execute(
            select(LLMConfig).where(LLMConfig.is_active == 1).limit(1)
        )
        active_config = result.scalar_one_or_none()

        if not active_config:
            logger.info("No active LLM config found, skipping file sync")
            return

        config = ConfigLoader.load()

        llm_dict: dict[str, Any] = {
            "provider": active_config.provider,
            "model_name": active_config.model_name,
            "api_key": active_config.api_key,
            "temperature": float(active_config.temperature),
            "max_tokens": active_config.max_tokens,
        }
        if active_config.base_url:
            llm_dict["base_url"] = active_config.base_url
        if active_config.extra_params:
            llm_dict.update(active_config.extra_params)

        # Update all profiles with the active config
        for profile_name in config.llm_profiles:
            profile = config.llm_profiles[profile_name]
            for key, value in llm_dict.items():
                if hasattr(profile, key):
                    setattr(profile, key, value)

        ConfigLoader.save(config)
        logger.info("Synced LLM config '%s' to config.yaml", active_config.name)

    except ImportError:
        logger.warning("mobilerun SDK not available, skipping config file sync")
    except Exception:
        logger.exception("Failed to sync LLM config to file")
