# 边缘情况测试文档 | Edge Case Testing Documentation

> 最后更新 / Last Updated: 2026-01-22
> 版本 / Version: 1.0.0

## 概述 | Overview

本文档记录了 Lucrum 前端 (lucrum-web) 组件的边缘情况测试策略和覆盖范围。测试目标是确保组件在各种异常输入和极端条件下仍能稳定运行，覆盖率目标为 95%+。

This document records the edge case testing strategy and coverage for Lucrum frontend (lucrum-web) components. The testing goal is to ensure components operate stably under various abnormal inputs and extreme conditions, with a target coverage of 95%+.

---

## 测试环境 | Test Environment

| 项目 Item | 技术栈 Technology |
|-----------|-------------------|
| 测试框架 | Vitest 2.1.8 |
| DOM环境 | happy-dom |
| 组件测试 | @testing-library/react 16.x |
| 断言库 | @testing-library/jest-dom 6.x |
| 用户交互 | @testing-library/user-event 14.x |
| 运行时 | Bun |

### 配置文件 | Configuration Files

- `lucrum-web/vitest.config.ts` - Vitest 主配置
- `lucrum-web/src/__tests__/setup.ts` - 全局测试设置和 Mocks

---

## 测试文件列表 | Test Files

| 测试文件 | 目标组件 | 测试用例数 | 描述 |
|----------|----------|------------|------|
| `enhanced-trade-card.test.tsx` | EnhancedTradeCard | ~25 | 交易记录卡片 |
| `backtest-basis-panel.test.tsx` | BacktestBasisPanel | ~20 | 回测依据面板 |
| `parameter-info-dialog.test.tsx` | ParameterInfoDialog | ~15 | 参数详情弹窗 |
| `backtest-panel.test.tsx` | BacktestPanel | ~15 | 回测面板 |
| **总计 Total** | **4个组件** | **~75个测试** | |

---

## 边缘情况分类 | Edge Case Categories

### 1. 数值边缘 | Numeric Edge Cases

| 边缘情况 | 测试方法 | 预期行为 |
|----------|----------|----------|
| `NaN` | 传入 `NaN` 作为数值 | 显示回退值 (fallback) |
| `Infinity` / `-Infinity` | 传入无穷值 | 显示回退值 |
| 极大值 `> 1e12` | 传入万亿级数值 | 格式化为"万亿"单位 |
| 极大值 `> 1e8` | 传入亿级数值 | 格式化为"亿"单位 |
| 极小值 `< 0.01` | 传入小于分的值 | 科学计数法显示 |
| 负数 | 传入负数 | 正确显示负号/损失样式 |
| 零值 | 传入 `0` | 显示 "0" 或空状态 |
| 分数手数 | 传入 `10.5` 手 | 显示小数点 |
| 除零 | 分母为零 | 返回默认值，不崩溃 |

### 2. 字符串边缘 | String Edge Cases

| 边缘情况 | 测试方法 | 预期行为 |
|----------|----------|----------|
| `null` | 传入 `null` | 显示回退文本 |
| `undefined` | 传入 `undefined` | 显示回退文本 |
| 空字符串 `""` | 传入空字符串 | 显示回退文本 |
| 超长字符串 | 传入 200+ 字符 | 截断并显示 "..." |
| Unicode/Emoji | 传入 "中文🚀" | 正确渲染 |
| 特殊字符 | 传入 `&& < > "` | 正确转义显示 |

### 3. 数组边缘 | Array Edge Cases

| 边缘情况 | 测试方法 | 预期行为 |
|----------|----------|----------|
| `null` 数组 | 传入 `null` | 显示空状态 |
| 空数组 `[]` | 传入空数组 | 显示空状态提示 |
| 100+ 元素 | 传入大数组 | 限制显示数量 (如最近20条) |
| 无效元素 | 数组包含 `null` 项 | 跳过无效项，渲染有效项 |

### 4. 日期边缘 | Date Edge Cases

| 边缘情况 | 测试方法 | 预期行为 |
|----------|----------|----------|
| 空日期 | 传入 `null`/`""` | 显示 "未知日期" |
| 无效格式 | 传入 "not-a-date" | 原样显示或回退 |
| ISO 格式 | 传入 "2024-01-15T10:30:00Z" | 格式化为 YYYY-MM-DD |
| Unix 时间戳 | 传入数字时间戳 | 正确转换显示 |

### 5. 对象边缘 | Object Edge Cases

| 边缘情况 | 测试方法 | 预期行为 |
|----------|----------|----------|
| `null` 对象 | 传入 `null` | 显示回退UI |
| 缺失嵌套属性 | `result.backtestMeta` 为 `undefined` | 回退到 `config` 信息 |
| 部分缺失 | `trade.pnl` 为 `undefined` | 不显示 P&L 区域 |

### 6. 回调边缘 | Callback Edge Cases

| 边缘情况 | 测试方法 | 预期行为 |
|----------|----------|----------|
| 回调抛出异常 | `onError` 抛出错误 | 捕获错误，不崩溃 |
| 回调未提供 | `onApplyValue={undefined}` | 不渲染相关按钮 |
| 异步回调 | 回调返回 Promise | 正确等待完成 |

---

## 测试命令 | Test Commands

