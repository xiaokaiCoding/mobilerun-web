"""Event serialization utilities for converting mobilerun events to JSON-safe dicts."""

import base64
from typing import Any


def serialize_event_to_dict(event: Any) -> dict:
    """Convert a mobilerun SDK event object to a JSON-serializable dict.

    Handles known event types explicitly; falls back to __dict__ for others.
    Bytes fields are either base64-encoded (screenshots) or truncated/skipped.
    """
    result: dict[str, Any] = {}
    event_type = type(event).__name__

    if event_type == "ScreenshotEvent":
        return _serialize_screenshot_event(event)

    if event_type == "ToolExecutionEvent":
        return _serialize_tool_execution_event(event)

    # Generic fallback: extract safe attributes from __dict__ or vars()
    attrs = _safe_attrs(event)
    result.update(attrs)
    return result


def _serialize_screenshot_event(event: Any) -> dict:
    """Handle ScreenshotEvent — truncate base64 to keep SSE payload small."""
    screenshot = getattr(event, "screenshot", b"")
    if isinstance(screenshot, (bytes, bytearray)):
        encoded = base64.b64encode(screenshot).decode()
        # Truncate to ~1KB for SSE; full image can be fetched from events endpoint
        truncated = encoded[:1000] + "..." if len(encoded) > 1000 else encoded
        return {"screenshot_base64": truncated}
    return {"screenshot_base64": str(screenshot)}


def _serialize_tool_execution_event(event: Any) -> dict:
    """Handle ToolExecutionEvent."""
    return {
        "tool_name": getattr(event, "tool_name", ""),
        "tool_args": _safe_value(getattr(event, "tool_args", {})),
        "success": getattr(event, "success", None),
        "summary": getattr(event, "summary", ""),
    }


def _safe_attrs(event: Any) -> dict:
    """Extract all non-bytes attributes from an event object."""
    attrs: dict[str, Any] = {}
    # Try __dict__ first, fall back to vars()
    obj_dict = getattr(event, "__dict__", {}) or {}
    if not obj_dict:
        try:
            obj_dict = vars(event)
        except TypeError:
            obj_dict = {}

    for key, value in obj_dict.items():
        if key.startswith("_"):
            continue
        attrs[key] = _safe_value(value)

    return attrs


def _safe_value(value: Any) -> Any:
    """Convert a value to something JSON-serializable."""
    if isinstance(value, (bytes, bytearray)):
        # Truncate binary data
        encoded = base64.b64encode(value).decode()
        return encoded[:200] + ("..." if len(encoded) > 200 else "")
    if isinstance(value, dict):
        return {k: _safe_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_safe_value(item) for item in value]
    return value
