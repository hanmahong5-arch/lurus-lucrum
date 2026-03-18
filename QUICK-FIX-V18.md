# 快速修复：网页显示旧版本问题
# Quick Fix: Old Version Still Showing on Web

**问题症状 Problem**:
- 代码已提交到GitHub (commit 935bf56)
- Deployment配置已更新为v18
- 但访问 http://43.226.46.164:3000 仍显示旧版本UI

---

## 🔍 可能的原因 Root Causes

### 1. 镜像未构建或未导入K3s
**最常见的原因！**

K8s配置显示 `image: gushen-web:v18`, `imagePullPolicy: Never`，这意味着：
- 使用本地镜像，不从远程拉取
- 如果K3s containerd中**没有v18镜像**，Pod会一直使用旧镜像

### 2. Pod未重启
Deployment配置更新后，旧Pod可能仍在运行旧镜像。

### 3. 访问路径问题
您可能访问的不是正确的Pod：
- **域名访问** (推荐): https://gushen.lurus.cn → 通过Traefik Ingress → 正确的Pod
- **IP直接访问**: http://43.226.46.164:3000 → 可能绕过Ingress，访问到其他服务

### 4. 浏览器缓存
浏览器缓存了旧的JS/CSS文件，即使服务器已更新。

---

## ✅ 快速检查清单 Quick Checklist

### Step 1: 登录服务器
```bash
ssh cloud-ubuntu-3-2c2g
# 或
ssh root@43.226.46.164
```

### Step 2: 执行诊断脚本
```bash
cd /root/gushen
bash diagnose-and-fix-v18.sh
```

这个脚本会：
- ✅ 检查所有namespace中的deployment和pod
- ✅ 对比配置的镜像 vs 实际运行的镜像
- ✅ 检查v18镜像是否存在于K3s containerd
- ✅ 分析访问路径
- ✅ 提供一键修复选项

---

## 🛠️ 手动修复步骤 Manual Fix Steps

### 方案A: 确认镜像存在（最重要）

```bash
# 1. 检查K3s中的镜像
crictl images | grep gushen-web

# 应该看到：
# docker.io/library/gushen-web  v18  <IMAGE_ID>  XXX MB
# docker.io/library/gushen-web  v17  <IMAGE_ID>  XXX MB
```

**如果没有v18镜像**，需要构建并导入：

```bash
cd /root/gushen/gushen-web

# 拉取最新代码
git pull origin main
git log -1 --oneline  # 应该显示 935bf56

# 构建v18镜像（使用--no-cache确保最新代码）
docker build --no-cache -t gushen-web:v18 \
  --build-arg API_URL=http://43.226.46.164:30800 \
  --build-arg WS_URL=ws://43.226.46.164:30800 .

# 导入到K3s containerd
docker save gushen-web:v18 | k3s ctr images import -

# 验证导入成功
crictl images | grep v18
```

### 方案B: 强制重启Pod

即使v18镜像存在，Pod可能还在使用旧镜像缓存。

```bash
# 方法1: 强制删除Pod（推荐）
kubectl delete pods -n ai-qtrd -l app=ai-qtrd-web --force --grace-period=0

# 方法2: 滚动重启
kubectl rollout restart deployment/ai-qtrd-web -n ai-qtrd

# 等待新Pod就绪
kubectl wait --for=condition=Ready pod -l app=ai-qtrd-web -n ai-qtrd --timeout=90s

# 查看Pod状态
kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o wide
```

### 方案C: 验证Pod使用正确的镜像

```bash
# 检查Pod实际使用的镜像
kubectl get pods -n ai-qtrd -l app=ai-qtrd-web \
  -o jsonpath='{.items[0].spec.containers[0].image}'

# 应该输出: gushen-web:v18
```

**如果输出不是v18**：
1. 检查deployment配置是否正确：
   ```bash
   kubectl get deployment ai-qtrd-web -n ai-qtrd -o yaml | grep image:
   ```
2. 如果deployment配置是v18但Pod不是，说明镜像不存在或Pod未重启

### 方案D: 检查Pod日志

```bash
# 查看Pod启动日志
kubectl logs -n ai-qtrd -l app=ai-qtrd-web --tail=50

# 查看最近的事件
kubectl describe pod -n ai-qtrd -l app=ai-qtrd-web | tail -30
```

**常见错误**：
- `ImagePullBackOff`: 镜像不存在
- `CrashLoopBackOff`: 应用启动失败（检查环境变量、依赖）
- `ErrImageNeverPull`: imagePullPolicy=Never但镜像不存在

---

## 🌐 清除浏览器缓存 Clear Browser Cache

即使服务器已更新，浏览器可能缓存了旧文件。

### Chrome/Edge
1. 打开开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

或者：
- **Ctrl+Shift+Delete** → 清除缓存和Cookie
- **Ctrl+Shift+N** → 打开隐私窗口测试

### Firefox
- **Ctrl+Shift+Delete** → 清除缓存
- **Ctrl+F5** → 强制刷新

---

## 🧪 验证v18功能 Verify v18 Features

部署成功后，验证新功能是否生效：

### 1. 访问策略编辑器
```
http://43.226.46.164:3000/dashboard
或
https://gushen.lurus.cn/dashboard
```

### 2. 创建测试策略
输入：
```
双均线策略：快线5日，慢线20日，金叉买入，死叉卖出
```

### 3. 运行回测
- 初始资金: 100000
- 时间范围: 2024-01-01 至 2025-01-01
- 测试标的: 600519

### 4. 检查新组件

