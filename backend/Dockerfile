FROM python:3.12-slim

# Use Tsinghua Debian mirror for fast apt
RUN sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y --no-install-recommends curl unzip && \
    rm -rf /var/lib/apt/lists/* && \
    curl -sL -o /tmp/platform-tools.zip "https://dl.google.com/android/repository/platform-tools-latest-linux.zip" && \
    unzip -o /tmp/platform-tools.zip platform-tools/adb -d /tmp && \
    mv /tmp/platform-tools/adb /usr/local/bin/adb && \
    chmod +x /usr/local/bin/adb && \
    rm -rf /tmp/platform-tools.zip /tmp/platform-tools

WORKDIR /app
COPY requirements.txt .

RUN pip install --no-cache-dir -i https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple \
    fastapi uvicorn[standard] sqlalchemy[asyncio] aiomysql pymysql \
    pydantic pydantic-settings httpx python-multipart greenlet

COPY src/ ./src/
COPY sql/ ./sql/

EXPOSE 4000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "4000"]
