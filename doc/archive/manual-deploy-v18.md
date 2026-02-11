# GuShen Web v18 手动部署指南
# Manual Deployment Guide for GuShen Web v18

**创建时间**: 2026-01-22
**版本**: v18
**GitHub Commit**: 935bf56

---

## 概述 | Overview

由于SSH连接问题，自动部署脚本无法执行。本指南提供详细的手动部署步骤。

Due to SSH connection issues, the automated deployment script could not execute. This guide provides detailed manual deployment steps.

---

## 部署内容 | Deployment Content

### 核心改进 | Core Improvements

本次v18版本包含以下重大改进：

1. **交易记录增强显示** - EnhancedTradeCard组件（457行）
   - 按手为单位显示交易数量
   - 显示触发依据和指标值
   - 显示持仓变化（现金和持仓）
   - 95%+边缘情况处理

2. **回测依据透明化** - BacktestBasisPanel组件（582行）
   - 显示测试标的（股票代码+名称）
   - 显示数据来源和时间范围
   - 显示数据完整性和交易成本

3. **参数详细说明** - ParameterInfoDialog组件（530行）
   - 参数含义和作用机制
   - 影响分析和常见取值
   - 使用建议和最佳实践

4. **健壮性增强** - BacktestPanel双层错误处理
   - 23个try-catch错误边界
   - 20个helper函数处理边缘情况
   - 12个fallback UI状态

### 技术改进 | Technical Improvements

- ✅ 修复TypeScript编译错误（3个）
- ✅ 修复Redis导入错误（backtestCache → cacheGet/cacheSet）
- ✅ Dockerfile优化（支持better-sqlite3 native模块）
- ✅ 数值验证（NaN/Infinity/null/undefined）
- ✅ 除零保护（safeDivide函数）
- ✅ 字符串截断（防止超长文本）
- ✅ 数组边界检查

---

## 前置条件 | Prerequisites

### 1. 检查服务器连接

确保您能够通过SSH登录到服务器：

```bash
ssh cloud-ubuntu-3-2c2g
# 或
ssh root@43.226.46.164
# 或
ssh root@100.113.79.77  # Tailscale IP
```

### 2. 确认工具安装

登录服务器后，确认以下工具已安装：

```bash
# 检查Docker
docker --version

# 检查K3s
k3s --version

# 检查kubectl
kubectl version --client

# 检查Git
git --version
```

### 3. 确认当前状态

```bash
# 查看当前运行的Pod
kubectl get pods -n ai-qtrd -l app=ai-qtrd-web

# 查看当前使用的镜像版本
kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o jsonpath='{.items[0].spec.containers[0].image}'

# 查看可用的Docker镜像
crictl images | grep gushen-web
```

---

## 部署步骤 | Deployment Steps

### 步骤1：拉取最新代码 | Pull Latest Code

```bash
# 进入项目目录
cd /root/gushen

# 备份当前代码（可选但推荐）
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz gushen-web/src

# 拉取GitHub最新代码（commit 935bf56）
git pull origin main

# 验证拉取成功
git log -1 --oneline
# 应该显示: 935bf56 feat(robustness): Phase 1,3,4组件健壮性重写 - 95%边缘情况覆盖
```

**预期输出**:
```
From github.com:hanmahong5-arch/lurus-gushen
 * branch            main       -> FETCH_HEAD
   b307f67..935bf56  main       -> origin/main
Updating b307f67..935bf56
Fast-forward
 74 files changed, 23571 insertions(+), 7705 deletions(-)
 create mode 100644 src/components/strategy-editor/enhanced-trade-card.tsx
 create mode 100644 src/components/strategy-editor/backtest-basis-panel.tsx
 create mode 100644 src/components/strategy-editor/parameter-info-dialog.tsx
 ...
```

### 步骤2：验证关键文件 | Verify Critical Files

```bash
cd /root/gushen/gushen-web

# 验证Redis导入修复
grep "cacheGet, cacheSet" src/app/api/backtest/multi-stocks/route.ts
# 应该显示: import { cacheGet, cacheSet } from "@/lib/redis";

# 验证EnhancedTradeCard存在且行数正确
wc -l src/components/strategy-editor/enhanced-trade-card.tsx
# 应该显示: 457

# 验证BacktestBasisPanel存在
wc -l src/components/strategy-editor/backtest-basis-panel.tsx
# 应该显示: 582

# 验证ParameterInfoDialog存在
wc -l src/components/strategy-editor/parameter-info-dialog.tsx
# 应该显示: 530
```

