# mobilerun-web

Mobilerun 自动化框架的 Web 管控台。通过 Web UI 管理设备、LLM 配置、测试用例,并实时查看执行日志。

## 架构

```
[Browser] ──► [Nginx:81]
                    ├─ /          ──► Frontend (Vite SPA, port 3000)
                    └─ /api/*     ──► Backend (FastAPI, port 4000)
                                            ├─ MySQL (复用 nav-mysql:3306)
                                            └─ ADB Server (宿主机 5037)
```

## 快速开始

### 本地开发

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn src.main:app --reload --port 4000

# 前端
cd frontend
npm install
npm run dev
```

### Docker 部署

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d --build
```

### Jenkins 部署

推送到 main 分支后,Jenkins 每 5 分钟自动拉取部署。

## 页面

- 设备管理: `/devices` — 查看设备状态,扫描设备
- 模型配置: `/llm-config` — 管理 LLM provider 配置
- 用例配置: `/test-cases` — CRUD 测试用例,查看执行历史
- 任务执行: `/executions` — 发起执行,实时查看日志
