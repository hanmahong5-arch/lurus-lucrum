#!/bin/bash
# Quick fix for backtestCache import error
# 快速修复backtestCache导入错误

echo "修复 multi-stocks/route.ts 的Redis导入..."

FILE="/root/lucrum/lucrum-web/src/app/api/backtest/multi-stocks/route.ts"

# 备份原文件
cp "$FILE" "$FILE.bak"

# 方法1: 删除第15行的backtestCache导入
sed -i '15d' "$FILE"

# 方法2: 在第18行后添加正确的导入
sed -i "18 a import { cacheGet, cacheSet } from '@/lib/redis';" "$FILE"

echo "修复完成！"
echo ""
echo "修改内容："
echo "- 删除: import { backtestCache } from '@/lib/redis';"
echo "- 添加: import { cacheGet, cacheSet } from '@/lib/redis';"
echo ""
echo "现在可以重新构建Docker镜像："
echo "cd /root/lucrum/lucrum-web && docker build -t lucrum-web:v18 ..."
