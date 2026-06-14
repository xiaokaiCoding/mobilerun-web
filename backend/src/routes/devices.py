"""Device management routes."""

import asyncio
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_db
from src.models import Device
from src.schemas import DeviceCreate, DeviceResponse, DeviceUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=dict)
async def list_devices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List devices with pagination."""
    total = await db.execute(select(func.count(Device.id)))
    total = total.scalar() or 0

    stmt = select(Device).order_by(Device.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = list(result.scalars().all())

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/scan", response_model=list[DeviceResponse])
async def scan_devices(db: AsyncSession = Depends(get_db)) -> list[Device]:
    """Run `adb devices`, parse output, upsert into database."""
    from src.config import settings

    proc = await asyncio.create_subprocess_exec(
        "adb", "-H", settings.ADB_HOST, "-P", str(settings.ADB_PORT), "devices",
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


@router.post("/register", response_model=DeviceResponse, status_code=201)
async def register_device(
    payload: DeviceCreate,
    db: AsyncSession = Depends(get_db),
) -> Device:
    """Manually register a device."""
    # Check if serial already exists
    result = await db.execute(select(Device).where(Device.serial == payload.serial))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Device with serial '{payload.serial}' already exists"
        )

    device = Device(
        serial=payload.serial,
        name=payload.name,
        model=payload.model,
        platform=payload.platform,
        status="offline",
        adb_host=payload.adb_host,
        adb_port=payload.adb_port,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


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
