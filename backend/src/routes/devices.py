"""Device management routes."""

import asyncio
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_db
from src.models import Device
from src.schemas import DeviceCreate, DeviceResponse, DeviceUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=list[DeviceResponse])
async def list_devices(db: AsyncSession = Depends(get_db)) -> list[Device]:
    """List all devices ordered by creation time descending."""
    result = await db.execute(select(Device).order_by(Device.created_at.desc()))
    return list(result.scalars().all())


@router.post("/scan", response_model=list[DeviceResponse])
async def scan_devices(db: AsyncSession = Depends(get_db)) -> list[Device]:
    """Run `adb devices`, parse output, upsert into database."""
    proc = await asyncio.create_subprocess_exec(
        "adb", "devices",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        logger.warning("adb devices failed: %s", stderr.decode())
        raise HTTPException(status_code=500, detail="adb devices command failed")

    lines = stdout.decode().strip().splitlines()
    # First line is header "List of devices attached"
    connected: list[str] = []
    for line in lines[1:]:
        line = line.strip()
        if line and line.endswith("device"):
            serial = line.split()[0]
            connected.append(serial)

    # Upsert: mark connected as online, create if missing
    result = await db.execute(select(Device))
    existing: dict[str, Device] = {d.serial: d for d in result.scalars().all()}

    now = datetime.utcnow()

    for serial in connected:
        if serial in existing:
            dev = existing[serial]
            dev.status = "online"
            dev.last_seen_at = now
        else:
            dev = Device(serial=serial, status="online", last_seen_at=now)
            db.add(dev)

    # Mark previously online devices as offline if not connected
    for serial, dev in existing.items():
        if serial not in connected and dev.status == "online":
            dev.status = "offline"

    await db.commit()

    # Refresh and return
    result = await db.execute(select(Device).order_by(Device.created_at.desc()))
    return list(result.scalars().all())


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(device_id: int, db: AsyncSession = Depends(get_db)) -> Device:
    """Get a single device by ID."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: int,
    payload: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
) -> Device:
    """Update device name (and optionally status)."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(device, field, value)

    await db.commit()
    await db.refresh(device)
    return device