```bash
# 进入前端目录
cd lucrum-web

# 运行所有测试
bun run test

# 运行特定测试文件
bun run test -- enhanced-trade-card

# 运行带覆盖率的测试
bun run test:coverage

# 监视模式
bun run test -- --watch
```

---

## 覆盖率目标 | Coverage Targets

| 指标 | 目标 | 说明 |
|------|------|------|
| 语句 (Statements) | ≥ 85% | 执行的代码行 |
| 分支 (Branches) | ≥ 80% | if/else/三元分支 |
| 函数 (Functions) | ≥ 90% | 函数/方法调用 |
| 行数 (Lines) | ≥ 85% | 代码行覆盖 |

---

## 组件测试详情 | Component Test Details

### EnhancedTradeCard

**文件**: `src/components/strategy-editor/__tests__/enhanced-trade-card.test.tsx`

**测试分类**:
1. Null/Undefined 交易处理
2. 数值边缘情况 (NaN, Infinity, 极大/极小值)
3. 字符串边缘情况 (空/长文本/Unicode)
4. 日期格式处理
5. 交易类型验证 (buy/sell/invalid)
6. 错误回调行为
7. 指标值渲染
8. 市场名称映射
9. P&L 显示逻辑
10. Trade ID 显示

### BacktestBasisPanel

**文件**: `src/components/strategy-editor/__tests__/backtest-basis-panel.test.tsx`

**测试分类**:
1. Null/Undefined 结果处理
2. 元数据缺失回退
3. 数值边缘情况 (除零, NaN)
4. 日期格式处理
5. 数据质量徽章逻辑 (优秀/良好/一般/较差)
6. 市场名称映射
7. 数据源类型显示
8. 执行配置显示
9. 交易成本显示
10. 可选字段显示

### ParameterInfoDialog

**文件**: `src/components/strategy-editor/__tests__/parameter-info-dialog.test.tsx`

**测试分类**:
1. Null/Undefined 参数处理
2. 弹窗打开/关闭行为
3. 数值边缘情况 (NaN, Infinity, 无效范围)
4. 回调安全性 (onApplyValue, onClose)
5. 增强信息获取失败
6. 字符串边缘情况
7. 各区块显示
8. 底部信息显示

### BacktestPanel

**文件**: `src/components/strategy-editor/__tests__/backtest-panel.test.tsx`

**测试分类**:
1. 空/运行中/错误状态
2. 结果显示边缘情况
3. 交易列表压力测试 (100+ trades)
4. 交易渲染错误注入
5. 回调处理
6. 配置变更
7. 导出功能
8. API 错误处理

---

## Mock 策略 | Mock Strategy

### 全局 Mock (setup.ts)

| Mock 目标 | 原因 |
|-----------|------|
| ResizeObserver | happy-dom 不支持 |
| IntersectionObserver | happy-dom 不支持 |
| matchMedia | 响应式组件需要 |
| window.scrollTo | 避免测试警告 |
| Element.scrollIntoView | 滚动操作模拟 |
| fetch API | 隔离网络请求 |
| console.error | 捕获错误日志 |

### 组件级 Mock

```typescript
// Mock 外部模块
vi.mock('@/lib/strategy/enhanced-parameter-info', () => ({
  getEnhancedInfo: vi.fn((name) => { /* 返回模拟数据 */ }),
}));
```

---

## 测试数据工厂 | Test Data Factory

每个测试文件包含工厂函数，用于生成隔离的测试数据：

```typescript
// 示例：创建模拟交易
function createMockTrade(overrides: Partial<DetailedTrade> = {}): DetailedTrade {
  return {
    id: 'test-trade-001',
    type: 'buy',
    symbol: '600519',
    // ... 默认值
    ...overrides, // 允许覆盖特定字段
  };
}
```

**优势**:
- 每个测试使用独立数据
- 易于创建边缘情况数据
- 代码可读性高

---

## 最佳实践 | Best Practices

### 1. 测试隔离
- 每个测试用例独立运行
- `beforeEach` 重置所有 mocks
- 使用工厂函数生成数据

### 2. 边缘优先
- 先测试边缘情况，再测试正常路径
- 覆盖所有 `null`/`undefined` 可能
- 测试极端数值

### 3. 错误验证
- 使用 `onError` 回调捕获组件错误
- 验证错误UI正确渲染
- 确保不会因异常数据崩溃

### 4. 用户视角
- 使用 `screen.getByText()` 验证可见内容
- 使用 `userEvent` 模拟真实交互
- 验证无障碍属性

---

## 持续集成 | CI Integration

```bash
# GitHub Actions 示例
- name: Run Tests
  run: |
    cd lucrum-web
    bun install
    bun run test -- --reporter=verbose
    bun run test:coverage
```

---

## 参考 | References

- [Vitest 文档](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Happy DOM](https://github.com/capricorn86/happy-dom)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

---

## 附录：错误代码 | Appendix: Error Codes

| 组件 | 错误类型 | 处理方式 |
|------|----------|----------|
| EnhancedTradeCard | Invalid trade type | 渲染错误UI + 调用 onError |
| BacktestBasisPanel | Missing metadata | 回退到 config 信息 |
| ParameterInfoDialog | Enhanced info retrieval failed | 简单回退UI |
| BacktestPanel | API failure | 显示错误消息 |
