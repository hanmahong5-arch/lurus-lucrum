#!/bin/bash
# Lucrum Web v18 Update and Deploy Script
# 更新代码并部署v18版本

set -e  # Exit on error
cd /root/lucrum

echo "=========================================="
echo "Lucrum Web v18 更新和部署"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# Step 1: 解压新代码
echo "[1/6] 解压新代码..."
if [ -f "lucrum-web-v18-src-only.tar.gz" ]; then
    cd lucrum-web
    tar -xzf ../lucrum-web-v18-src-only.tar.gz
    echo "✓ 代码解压完成"
else
    echo "错误: 找不到 lucrum-web-v18-src-only.tar.gz"
    exit 1
fi
echo ""

# Step 2: 验证关键文件
echo "[2/6] 验证关键文件..."
if grep -q "cacheGet, cacheSet" src/app/api/backtest/multi-stocks/route.ts; then
    echo "✓ route.ts Redis导入已修复"
else
    echo "警告: route.ts 可能还有问题"
fi

if [ -f "src/components/strategy-editor/enhanced-trade-card.tsx" ]; then
    LINES=$(wc -l < src/components/strategy-editor/enhanced-trade-card.tsx)
    if [ "$LINES" -gt 400 ]; then
        echo "✓ enhanced-trade-card.tsx 健壮版本 ($LINES lines)"
    else
        echo "警告: enhanced-trade-card.tsx 可能不是健壮版本"
    fi
fi
echo ""

# Step 3: 清理旧镜像缓存
echo "[3/6] 清理旧镜像缓存..."
crictl rmi lucrum-web:v17 2>/dev/null || true
crictl rmi lucrum-web:v16 2>/dev/null || true
echo "✓ 旧镜像缓存已清理"
echo ""

# Step 4: 构建Docker镜像
echo "[4/6] 构建Docker镜像v18..."
docker build --no-cache \
  -t lucrum-web:v18 \
  --build-arg API_URL=http://43.226.46.164:30800 \
  --build-arg WS_URL=ws://43.226.46.164:30800 \
  --build-arg REDIS_HOST=43.226.46.164 \
  --build-arg REDIS_PORT=6379 \
  --build-arg REDIS_PASSWORD=lurus2024 \
  . 2>&1 | tee /root/lucrum/docker-build-v18-$(date +%H%M%S).log

if [ $? -ne 0 ]; then
    echo "错误: Docker构建失败"
    tail -50 /root/lucrum/docker-build-v18-*.log
    exit 1
fi
echo "✓ Docker镜像构建成功"
echo ""

# Step 5: 导入到K3s
echo "[5/6] 导入镜像到K3s..."
docker save lucrum-web:v18 | k3s ctr images import -

if k3s crictl images | grep "lucrum-web.*v18"; then
    echo "✓ 镜像导入成功"
else
    echo "错误: 镜像导入失败"
    exit 1
fi
echo ""

# Step 6: 更新K8s部署
echo "[6/6] 更新K8s部署..."
kubectl set image deployment/ai-qtrd-web web=lucrum-web:v18 -n ai-qtrd

# 等待滚动更新
echo "等待Pod启动..."
sleep 10

# 强制删除旧Pod（确保使用新镜像）
kubectl delete pods -n ai-qtrd -l app=ai-qtrd-web

echo "等待新Pod就绪..."
kubectl wait --for=condition=Ready pod -l app=ai-qtrd-web -n ai-qtrd --timeout=90s

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✓ v18部署成功！"
    echo "=========================================="
    echo ""
    echo "Pod状态:"
    kubectl get pods -n ai-qtrd -l app=ai-qtrd-web
    echo ""
    echo "镜像信息:"
    kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o jsonpath='{.items[0].spec.containers[0].image}'
    echo ""
    echo ""
    echo "Pod日志 (最后20行):"
    kubectl logs -n ai-qtrd -l app=ai-qtrd-web --tail=20
else
    echo ""
    echo "警告: Pod未在90秒内就绪"
    echo "当前状态:"
    kubectl get pods -n ai-qtrd -l app=ai-qtrd-web
    echo ""
    echo "Pod Events:"
    kubectl describe pods -n ai-qtrd -l app=ai-qtrd-web | tail -50
fi

echo ""
echo "部署完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
