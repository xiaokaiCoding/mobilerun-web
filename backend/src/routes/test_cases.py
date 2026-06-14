"""Test case management routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.dependencies import get_db
from src.models import Execution, TestCase
from src.schemas import TestCaseCreate, TestCaseResponse, TestCaseUpdate, ExecutionBrief

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test-cases", tags=["test-cases"])


@router.get("/", response_model=list[TestCaseResponse])
async def list_test_cases(
    status: str | None = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db),
) -> list[TestCase]:
    """List test cases with optional status filter."""
    stmt = select(TestCase).order_by(TestCase.created_at.desc())
    if status:
        stmt = stmt.where(TestCase.status == status)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/", response_model=TestCaseResponse, status_code=201)
async def create_test_case(
    payload: TestCaseCreate,
    db: AsyncSession = Depends(get_db),
) -> TestCase:
    """Create a new test case."""
    tc = TestCase(
        name=payload.name,
        description=payload.description,
        goal=payload.goal,
        status=payload.status,
    )
    db.add(tc)
    await db.commit()
    await db.refresh(tc)
    return tc


@router.get("/{case_id}", response_model=TestCaseResponse)
async def get_test_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
) -> TestCase:
    """Get a single test case by ID."""
    result = await db.execute(select(TestCase).where(TestCase.id == case_id))
    tc = result.scalar_one_or_none()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    return tc


@router.put("/{case_id}", response_model=TestCaseResponse)
async def update_test_case(
    case_id: int,
    payload: TestCaseUpdate,
    db: AsyncSession = Depends(get_db),
) -> TestCase:
    """Update a test case."""
    result = await db.execute(select(TestCase).where(TestCase.id == case_id))
    tc = result.scalar_one_or_none()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tc, field, value)

    await db.commit()
    await db.refresh(tc)
    return tc


@router.delete("/{case_id}", status_code=204)
async def delete_test_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a test case."""
    result = await db.execute(select(TestCase).where(TestCase.id == case_id))
    tc = result.scalar_one_or_none()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    await db.delete(tc)
    await db.commit()


@router.get("/{case_id}/history", response_model=list[ExecutionBrief])
async def get_test_case_history(
    case_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[Execution]:
    """Get execution history for a test case."""
    # Verify test case exists
    result = await db.execute(select(TestCase).where(TestCase.id == case_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Test case not found")

    result = await db.execute(
        select(Execution)
        .where(Execution.test_case_id == case_id)
        .order_by(Execution.created_at.desc())
    )
    return list(result.scalars().all())
