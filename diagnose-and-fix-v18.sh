#!/bin/bash
# Lucrum Web v18 部署诊断和修复脚本
# Diagnose and Fix v18 Deployment Issues

set -e

echo "=========================================="
echo "Lucrum Web v18 部署诊断和修复"
echo "Diagnose and Fix v18 Deployment"
echo "=========================================="
echo ""

# Part 1: 全面诊断 Comprehensive Diagnosis
echo "=== Part 1: 全面诊断 ==="
echo ""

echo "[1/7] 检查所有namespace中的web相关deployment..."
echo "Checking all web deployments across namespaces..."
kubectl get deployments -A | grep -E "(NAME|web|lucrum|qtrd)" || echo "No web deployments found"
echo ""

echo "[2/7] 检查所有web相关的Pod..."
echo "Checking all web pods..."
kubectl get pods -A -o wide | grep -E "(NAME|web|lucrum|qtrd)" || echo "No web pods found"
echo ""

echo "[3/7] 检查ai-qtrd namespace中的详细Pod信息..."
echo "Checking detailed pod info in ai-qtrd namespace..."
kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o custom-columns=\
NAME:.metadata.name,\
IMAGE:.spec.containers[0].image,\
STATUS:.status.phase,\
NODE:.spec.nodeName,\
START_TIME:.status.startTime
echo ""

echo "[4/7] 检查所有Service（包括NodePort/LoadBalancer）..."
echo "Checking all services..."
kubectl get svc -A | grep -E "(NAME|web|lucrum|qtrd|3000)" || echo "No services found on port 3000"
echo ""

echo "[5/7] 检查所有Ingress配置..."
echo "Checking all ingress configurations..."
kubectl get ingress -A || echo "No ingress found"
kubectl get ingressroute -A || echo "No Traefik IngressRoute found"
echo ""

echo "[6/7] 检查可用的Docker镜像..."
echo "Checking available Docker images..."
crictl images | grep lucrum-web || echo "No lucrum-web images found"
echo ""

echo "[7/7] 检查当前运行的容器..."
echo "Checking running containers on this node..."
crictl ps | grep -E "(CONTAINER ID|lucrum|web)" || echo "No lucrum containers found"
echo ""

# Part 2: 详细分析 Detailed Analysis
echo "=========================================="
echo "=== Part 2: 详细分析 ==="
echo ""

echo "[分析1] 检查deployment配置的镜像版本..."
CONFIGURED_IMAGE=$(kubectl get deployment ai-qtrd-web -n ai-qtrd -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "NOT_FOUND")
echo "Deployment配置的镜像: $CONFIGURED_IMAGE"
echo ""

echo "[分析2] 检查实际运行的Pod使用的镜像..."
RUNNING_IMAGE=$(kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o jsonpath='{.items[0].spec.containers[0].image}' 2>/dev/null || echo "NOT_FOUND")
echo "实际运行的镜像: $RUNNING_IMAGE"
echo ""

echo "[分析3] 检查Pod的创建时间（判断是否是新Pod）..."
POD_AGE=$(kubectl get pods -n ai-qtrd -l app=ai-qtrd-web --no-headers 2>/dev/null | awk '{print $5}' || echo "NOT_FOUND")
echo "Pod运行时长: $POD_AGE"
echo ""

echo "[分析4] 检查Service的Endpoint（确认后端Pod）..."
kubectl get endpoints ai-qtrd-web -n ai-qtrd -o wide 2>/dev/null || echo "Service endpoint not found"
echo ""

# Part 3: 版本不一致的根本原因分析
echo "=========================================="
echo "=== Part 3: 根本原因分析 ==="
echo ""

if [ "$CONFIGURED_IMAGE" != "$RUNNING_IMAGE" ]; then
    echo "⚠️ 警告: 配置的镜像与实际运行的镜像不一致！"
    echo "   Configured: $CONFIGURED_IMAGE"
    echo "   Running:    $RUNNING_IMAGE"
    echo ""
    echo "可能原因:"
    echo "1. Deployment更新后Pod未重启"
    echo "2. imagePullPolicy=Never导致未拉取新镜像"
    echo "3. K3s containerd中没有v18镜像"
    echo ""
elif [ "$CONFIGURED_IMAGE" = "lucrum-web:v18" ]; then
    echo "✓ 配置正确: Deployment使用v18镜像"
    echo ""
    echo "但网页显示旧版本，可能原因:"
    echo "1. 访问的不是这个Pod（有其他服务在运行）"
    echo "2. 浏览器缓存"
    echo "3. CDN/反向代理缓存"
    echo "4. Pod虽然是v18但代码未更新（镜像构建问题）"
    echo ""
else
    echo "⚠️ 警告: Deployment配置的镜像版本不是v18"
    echo "   Current: $CONFIGURED_IMAGE"
    echo "   Expected: lucrum-web:v18"
    echo ""
fi

# Part 4: 检查访问路径
echo "=========================================="
echo "=== Part 4: 访问路径分析 ==="
echo ""

echo "您访问的URL是: http://43.226.46.164:3000"
echo ""
echo "根据K8s配置，有以下几种访问方式："
echo ""
echo "方式1: 通过Traefik Ingress (推荐)"
echo "  URL: https://lucrum.lurus.cn"
echo "  路由: lucrum.lurus.cn → Traefik → ai-qtrd-web Service → Pod"
echo ""
echo "方式2: 直接NodePort访问 (如果配置了)"
echo "  URL: http://43.226.46.164:<NodePort>"
echo "  路由: 直接到Node的端口 → Pod"
echo ""
echo "方式3: 端口转发测试 (仅调试用)"
echo "  URL: http://localhost:3000"
echo "  路由: kubectl port-forward → Pod"
echo ""

