"""Pydantic schemas for request/response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ─── Device ───────────────────────────────────────────────────────────────

class DeviceCreate(BaseModel):
    serial: str
    name: Optional[str] = None
    model: Optional[str] = None
    platform: str = "android"
    adb_host: Optional[str] = None
    adb_port: int = 5037


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None


class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    serial: str
    name: Optional[str]
    model: Optional[str]
    platform: str
    status: str
    adb_host: Optional[str]
    adb_port: int
    last_seen_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


# ─── LLMConfig ────────────────────────────────────────────────────────────

class LLMConfigCreate(BaseModel):
    name: str
    provider: str
    model_name: str
    api_key: str
    base_url: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096
    extra_params: Optional[dict] = None


class LLMConfigUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    extra_params: Optional[dict] = None


class LLMConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    provider: str
    model_name: str
    base_url: Optional[str]
    temperature: float
    max_tokens: int
    is_active: int
    extra_params: Optional[dict]
    created_at: datetime
    updated_at: datetime


class LLMConfigActivate(BaseModel):
    """Request body for activating an LLM config (empty, ID comes from path)."""
    pass


# ─── TestCase ─────────────────────────────────────────────────────────────

class TestCaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    goal: str
    max_steps: int = 30
    status: str = "active"


class TestCaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    goal: Optional[str] = None
    max_steps: Optional[int] = None
    status: Optional[str] = None


class TestCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    goal: str
    max_steps: int
    status: str
    created_at: datetime
    updated_at: datetime


# ─── Execution ────────────────────────────────────────────────────────────

class ExecutionCreate(BaseModel):
    device_id: int
    test_case_id: int
    llm_config_id: Optional[int] = None


class ExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    test_case_id: int
    device_id: int
    llm_config_id: Optional[int]
    status: str
    goal: str
    result: Optional[str]
    steps_taken: int
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime


class ExecutionBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    test_case_id: int
    device_id: int
    status: str
    steps_taken: int
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime


# ─── ExecutionEvent ───────────────────────────────────────────────────────

class ExecutionEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    execution_id: int
    event_type: str
    event_data: dict
    seq_no: int
    created_at: datetime
