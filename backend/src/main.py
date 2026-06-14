"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info("Starting mobilerun-web backend...")

    # Initialize database tables
    from src.db import init_db
    await init_db()
    logger.info("Database initialized")

    yield

    logger.info("Shutting down mobilerun-web backend...")


app = FastAPI(
    title="mobilerun-web",
    description="Web API backend for mobilerun mobile automation testing",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# Mount routers under /api prefix
from src.routes.devices import router as devices_router
from src.routes.executions import router as executions_router
from src.routes.llm_config import router as llm_config_router
from src.routes.test_cases import router as test_cases_router

app.include_router(devices_router, prefix="/api")
app.include_router(llm_config_router, prefix="/api")
app.include_router(test_cases_router, prefix="/api")
app.include_router(executions_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
    )