# 检查是否有NodePort服务
echo "检查是否存在NodePort类型的服务..."
kubectl get svc -A -o wide | grep -E "(NodePort|LoadBalancer)" | grep -E "(web|lucrum)" || echo "未发现NodePort/LoadBalancer类型的web服务"
echo ""

# Part 5: 修复方案
echo "=========================================="
echo "=== Part 5: 修复方案 ==="
echo ""

echo "根据诊断结果，请执行以下修复步骤："
echo ""
echo "步骤1: 确保v18镜像已构建并导入K3s"
echo "--------------------------------------"
echo "cd /root/lucrum/lucrum-web"
echo ""
echo "# 检查v18镜像是否存在"
echo "crictl images | grep v18"
echo ""
echo "# 如果不存在，需要构建和导入："
echo "docker build --no-cache -t lucrum-web:v18 \\"
echo "  --build-arg API_URL=http://43.226.46.164:30800 \\"
echo "  --build-arg WS_URL=ws://43.226.46.164:30800 ."
echo ""
echo "docker save lucrum-web:v18 | k3s ctr images import -"
echo ""

echo "步骤2: 强制更新Deployment并重启Pod"
echo "--------------------------------------"
echo "# 方法1: 强制删除所有旧Pod（推荐）"
echo "kubectl delete pods -n ai-qtrd -l app=ai-qtrd-web --force --grace-period=0"
echo ""
echo "# 方法2: 滚动重启"
echo "kubectl rollout restart deployment/ai-qtrd-web -n ai-qtrd"
echo ""
echo "# 等待新Pod就绪"
echo "kubectl wait --for=condition=Ready pod -l app=ai-qtrd-web -n ai-qtrd --timeout=90s"
echo ""

echo "步骤3: 验证新Pod使用v18镜像"
echo "--------------------------------------"
echo "kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o jsonpath='{.items[0].spec.containers[0].image}'"
echo "# 应该输出: lucrum-web:v18"
echo ""

echo "步骤4: 检查Pod日志确认启动成功"
echo "--------------------------------------"
echo "kubectl logs -n ai-qtrd -l app=ai-qtrd-web --tail=50"
echo ""

echo "步骤5: 清除浏览器缓存并重新访问"
echo "--------------------------------------"
echo "1. 打开浏览器开发者工具 (F12)"
echo "2. 右键点击刷新按钮 → \"清空缓存并硬性重新加载\""
echo "3. 或者使用隐私窗口访问 (Ctrl+Shift+N)"
echo ""

# Part 6: 快速修复命令（一键执行）
echo "=========================================="
echo "=== Part 6: 快速修复（一键执行）==="
echo ""

read -p "是否立即执行修复？(y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "开始修复..."
    echo ""

    echo "[1/5] 检查v18镜像..."
    if crictl images | grep -q "lucrum-web.*v18"; then
        echo "✓ v18镜像已存在"
    else
        echo "✗ v18镜像不存在，需要先构建！"
        echo "请执行以下命令构建镜像："
        echo "  cd /root/lucrum/lucrum-web"
        echo "  docker build --no-cache -t lucrum-web:v18 ."
        echo "  docker save lucrum-web:v18 | k3s ctr images import -"
        exit 1
    fi
    echo ""

    echo "[2/5] 删除旧Pod..."
    kubectl delete pods -n ai-qtrd -l app=ai-qtrd-web --force --grace-period=0
    echo ""

    echo "[3/5] 等待新Pod启动..."
    sleep 5
    kubectl wait --for=condition=Ready pod -l app=ai-qtrd-web -n ai-qtrd --timeout=90s || {
        echo "✗ Pod启动超时，查看日志："
        kubectl logs -n ai-qtrd -l app=ai-qtrd-web --tail=50
        exit 1
    }
    echo ""

    echo "[4/5] 验证镜像版本..."
    CURRENT_IMAGE=$(kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o jsonpath='{.items[0].spec.containers[0].image}')
    if [ "$CURRENT_IMAGE" = "lucrum-web:v18" ]; then
        echo "✓ Pod使用v18镜像"
    else
        echo "✗ Pod使用的镜像是: $CURRENT_IMAGE"
        exit 1
    fi
    echo ""

    echo "[5/5] 显示Pod信息..."
    kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o wide
    echo ""

    echo "=========================================="
    echo "✓ 修复完成！"
    echo "=========================================="
    echo ""
    echo "请执行以下验证："
    echo "1. 清除浏览器缓存（Ctrl+Shift+Delete）"
    echo "2. 访问: http://43.226.46.164:3000/dashboard"
    echo "3. 运行回测，查看交易记录是否显示增强版卡片"
    echo ""
    echo "检查项目："
    echo "- 交易记录显示手数（如\"1手（100股）\"）"
    echo "- 显示触发依据和指标值"
    echo "- 显示持仓变化"
    echo "- 回测结果上方显示\"回测依据\"面板"
    echo ""
else
    echo ""
    echo "已取消自动修复。"
    echo "您可以按照上述步骤手动执行。"
    echo ""
fi

echo "=========================================="
echo "诊断脚本执行完成"
echo "=========================================="
