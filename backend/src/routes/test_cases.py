"""Test case management routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.dependencies import get_db
from src.models import Execution, TestCase
from src.schemas import TestCaseCreate, TestCaseResponse, TestCaseUpdate, ExecutionBrief

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test-cases", tags=["test-cases"])


@router.get("", response_model=dict)
async def list_test_cases(
    status: str | None = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List test cases with pagination and filters."""
    count_stmt = select(func.count(TestCase.id))
    if status:
        count_stmt = count_stmt.where(TestCase.status == status)
    count_result = await db.execute(count_stmt)
    total = count_result.scalar() or 0

    stmt = select(TestCase).order_by(TestCase.created_at.desc())
    if status:
        stmt = stmt.where(TestCase.status == status)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = list(result.scalars().all())

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=TestCaseResponse, status_code=201)
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
