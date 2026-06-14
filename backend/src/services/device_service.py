"""Device-related helper functions."""

import asyncio
import logging
import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_PATTERN = re.compile(r"^(\S+)\s+device\s*$")


async def scan_devices(session: AsyncSession) -> list[dict[str, str]]:
    """Run `adb devices` and return list of {serial, status: 'online'}."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "adb", "devices",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            logger.warning("adb devices failed: %s", stderr.decode())
            return []

        devices: list[dict[str, str]] = []
        for line in stdout.decode().splitlines()[1:]:  # skip header
            match = _PATTERN.match(line.strip())
            if match:
                devices.append({"serial": match.group(1), "status": "online"})

        return devices
    except FileNotFoundError:
        logger.error("adb executable not found")
        return []
    except Exception:
        logger.exception("Unexpected error scanning devices")
        return []
