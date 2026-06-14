#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

SERVER="root@124.222.246.46"
SSH_KEY="/Users/zyb/Downloads/2026_0606.pem"
REMOTE_DIR="/root/mobilerun-web"

echo "[deploy] 同步代码到服务器..."
rsync -avz --delete \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
  --exclude 'node_modules' --exclude '.git' --exclude '__pycache__' --exclude '.env' \
  ./ "$SERVER:$REMOTE_DIR/"

echo "[deploy] 远程部署..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SERVER" "cd $REMOTE_DIR && \
  cat > .env << 'ENVEOF'
DB_ROOT_PASSWORD=root
HTTP_PORT=81
ENVEOF
  docker compose -f docker-compose.prod.yml down --remove-orphans --timeout 10 2>/dev/null || true
  docker rm -f mobilerun-backend mobilerun-frontend mobilerun-nginx 2>/dev/null || true
  docker compose -f docker-compose.prod.yml build --parallel
  docker compose -f docker-compose.prod.yml up -d
  docker image prune -f
"

echo "[deploy] 健康检查..."
sleep 10
RESULT=$(ssh -i "$SSH_KEY" "$SERVER" "curl -sf http://127.0.0.1:81/api/health") || true
if echo "$RESULT" | grep -q '"status"'; then
  echo "✅ 部署成功! 访问 http://124.222.246.46:81"
else
  echo "❌ 健康检查失败"
  exit 1
fi
