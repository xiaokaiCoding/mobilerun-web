"""Core execution service: runs MobileAgent and streams events."""

import asyncio
import base64
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import create_engine, update, text
from sqlalchemy.orm import sessionmaker

from src.routes.executions import active_executions
from src.utils.event_serializer import serialize_event_to_dict

logger = logging.getLogger(__name__)


def _get_sync_session(db_url: str) -> Any:
    """Create a synchronous SQLAlchemy session for event persistence.

    Each call gets a new engine to avoid connection-sharing issues with async code.
    """
    sync_url = db_url.replace("mysql+aiomysql://", "mysql+pymysql://")
    engine = create_engine(sync_url, pool_size=2, max_overflow=0, pool_recycle=300)
    factory = sessionmaker(bind=engine)
    return factory()


async def save_event_to_db(
    db_url: str,
    execution_id: int,
    event_type: str,
    event_data: dict,
    seq_no: int,
) -> None:
    """Persist a single execution event to the database."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None, _persist_event, db_url, execution_id, event_type, event_data, seq_no
    )


def _persist_event(
    db_url: str, execution_id: int, event_type: str, event_data: dict, seq_no: int
) -> None:
    sync_url = db_url.replace("mysql+aiomysql://", "mysql+pymysql://")
    engine = create_engine(sync_url, pool_size=1, max_overflow=0, pool_recycle=300)
    session = sessionmaker(bind=engine)()
    try:
        from sqlalchemy import insert
        stmt = text(
            "INSERT INTO execution_events (execution_id, event_type, event_data, seq_no) "
            "VALUES (:execution_id, :event_type, :event_data, :seq_no)"
        )
        import json
        session.execute(
            stmt,
            {
                "execution_id": execution_id,
                "event_type": event_type,
                "event_data": json.dumps(event_data, ensure_ascii=False, default=str),
                "seq_no": seq_no,
            },
        )
        session.commit()
    except Exception:
        logger.exception("Failed to persist event %d/%d", execution_id, seq_no)
        session.rollback()
    finally:
        session.close()
        engine.dispose()


async def update_execution_result(
    db_url: str,
    execution_id: int,
    success: bool,
    reason: str | None,
    steps: int,
) -> None:
    """Update the execution record with final result."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        _persist_result,
        db_url,
        execution_id,
        success,
        reason,
        steps,
    )


def _persist_result(
    db_url: str, execution_id: int, success: bool, reason: str | None, steps: int
) -> None:
    sync_url = db_url.replace("mysql+aiomysql://", "mysql+pymysql://")
    engine = create_engine(sync_url, pool_size=1, max_overflow=0, pool_recycle=300)
    session = sessionmaker(bind=engine)()
    try:
        status = "success" if success else "failed"
        result_text = reason if reason else ("Completed successfully" if success else "")
        stmt = text(
            "UPDATE executions SET status = :status, result = :result, "
            "steps_taken = :steps, finished_at = :finished_at WHERE id = :id"
        )
        session.execute(
            stmt,
            {
                "status": status,
                "result": result_text,
                "steps": steps,
                "finished_at": datetime.utcnow(),
                "id": execution_id,
            },
        )
        session.commit()
    except Exception:
        logger.exception("Failed to update execution %d result", execution_id)
        session.rollback()
    finally:
        session.close()
        engine.dispose()


async def run_execution(
    execution_id: int,
    device_serial: str,
    goal: str,
    llm_config: dict[str, Any],
    db_url: str,
    max_steps: int = 30,
) -> None:
    """Run a MobileAgent execution and stream events.

    This is the core integration function that connects the web API
    to the mobilerun SDK.
    """
    exec_info = active_executions.get(execution_id)
    if not exec_info:
        logger.error("Execution %d not found in active_executions", execution_id)
        return

    queue: asyncio.Queue = exec_info["queue"]
    stop_event: asyncio.Event = exec_info["stop_event"]

    seq = 0
    try:
        from mobilerun import MobileAgent
        from mobilerun.config_manager import ConfigLoader

        # Build MobileConfig
        config = ConfigLoader.load()
        config.device.serial = device_serial
        config.agent.max_steps = max_steps

        # Apply LLM config to all profiles (only if llm_config has values)
        if llm_config:
            for profile_name in config.llm_profiles:
                profile = config.llm_profiles[profile_name]
                if llm_config.get("provider"):
                    profile.provider = llm_config["provider"]
                if llm_config.get("model_name"):
                    profile.model = llm_config["model_name"]
                if llm_config.get("api_key"):
                    profile.api_key = llm_config["api_key"]
                if llm_config.get("base_url"):
                    profile.base_url = llm_config["base_url"]
                if llm_config.get("temperature") is not None:
                    profile.temperature = float(llm_config["temperature"])

        agent = MobileAgent(goal=goal, config=config)
        handler = agent.run()

        async for event in handler.stream_events():
            if stop_event.is_set():
                await agent.send_user_message("Execution stopped by user")
                break

            seq += 1
            event_type = type(event).__name__
            event_data = serialize_event_to_dict(event)

            # Push to SSE queue
            await queue.put({"type": event_type, "data": event_data, "seq": seq})

            # Persist to DB
            await save_event_to_db(db_url, execution_id, event_type, event_data, seq)

        # Wait for final result
        result = await handler
        await queue.put(
            {
                "type": "ResultEvent",
                "data": {
                    "success": result.success,
                    "reason": getattr(result, "reason", None),
                    "steps": getattr(result, "steps", 0),
                },
                "seq": seq + 1,
                "done": True,
            }
        )
        await update_execution_result(
            db_url,
            execution_id,
            result.success,
            getattr(result, "reason", None),
            getattr(result, "steps", 0),
        )

    except Exception as e:
        logger.exception("Execution %d failed", execution_id)
        await queue.put(
            {"type": "ErrorEvent", "data": {"error": str(e)}, "seq": seq + 1, "done": True}
        )
        await update_execution_result(db_url, execution_id, False, str(e), 0)
    finally:
        active_executions.pop(execution_id, None)
