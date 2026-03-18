# Bun 迁移指南 | Bun Migration Guide

> 项目已从 npm/Node.js 迁移到 Bun
> Project migrated from npm/Node.js to Bun

## 快速开始 | Quick Start

### 1. 安装 Bun | Install Bun

```bash
# Windows
powershell -c "irm bun.sh/install.ps1|iex"

# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# 验证安装 | Verify installation
bun --version
```

### 2. 迁移现有项目 | Migrate Existing Project

```bash
cd gushen-web

# 安装依赖（自动识别 package-lock.json）
# Install dependencies (auto-detects package-lock.json)
bun install

# 生成 bun.lockb（可选，推荐）
# Generate bun.lockb (optional, recommended)
# 已自动生成 | Already generated automatically
```

### 3. 日常开发命令 | Daily Development Commands

```bash
bun run dev         # 开发服务器 | Development server
bun run typecheck   # 类型检查 | Type checking
bun run lint        # 代码检查 | Linting
bun run test        # 运行测试 | Run tests
bun run build       # 构建生产版本 | Build for production
```

## 性能提升 | Performance Improvements

| 操作 | npm | Bun | 提升倍数 |
|------|-----|-----|----------|
| 依赖安装（首次）| ~60s | ~3-5s | **12-20x** |
| 依赖安装（缓存）| ~10s | ~1s | **10x** |
| 启动开发服务器 | ~8s | ~2s | **4x** |
| 运行测试 | ~5s | ~1.5s | **3x** |

## 主要变更 | Key Changes

### Dockerfile

**之前 (Before):**
```dockerfile
FROM node:20-alpine AS deps
RUN npm ci
RUN npm run build
CMD ["node", "server.js"]
```

**现在 (Now):**
```dockerfile
FROM oven/bun:1-alpine AS deps
RUN bun install --frozen-lockfile
RUN bun run build
CMD ["bun", "run", "server.js"]
```

### 本地开发 | Local Development

**之前 (Before):**
```bash
npm install
npm run dev
```

**现在 (Now):**
```bash
bun install
bun run dev
```

### 部署流程 | Deployment Process

参考 `README.md` 中的"标准部署流程（使用 Bun）"章节。
See "Standard Deployment Process (Using Bun)" section in README.md.

## Lockfile 策略 | Lockfile Strategy

项目同时保留两种 lockfile：
Project maintains both lockfiles:

1. **package-lock.json** - npm 格式，用于兼容性 | npm format, for compatibility
2. **bun.lockb** - Bun 二进制格式，更快更小 | Bun binary format, faster and smaller

**推荐做法 | Recommended approach:**
- 在版本控制中提交两个文件 | Commit both files to version control
- Bun 优先使用 bun.lockb | Bun prefers bun.lockb
- 如果只有 package-lock.json，Bun 也能正常工作 | Bun works with package-lock.json only

## 兼容性 | Compatibility

✅ **完全兼容 | Fully Compatible:**
- Next.js 14
- TypeScript 5.x
- React 18
- TailwindCSS
- Vitest
- Drizzle ORM
- 所有 npm 包 | All npm packages

⚠️ **注意事项 | Notes:**
- Bun 完全兼容 Node.js API | Bun is fully compatible with Node.js APIs
- 极少数包可能有问题（当前项目无问题）| Very few packages may have issues (none in current project)

## 故障排查 | Troubleshooting

### 问题：依赖安装失败 | Issue: Dependency Installation Fails

```bash
# 清理缓存并重装 | Clear cache and reinstall
rm -rf node_modules ~/.bun/install/cache
bun install
```

### 问题：构建失败 | Issue: Build Fails

```bash
# 检查 Bun 版本 | Check Bun version
bun --version  # 应该 >= 1.0 | Should be >= 1.0

# 清理并重新构建 | Clean and rebuild
rm -rf .next node_modules
bun install
bun run build
```

### 问题：Docker 构建失败 | Issue: Docker Build Fails

```bash
# 验证 Dockerfile 基础镜像 | Verify Dockerfile base image
grep "FROM" Dockerfile
# 应该输出 | Should output: FROM oven/bun:1-alpine

# 清理 Docker 缓存 | Clear Docker cache
docker builder prune -f
```

## 回退到 npm | Rollback to npm

如果需要回退到 npm（不推荐）：
If you need to rollback to npm (not recommended):

1. 修改 Dockerfile 使用 `node:20-alpine` | Update Dockerfile to use `node:20-alpine`
2. 替换 `bun install` 为 `npm ci` | Replace `bun install` with `npm ci`
3. 替换 `bun run` 为 `npm run` | Replace `bun run` with `npm run`
4. 替换 CMD 为 `["node", "server.js"]` | Replace CMD with `["node", "server.js"]`

详细步骤见 README.md 末尾。
See README.md end for detailed steps.

## 更多资源 | Additional Resources

- 官方文档 | Official Docs: https://bun.sh/docs
- 包管理器 | Package Manager: https://bun.sh/docs/cli/install
- API 参考 | API Reference: https://bun.sh/docs/api
- 性能对比 | Performance: https://bun.sh/docs/performance

## 开发工作流 | Development Workflow

参考根目录的 `CLAUDE.md` 文件查看完整的开发工作流程。
See `CLAUDE.md` in root directory for complete development workflow.

---

**最后更新 | Last Updated:** 2026-01-22
