"""Execution management routes with SSE streaming."""

import asyncio
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.dependencies import get_db
from src.models import Execution, ExecutionEvent, TestCase, Device, LLMConfig
from src.schemas import ExecutionCreate, ExecutionResponse, ExecutionEventResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/executions", tags=["executions"])

# In-memory tracking of active executions
active_executions: dict[int, dict[str, Any]] = {}


@router.get("", response_model=list[ExecutionResponse])
async def list_executions(
    device_id: int | None = Query(None),
    test_case_id: int | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[Execution]:
    """List recent executions with optional filters."""
    stmt = (
        select(Execution)
        .options(selectinload(Execution.device), selectinload(Execution.test_case))
        .order_by(Execution.created_at.desc())
    )
    if device_id is not None:
        stmt = stmt.where(Execution.device_id == device_id)
    if test_case_id is not None:
        stmt = stmt.where(Execution.test_case_id == test_case_id)
    if status:
        stmt = stmt.where(Execution.status == status)

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=ExecutionResponse, status_code=201)
async def create_execution(
    payload: ExecutionCreate,
    db: AsyncSession = Depends(get_db),
) -> Execution:
    """Create a new execution and start it as a background task."""
    # Verify test case exists and get goal
    result = await db.execute(select(TestCase).where(TestCase.id == payload.test_case_id))
    test_case = result.scalar_one_or_none()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")

    # Verify device exists and get serial
    result = await db.execute(select(Device).where(Device.id == payload.device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Get LLM config if specified
    llm_config_dict: dict[str, Any] = {}
    if payload.llm_config_id is not None:
        result = await db.execute(
            select(LLMConfig).where(LLMConfig.id == payload.llm_config_id)
        )
        llm_config = result.scalar_one_or_none()
        if not llm_config:
            raise HTTPException(status_code=404, detail="LLM config not found")
        llm_config_dict = {
            "provider": llm_config.provider,
            "model_name": llm_config.model_name,
            "api_key": llm_config.api_key,
            "base_url": llm_config.base_url,
            "temperature": float(llm_config.temperature),
            "max_tokens": llm_config.max_tokens,
        }

    # Create execution record
    from src.config import settings

    execution = Execution(
        test_case_id=payload.test_case_id,
        device_id=payload.device_id,
        llm_config_id=payload.llm_config_id,
        status="running",
        goal=test_case.goal,
        started_at=datetime.utcnow(),
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # Set up SSE queue and stop event
    queue: asyncio.Queue = asyncio.Queue()
    stop_event = asyncio.Event()
    active_executions[execution.id] = {
        "queue": queue,
        "stop_event": stop_event,
    }

    # Launch background task
    from src.services.execution_service import run_execution

    task = asyncio.create_task(
        run_execution(
            execution_id=execution.id,
            device_serial=device.serial,
            goal=test_case.goal,
            llm_config=llm_config_dict,
            db_url=settings.async_db_url,
            max_steps=test_case.max_steps or 30,
        )
    )
    active_executions[execution.id]["task"] = task

    return execution


@router.get("/{exec_id}", response_model=ExecutionResponse)
async def get_execution(
    exec_id: int,
    db: AsyncSession = Depends(get_db),
) -> Execution:
    """Get execution detail."""
    result = await db.execute(
        select(Execution)
        .options(selectinload(Execution.device), selectinload(Execution.test_case))
        .where(Execution.id == exec_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution


async def _sse_generator(exec_id: int) -> Any:
    """SSE generator that yields events from the in-memory queue, then falls back to DB."""
    import json

    exec_info = active_executions.get(exec_id)
    queue: asyncio.Queue | None = exec_info["queue"] if exec_info else None

    # Drain in-memory queue first
    if queue:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=2.0)
                data = json.dumps(item, ensure_ascii=False, default=str)
                yield f"data: {data}\n\n"
                if item.get("done"):
                    return
            except asyncio.TimeoutError:
                # Check if execution is still active
                if exec_id not in active_executions:
                    break
                continue

    # Fall back to streaming persisted events from DB
    from src.db import get_session_factory

    factory = get_session_factory()
    async with factory() as db:
        result = await db.execute(
            select(ExecutionEvent)
            .where(ExecutionEvent.execution_id == exec_id)
            .order_by(ExecutionEvent.seq_no)
        )
        events = result.scalars().all()
        for event in events:
            data = json.dumps(
                {
                    "type": event.event_type,
                    "data": event.event_data,
                    "seq": event.seq_no,
                },
                ensure_ascii=False,
                default=str,
            )
            yield f"data: {data}\n\n"


@router.get("/{exec_id}/stream")
async def stream_execution(exec_id: int, db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    """SSE endpoint for real-time execution events."""
    # Verify execution exists
    result = await db.execute(select(Execution).where(Execution.id == exec_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Execution not found")

    return StreamingResponse(
        _sse_generator(exec_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{exec_id}/events", response_model=list[ExecutionEventResponse])
async def get_execution_events(
    exec_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[ExecutionEvent]:
    """Get persisted events from DB for replay."""
    result = await db.execute(
        select(ExecutionEvent)
        .where(ExecutionEvent.execution_id == exec_id)
        .order_by(ExecutionEvent.seq_no)
    )
    return list(result.scalars().all())


@router.post("/{exec_id}/stop", response_model=ExecutionResponse)
async def stop_execution(
    exec_id: int,
    db: AsyncSession = Depends(get_db),
) -> Execution:
    """Force stop a running execution."""
    result = await db.execute(select(Execution).where(Execution.id == exec_id))
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    exec_info = active_executions.get(exec_id)
    if exec_info:
        # 1. Set stop event for graceful shutdown
        exec_info["stop_event"].set()

        # 2. Kill the mobile agent on the device to unblock the loop
        try:
            from src.config import settings
            import asyncio
            proc = await asyncio.create_subprocess_exec(
                "adb", "-H", settings.ADB_HOST, "-P", str(settings.ADB_PORT),
                "shell", "am", "force-stop", "com.mobilerun.portal",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.communicate(), timeout=10)
        except Exception:
            pass

        # 3. Cancel the asyncio task
        task = exec_info.get("task")
        if task and not task.done():
            task.cancel()
            try:
                await asyncio.wait_for(task, timeout=5)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass

    execution.status = "stopped"
    execution.finished_at = datetime.utcnow()
    await db.commit()
    await db.refresh(execution)
    return execution


@router.delete("/{exec_id}", status_code=204)
async def delete_execution(
    exec_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an execution record."""
    result = await db.execute(select(Execution).where(Execution.id == exec_id))
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    await db.delete(execution)
    await db.commit()
