"""SQLAlchemy ORM models."""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    DECIMAL,
    ForeignKey,
    func,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship

class Base(DeclarativeBase):
    pass


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (Index("ix_devices_serial", "serial"),)

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    serial = Column(String(64), unique=True, nullable=False)
    name = Column(String(128), nullable=True)
    model = Column(String(128), nullable=True)
    platform = Column(String(16), nullable=False, server_default="android")
    status = Column(String(32), nullable=False, server_default="offline")
    adb_host = Column(String(128), nullable=True)
    adb_port = Column(Integer, nullable=False, server_default="5037")
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    executions = relationship("Execution", back_populates="device")


class LLMConfig(Base):
    __tablename__ = "llm_configs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False)
    provider = Column(String(64), nullable=False)
    model_name = Column(String(128), nullable=False)
    api_key = Column(String(512), nullable=False)
    base_url = Column(String(512), nullable=True)
    temperature = Column(DECIMAL(5, 2), nullable=False, server_default="0.2")
    max_tokens = Column(Integer, nullable=False, server_default="4096")
    is_active = Column(Integer, nullable=False, server_default="0")
    extra_params = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    executions = relationship("Execution", back_populates="llm_config")


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    goal = Column(Text, nullable=False)
    max_steps = Column(Integer, nullable=False, server_default="30")
    status = Column(String(32), nullable=False, server_default="active")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    executions = relationship("Execution", back_populates="test_case")


class Execution(Base):
    __tablename__ = "executions"
    __table_args__ = (
        Index("ix_executions_test_case_id", "test_case_id"),
        Index("ix_executions_device_id", "device_id"),
        Index("ix_executions_status", "status"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    test_case_id = Column(BigInteger, ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(BigInteger, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    llm_config_id = Column(BigInteger, ForeignKey("llm_configs.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(32), nullable=False, server_default="pending")
    goal = Column(Text, nullable=False)
    result = Column(Text, nullable=True)
    screenshot = Column(Text, nullable=True)  # base64 PNG screenshot
    trajectory_path = Column(String(512), nullable=True)  # path to trajectory folder
    steps_taken = Column(Integer, nullable=False, server_default="0")
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    test_case = relationship("TestCase", back_populates="executions")
    device = relationship("Device", back_populates="executions")
    llm_config = relationship("LLMConfig", back_populates="executions")
    events = relationship("ExecutionEvent", back_populates="execution", order_by="ExecutionEvent.seq_no")


class ExecutionEvent(Base):
    __tablename__ = "execution_events"
    __table_args__ = (Index("ix_execution_events_exec_seq", "execution_id", "seq_no"),)

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    execution_id = Column(BigInteger, ForeignKey("executions.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(64), nullable=False)
    event_data = Column(JSON, nullable=False)
    seq_no = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    execution = relationship("Execution", back_populates="events")
