FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl android-tools-adb && \
    rm -rf /var/lib/apt/lists/* && \
    curl -LsSf https://astral.sh/uv/install.sh | sh

ENV PATH="/root/.local/bin:${PATH}"
WORKDIR /app

COPY requirements.txt .
RUN uv pip install --system -r requirements.txt

COPY src/ ./src/
COPY sql/ ./sql/

EXPOSE 4000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "4000"]
