#!/bin/bash
# Monitor v18 deployment progress
# 监控v18部署进度

echo "开始监控v18部署进度..."
echo "按Ctrl+C停止监控"
echo ""

for i in {1..20}; do
    echo "=========================================="
    echo "检查 #$i - $(date '+%H:%M:%S')"
    echo "=========================================="

    # 拉取最新的部署日志
    scp -q cloud-ubuntu-3-2c2g:/root/lucrum/deploy-v18-output.log ./deploy-v18-latest.log 2>/dev/null

    if [ -f ./deploy-v18-latest.log ]; then
        # 显示最后30行
        tail -30 ./deploy-v18-latest.log

        # 检查是否包含成功标志
        if grep -q "v18部署成功" ./deploy-v18-latest.log; then
            echo ""
            echo "✓ 部署成功！"
            exit 0
        fi

        # 检查是否有错误
        if grep -q "错误:" ./deploy-v18-latest.log; then
            echo ""
            echo "✗ 检测到错误，查看完整日志"
            exit 1
        fi
    else
        echo "等待部署日志生成..."
    fi

    echo ""
    echo "等待30秒后继续检查..."
    sleep 30
done

echo ""
echo "监控超时（10分钟），请手动检查"