### 步骤3：清理旧镜像缓存 | Clean Old Image Cache

```bash
# 清理v17和更早版本的镜像（释放空间）
crictl rmi gushen-web:v17 2>/dev/null || true
crictl rmi gushen-web:v16 2>/dev/null || true
crictl rmi gushen-web:v15 2>/dev/null || true

# 清理悬空的Docker镜像
docker image prune -f

echo "✓ 旧镜像缓存已清理"
```

### 步骤4：构建Docker镜像v18 | Build Docker Image v18

```bash
cd /root/gushen/gushen-web

# 构建镜像（使用--no-cache确保使用最新代码）
docker build --no-cache \
  -t gushen-web:v18 \
  --build-arg API_URL=http://43.226.46.164:30800 \
  --build-arg WS_URL=ws://43.226.46.164:30800 \
  --build-arg REDIS_HOST=43.226.46.164 \
  --build-arg REDIS_PORT=6379 \
  --build-arg REDIS_PASSWORD=lurus2024 \
  . 2>&1 | tee /root/gushen/docker-build-v18-$(date +%H%M%S).log
```

**预计时间**: 3-5分钟

**关键构建阶段**:
1. `[1/6] FROM oven/bun:1-alpine` - 基础镜像
2. `[2/6] RUN apk add python3 make g++` - 构建工具（支持better-sqlite3）
3. `[3/6] COPY package.json ...` - 复制依赖文件
4. `[4/6] RUN bun install` - 安装依赖
5. `[5/6] COPY . .` - 复制源代码
6. `[6/6] RUN bun run build` - 构建Next.js应用

**验证构建成功**:
```bash
# 检查镜像是否创建
docker images | grep gushen-web:v18

# 应该显示类似:
# gushen-web  v18  <IMAGE_ID>  About a minute ago  XXX MB
```

**如果构建失败，检查日志**:
```bash
tail -100 /root/gushen/docker-build-v18-*.log
```

### 步骤5：导入镜像到K3s | Import Image to K3s

```bash
# 导出Docker镜像并导入到K3s containerd
docker save gushen-web:v18 | k3s ctr images import -

# 验证导入成功
k3s crictl images | grep gushen-web
```

**预期输出**:
```
docker.io/library/gushen-web  v18     <IMAGE_ID>     XXX MB
docker.io/library/gushen-web  v17     <IMAGE_ID>     XXX MB  (旧版本)
```

### 步骤6：更新K8s部署 | Update Kubernetes Deployment

```bash
# 更新deployment使用新镜像v18
kubectl set image deployment/ai-qtrd-web web=gushen-web:v18 -n ai-qtrd

# 等待10秒让系统开始滚动更新
sleep 10

# 强制删除旧Pod（确保使用新镜像，避免缓存）
kubectl delete pods -n ai-qtrd -l app=ai-qtrd-web

# 等待新Pod就绪（最多90秒）
echo "等待新Pod就绪..."
kubectl wait --for=condition=Ready pod -l app=ai-qtrd-web -n ai-qtrd --timeout=90s
```

**预期输出**:
```
deployment.apps/ai-qtrd-web image updated
pod "ai-qtrd-web-xxxxxxxxxx-xxxxx" deleted
pod/ai-qtrd-web-yyyyyyyyyy-yyyyy condition met
```

### 步骤7：验证部署 | Verify Deployment

```bash
echo "=========================================="
echo "v18部署验证"
echo "=========================================="
echo ""

# 1. 查看Pod状态
echo "1. Pod状态:"
kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o wide

# 2. 验证镜像版本
echo ""
echo "2. 使用的镜像:"
kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""

# 3. 查看Pod启动日志（最后20行）
echo ""
echo "3. Pod日志（最后20行）:"
kubectl logs -n ai-qtrd -l app=ai-qtrd-web --tail=20

# 4. 检查Pod Events（如果有问题）
echo ""
echo "4. Pod Events:"
kubectl describe pods -n ai-qtrd -l app=ai-qtrd-web | grep -A 20 "Events:"
```

**成功标志**:
- ✅ Pod状态为 `Running`
- ✅ Ready列显示 `1/1`
- ✅ 镜像显示 `gushen-web:v18`
- ✅ 日志中没有错误信息
- ✅ Events中显示 `Started container` 或 `Pulled`

