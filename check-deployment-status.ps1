# PowerShell Script to Check v18 Deployment Status
# 检查v18部署状态的PowerShell脚本

Write-Host "=================================="
Write-Host "Lucrum Web v18 部署状态检查"
Write-Host "=================================="
Write-Host ""

# 1. 检查K8s Pod状态
Write-Host "[1] 检查K8s Pod状态..."
$podInfo = ssh cloud-ubuntu-3-2c2g "kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o wide" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host $podInfo
    Write-Host ""
} else {
    Write-Host "错误: 无法获取Pod状态" -ForegroundColor Red
    Write-Host ""
}

# 2. 检查使用的镜像版本
Write-Host "[2] 检查当前使用的镜像版本..."
$imageInfo = ssh cloud-ubuntu-3-2c2g "kubectl get pods -n ai-qtrd -l app=ai-qtrd-web -o jsonpath='{.items[0].spec.containers[0].image}'" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "当前镜像: $imageInfo"
    Write-Host ""
} else {
    Write-Host "错误: 无法获取镜像信息" -ForegroundColor Red
    Write-Host ""
}

# 3. 检查可用的镜像版本
Write-Host "[3] 检查服务器上可用的镜像版本..."
$availableImages = ssh cloud-ubuntu-3-2c2g "k3s crictl images | grep lucrum-web" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host $availableImages
    Write-Host ""
} else {
    Write-Host "错误: 无法获取镜像列表" -ForegroundColor Red
    Write-Host ""
}

# 4. 检查部署日志（如果存在）
Write-Host "[4] 检查部署日志..."
$deployLog = ssh cloud-ubuntu-3-2c2g "tail -30 /root/lucrum/deploy-v18-output.log 2>&1" 2>$null
if ($LASTEXITCODE -eq 0 -and $deployLog) {
    Write-Host $deployLog
    Write-Host ""
} else {
    Write-Host "部署日志文件不存在或为空" -ForegroundColor Yellow
    Write-Host ""
}

# 5. 检查Docker构建日志
Write-Host "[5] 检查Docker构建日志..."
$buildLog = ssh cloud-ubuntu-3-2c2g "tail -20 /root/lucrum/docker-build-v18.log 2>&1" 2>$null
if ($LASTEXITCODE -eq 0 -and $buildLog) {
    Write-Host $buildLog
    Write-Host ""
} else {
    Write-Host "构建日志文件不存在或为空" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "=================================="
Write-Host "状态检查完成"
Write-Host "=================================="

# 6. 保存状态到本地文件
$statusFile = "deployment-status-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
@"
Lucrum Web v18 部署状态
检查时间: $(Get-Date)

Pod状态:
$podInfo

当前镜像:
$imageInfo

可用镜像:
$availableImages

部署日志:
$deployLog

构建日志:
$buildLog
"@ | Out-File -FilePath $statusFile -Encoding UTF8

Write-Host ""
Write-Host "状态已保存到: $statusFile" -ForegroundColor Green