#### ✅ EnhancedTradeCard（交易记录增强卡片）
在交易记录区域，应该看到：
- **股票代码+名称**: "600519 贵州茅台"
- **手数信息**: "1手（100股）"
- **成交价格**: "¥1,850.50/股"
- **订单金额**: "¥185,050"
- **交易成本**: "手续费 ¥55.52 + 滑点 ¥18.51 = ¥74.03"
- **触发依据**: "MACD金叉"
- **指标值**: "MACD=12.5, Signal=8.3, DIF=4.2"
- **持仓变化**: "现金 ¥1,000,000 → ¥814,950 | 持仓 0手 → 1手"

**对比旧版本**：
- ❌ 旧版：只显示 "贵州茅台 +2.35%"
- ✅ 新版：完整的交易详情卡片

#### ✅ BacktestBasisPanel（回测依据面板）
在回测结果上方，应该看到：
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
- ✅ 新版：完整的回测元数据

#### ✅ ParameterInfoDialog（参数详细说明）
点击参数旁的信息图标（ℹ️），应该弹出对话框显示：
- 📖 参数含义
- ⚙️ 作用机制
- 📊 影响分析
- 🎯 常见取值
- 💡 使用建议

**对比旧版本**：
- ❌ 旧版：只有一行简短说明
- ✅ 新版：详细的说明对话框

---

## 📊 验证方法2: 检查buildId

v18应该有新的buildId：

```bash
# 方法1: 通过curl
curl -s http://43.226.46.164:3000 | grep -o 'buildId":"[^"]*'

# 方法2: 浏览器开发者工具
# 打开 F12 → Network → 刷新 → 查看HTML响应 → 搜索 "buildId"
```

每次构建都会生成不同的buildId，如果与之前相同，说明仍是旧版本。

---

## 🔄 如果问题仍然存在 If Problem Persists

### 1. 检查是否有多个deployment
```bash
kubectl get deployments -A | grep -i web
kubectl get pods -A | grep -i web
```

### 2. 检查Service的Endpoint
```bash
kubectl get endpoints ai-qtrd-web -n ai-qtrd
```

### 3. 检查是否有其他端口暴露
```bash
kubectl get svc -A | grep 3000
```

### 4. 直接访问Pod测试
```bash
# 获取Pod名称
POD_NAME=$(kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o name | head -1)

# 端口转发到本地
kubectl port-forward -n ai-qtrd $POD_NAME 8080:3000

# 在另一个终端测试
curl http://localhost:8080
```

### 5. 检查Pod的环境变量
```bash
kubectl exec -n ai-qtrd -it $(kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o name | head -1) -- env
```

---

## 📝 部署检查清单 Deployment Checklist

完成以下所有步骤后打勾：

- [ ] 1. Git拉取最新代码 (commit 935bf56)
- [ ] 2. Docker构建v18镜像成功
- [ ] 3. v18镜像导入K3s containerd成功
- [ ] 4. `crictl images | grep v18` 显示v18镜像
- [ ] 5. Deployment配置使用v18
- [ ] 6. 删除并重启Pod
- [ ] 7. Pod状态为Running (1/1 Ready)
- [ ] 8. Pod使用的镜像确认为v18
- [ ] 9. Pod日志无错误
- [ ] 10. 清除浏览器缓存
- [ ] 11. EnhancedTradeCard显示正常
- [ ] 12. BacktestBasisPanel显示正常
- [ ] 13. ParameterInfoDialog显示正常
- [ ] 14. 无JavaScript错误（F12控制台检查）

---

## 💡 最佳实践 Best Practices

### 避免此类问题的建议：

1. **使用有意义的镜像tag**
   - ❌ 避免: `gushen-web:latest`（会缓存）
   - ✅ 推荐: `gushen-web:v18`, `gushen-web:935bf56`

2. **构建时使用--no-cache**
   ```bash
   docker build --no-cache -t gushen-web:v18 .
   ```

3. **部署后强制重启Pod**
   ```bash
   kubectl rollout restart deployment/ai-qtrd-web -n ai-qtrd
   ```

4. **验证镜像导入**
   ```bash
   crictl images | grep gushen-web | grep v18
   ```

5. **记录每次部署**
   在 `lucrum-web/doc/process.md` 中记录部署时间和版本

---

## 🆘 需要帮助 Need Help

如果上述方法都不能解决问题，请收集以下信息：

```bash
# 收集诊断信息
echo "=== Deployment ===" > /tmp/debug-v18.txt
kubectl get deployment ai-qtrd-web -n ai-qtrd -o yaml >> /tmp/debug-v18.txt

echo "=== Pods ===" >> /tmp/debug-v18.txt
kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o yaml >> /tmp/debug-v18.txt

echo "=== Pod Logs ===" >> /tmp/debug-v18.txt
kubectl logs -n ai-qtrd -l app=ai-qtrd-web --tail=100 >> /tmp/debug-v18.txt

echo "=== Images ===" >> /tmp/debug-v18.txt
crictl images | grep gushen >> /tmp/debug-v18.txt

echo "=== Events ===" >> /tmp/debug-v18.txt
kubectl get events -n ai-qtrd --sort-by='.lastTimestamp' | tail -50 >> /tmp/debug-v18.txt

cat /tmp/debug-v18.txt
```

---

**最后更新**: 2026-01-22
**相关文档**:
- `doc/manual-deploy-v18.md` - 完整部署指南
- `diagnose-and-fix-v18.sh` - 自动诊断脚本
- `lucrum-web/doc/process.md` - 开发进度记录