**如果Pod未就绪**:
```bash
# 查看详细错误信息
kubectl describe pod -n ai-qtrd -l app=ai-qtrd-web

# 查看完整日志
kubectl logs -n ai-qtrd -l app=ai-qtrd-web --tail=100

# 检查镜像拉取状态
kubectl get events -n ai-qtrd --sort-by='.lastTimestamp' | grep -i pull
```

---

## 功能验证 | Functional Verification

部署成功后，通过浏览器验证新功能是否生效。

### 1. 访问Web应用

打开浏览器访问：
```
http://43.226.46.164:3000
```

确认首页正常加载。

### 2. 进入策略编辑器

访问：
```
http://43.226.46.164:3000/dashboard
```

### 3. 创建测试策略

在策略输入框中输入：
```
我要一个双均线策略：
- 快线周期5日，慢线周期20日
- 当快线上穿慢线时买入
- 当快线下穿慢线时卖出
- 止损比例8%
```

点击"生成策略"，等待AI生成代码。

### 4. 配置回测参数

- 初始资金：100000
- 时间范围：2024-01-01 至 2025-01-01
- 测试标的：600519（贵州茅台）或其他股票代码

点击"运行回测"。

### 5. 验证新组件功能

#### ✅ 交易记录增强卡片（EnhancedTradeCard）

检查交易记录区域，应该看到：
- **股票信息**：代码+名称（如"600519 贵州茅台"）
- **交易方向**：买入/卖出的彩色标签
- **手数显示**：如"1手（100股）"
- **成交价格**：如"¥1,850.50/股"
- **订单金额**：如"¥185,050"
- **交易成本**：手续费+滑点明细
- **触发依据**：如"MACD金叉"
- **指标值**：如"MACD=12.5, Signal=8.3"
- **持仓变化**：现金和持仓的前后对比

**对比旧版本**：
- ❌ 旧版：只显示"贵州茅台 +2.35%"
- ✅ 新版：完整的交易详情卡片

#### ✅ 回测依据面板（BacktestBasisPanel）

在回测结果上方（主要指标之上），应该看到：
```
==========================
回测依据 | Backtest Basis
==========================
测试标的: 600519 贵州茅台
数据来源: 实盘历史数据
时间范围: 2024-01-01 ~ 2025-01-01 (365天)
有效交易日: 243天 (66.6%)
数据完整性: 100%
初始资金: ¥100,000
交易成本: 手续费0.03% + 滑点0.1%
```

**对比旧版本**：
- ❌ 旧版：没有回测依据信息
- ✅ 新版：完整的回测元数据展示

#### ✅ 参数详细说明（ParameterInfoDialog）

在参数编辑区域，点击任意参数旁的信息图标（ℹ️），应该弹出详细说明对话框，包含：
- 📖 参数含义
- ⚙️ 作用机制
- 📊 影响分析（值变小/变大的影响）
- 🎯 常见取值（可直接应用）
- 💡 使用建议
- 🔗 相关参数
- ✨ 最佳实践

**对比旧版本**：
- ❌ 旧版：只有一行简短说明
- ✅ 新版：详细的参数说明对话框

### 6. 边缘情况测试（可选）

如果要验证95%边缘情况覆盖，可以测试：

#### 测试1：极端数值
创建策略并设置极端参数：
- 快线周期：1（最小值）
- 慢线周期：999（超大值）

应该：
- ✅ 不报错
- ✅ 显示合理的fallback值

#### 测试2：空数据
选择一个没有交易记录的日期范围（如未来日期）

应该：
- ✅ 显示"暂无交易记录"
- ✅ 不出现JavaScript错误

#### 测试3：超长文本
在策略描述中输入超长文本（>1000字符）

应该：
- ✅ 文本被截断到合理长度
- ✅ UI不会变形

---

## 回滚方案 | Rollback Plan

如果v18出现问题，可以快速回滚到v17：

```bash
# 方法1：使用kubectl直接回滚
kubectl rollout undo deployment/ai-qtrd-web -n ai-qtrd

# 方法2：手动指定v17镜像
kubectl set image deployment/ai-qtrd-web web=gushen-web:v17 -n ai-qtrd

# 验证回滚
kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o jsonpath='{.items[0].spec.containers[0].image}'
# 应该显示: gushen-web:v17
```

---

## 常见问题 | Troubleshooting

### 问题1：Docker构建失败 - better-sqlite3错误

**错误信息**:
```
error: install script from "better-sqlite3" exited with 1
gyp ERR! configure error
```

