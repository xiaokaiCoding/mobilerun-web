"""LLM configuration management routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_db
from src.models import LLMConfig
from src.schemas import LLMConfigCreate, LLMConfigResponse, LLMConfigUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/llm-configs", tags=["llm-configs"])


@router.get("", response_model=list[LLMConfigResponse])
async def list_configs(db: AsyncSession = Depends(get_db)) -> list[LLMConfig]:
    """List all LLM configurations."""
    result = await db.execute(select(LLMConfig).order_by(LLMConfig.created_at.desc()))
    return list(result.scalars().all())


@router.get("/active", response_model=LLMConfigResponse | None)
async def get_active_config(db: AsyncSession = Depends(get_db)) -> LLMConfig | None:
    """Get the currently active LLM configuration."""
    result = await db.execute(
        select(LLMConfig).where(LLMConfig.is_active == 1).limit(1)
    )
    return result.scalar_one_or_none()


@router.post("", response_model=LLMConfigResponse, status_code=201)
async def create_config(
    payload: LLMConfigCreate,
    db: AsyncSession = Depends(get_db),
) -> LLMConfig:
    """Create a new LLM configuration (inactive by default)."""
    config = LLMConfig(
        name=payload.name,
        provider=payload.provider,
        model_name=payload.model_name,
        api_key=payload.api_key,
        base_url=payload.base_url,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        is_active=0,
        extra_params=payload.extra_params,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.put("/{config_id}", response_model=LLMConfigResponse)
async def update_config(
    config_id: int,
    payload: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
) -> LLMConfig:
    """Update an existing LLM configuration."""
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    await db.commit()
    await db.refresh(config)
    return config


@router.put("/{config_id}/activate", response_model=LLMConfigResponse)
async def activate_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
) -> LLMConfig:
    """Activate this config and deactivate all others (in a transaction)."""
    # Verify target exists
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == config_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="LLM config not found")

    # Deactivate all
    await db.execute(update(LLMConfig).values(is_active=0))
    # Activate target
    target.is_active = 1

    await db.commit()
    await db.refresh(target)

    # Sync to mobilerun config file
    try:
        from src.services.llm_config_service import sync_config_to_file
        await sync_config_to_file(db)
    except Exception:
        logger.exception("Failed to sync LLM config to file, but DB update succeeded")

    return target


@router.delete("/{config_id}", status_code=204)
async def delete_config(config_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete an LLM configuration."""
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")

    await db.delete(config)
    await db.commit()