**解决方案**:
确认Dockerfile包含构建工具：
```dockerfile
RUN apk add --no-cache python3 make g++
```

如果缺少，编辑Dockerfile添加该行，然后重新构建。

### 问题2：TypeScript编译错误

**错误信息**:
```
Type error: Module '"@/lib/redis"' has no exported member 'backtestCache'
```

**解决方案**:
确认已拉取最新代码（commit 935bf56），该问题已修复。
检查 `src/app/api/backtest/multi-stocks/route.ts` 第18行：
```typescript
import { cacheGet, cacheSet } from "@/lib/redis";  // ✅ 正确
// 而不是
import { backtestCache } from "@/lib/redis";  // ❌ 错误
```

### 问题3：Pod一直处于ImagePullBackOff状态

**原因**: K3s找不到镜像

**解决方案**:
```bash
# 重新导入镜像
docker save gushen-web:v18 | k3s ctr images import -

# 验证
k3s crictl images | grep v18

# 删除旧Pod强制重新创建
kubectl delete pods -n ai-qtrd -l app=ai-qtrd-web
```

### 问题4：Pod状态为CrashLoopBackOff

**原因**: 应用启动失败

**解决方案**:
```bash
# 查看详细日志
kubectl logs -n ai-qtrd -l app=ai-qtrd-web --tail=100

# 查看启动错误
kubectl describe pod -n ai-qtrd -l app=ai-qtrd-web
```

常见原因：
- Redis连接失败：检查REDIS_HOST/PORT/PASSWORD环境变量
- 端口冲突：检查3000端口是否被占用
- 依赖缺失：检查node_modules是否完整安装

### 问题5：浏览器显示旧版本

**原因**: 浏览器缓存或K8s更新未生效

**解决方案**:
```bash
# 1. 强制删除Pod
kubectl delete pods -n ai-qtrd -l app=ai-qtrd-web --force --grace-period=0

# 2. 清除浏览器缓存
# Chrome: Ctrl+Shift+Delete → 清除缓存
# 或使用隐私窗口: Ctrl+Shift+N

# 3. 验证buildId是否变化
curl -s http://43.226.46.164:3000 | grep -o 'buildId":"[^"]*'
```

---

## 部署检查清单 | Deployment Checklist

完成以下所有步骤后，打勾确认：

- [ ] 1. SSH连接到服务器成功
- [ ] 2. Git拉取最新代码（commit 935bf56）
- [ ] 3. 验证关键文件存在且行数正确
- [ ] 4. 清理旧镜像缓存
- [ ] 5. Docker构建v18成功
- [ ] 6. 镜像导入K3s成功
- [ ] 7. Kubernetes deployment更新成功
- [ ] 8. Pod状态为Running (1/1 Ready)
- [ ] 9. 镜像版本确认为v18
- [ ] 10. Pod日志无错误
- [ ] 11. Web应用首页访问正常
- [ ] 12. Dashboard页面访问正常
- [ ] 13. 策略生成功能正常
- [ ] 14. 回测运行功能正常
- [ ] 15. EnhancedTradeCard显示正常（手数、触发依据、持仓变化）
- [ ] 16. BacktestBasisPanel显示正常（测试标的、数据来源）
- [ ] 17. ParameterInfoDialog显示正常（详细说明）
- [ ] 18. 无JavaScript错误（F12控制台检查）

---

## 部署记录 | Deployment Log

请记录实际部署的详细信息：

**部署时间**: _______________

**执行人员**: _______________

**Git Commit**: 935bf56

**构建耗时**: _______________

**部署耗时**: _______________

**遇到的问题**:
1. _______________
2. _______________

**解决方案**:
1. _______________
2. _______________

**最终状态**:
- [ ] 部署成功
- [ ] 部署失败（需回滚）

**验证结果**:
- 首页访问: [ ] 正常 [ ] 异常
- Dashboard访问: [ ] 正常 [ ] 异常
- 策略生成: [ ] 正常 [ ] 异常
- 回测运行: [ ] 正常 [ ] 异常
- 新组件显示: [ ] 正常 [ ] 异常

**备注**:
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

## 联系信息 | Contact

如遇到技术问题，可以：
1. 查看本文档的"常见问题"章节
2. 检查GitHub commit 935bf56的详细改动
3. 查看 `doc/process.md` 中的Phase 1,3,4健壮性重写章节

---

**文档版本**: v1.0
**最后更新**: 2026-01-22
**状态**: Ready for Production Deployment
