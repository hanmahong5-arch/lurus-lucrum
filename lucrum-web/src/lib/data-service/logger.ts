/**
 * Data Service Logger
 * 数据服务日志记录器
 *
 * Structured logging with levels, metrics collection, and observability
 * 结构化日志记录，支持级别、指标收集和可观测性
 */

import type {
  LogLevel,
  LogEntry,
  RequestMetrics,
  ServiceHealth,
  ServiceStats,
} from "./types";

// =============================================================================
// LOGGER IMPLEMENTATION / 日志记录器实现
// =============================================================================

/**
 * Structured logger for data service
 * 数据服务结构化日志记录器
 */
class DataServiceLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private minLevel: LogLevel = "info";
  private metrics: RequestMetrics[] = [];
  private maxMetrics: number = 500;
  private healthChecks: Map<string, ServiceHealth> = new Map();
  private startTime: number = Date.now();
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private totalLatency: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  /**
   * Set minimum log level
   * 设置最小日志级别
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Log a message
   * 记录日志
   */
  private log(
    level: LogLevel,
    source: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (this.levelPriority[level] < this.levelPriority[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      source,
      message,
      metadata,
    };

    this.logs.push(entry);

    // Trim logs if exceeds max
    // 超过最大值时修剪日志
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with formatting
    // 控制台格式化输出
    const time = new Date(entry.timestamp).toISOString();
    const prefix = `[${time}] [${level.toUpperCase()}] [${source}]`;

    switch (level) {
      case "debug":
        console.debug(prefix, message, metadata ?? "");
        break;
      case "info":
        console.info(prefix, message, metadata ?? "");
        break;
      case "warn":
        console.warn(prefix, message, metadata ?? "");
        break;
      case "error":
        console.error(prefix, message, metadata ?? "");
        break;
    }
  }

  debug(
    source: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.log("debug", source, message, metadata);
  }

  info(
    source: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.log("info", source, message, metadata);
  }

  warn(
    source: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.log("warn", source, message, metadata);
  }

  error(
    source: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.log("error", source, message, metadata);
  }

  /**
   * Record request metrics
   * 记录请求指标
   */
  recordRequest(metrics: RequestMetrics): void {
    this.metrics.push(metrics);

    // Update aggregated stats
    // 更新聚合统计
    this.totalRequests++;
    this.totalLatency += metrics.latency;

    if (metrics.status === "success") {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    if (metrics.cached) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    // Update health for this source
    // 更新数据源健康状态
    this.updateHealth(metrics);

    // Trim metrics if exceeds max
    // 超过最大值时修剪指标
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log the request
    // 记录请求
    const logLevel = metrics.status === "error" ? "error" : "debug";
    this.log(
      logLevel,
      metrics.source,
      `${metrics.method} ${metrics.endpoint}`,
      {
        status: metrics.status,
        latency: metrics.latency,
        cached: metrics.cached,
        statusCode: metrics.statusCode,
        error: metrics.errorMessage,
      },
    );
  }

  /**
   * Update health status for a data source
   * 更新数据源健康状态
   */
  private updateHealth(metrics: RequestMetrics): void {
    const existing = this.healthChecks.get(metrics.source);
    const now = Date.now();

    // Calculate recent metrics for this source
    // 计算此数据源的最近指标
    const recentMetrics = this.metrics
      .filter((m) => m.source === metrics.source && now - m.endTime < 300000) // Last 5 minutes
      .slice(-100);

    const successCount = recentMetrics.filter(
      (m) => m.status === "success",
    ).length;
    const errorCount = recentMetrics.filter(
      (m) => m.status !== "success",
    ).length;
    const successRate =
      recentMetrics.length > 0 ? successCount / recentMetrics.length : 1;
    const avgLatency =
      recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.latency, 0) /
          recentMetrics.length
        : 0;

    // Determine health status
    // 确定健康状态
    let status: ServiceHealth["status"] = "healthy";
    if (successRate < 0.5 || errorCount > 10) {
      status = "unhealthy";
    } else if (successRate < 0.9 || avgLatency > 5000) {
      status = "degraded";
    }

    const health: ServiceHealth = {
      source: metrics.source,
      status,
      lastCheck: now,
      latency: avgLatency,
      successRate,
      errorCount,
      lastError:
        metrics.status === "error" ? metrics.errorMessage : existing?.lastError,
    };

    this.healthChecks.set(metrics.source, health);
  }

  /**
   * Get health status for a source
   * 获取数据源健康状态
   */
  getHealth(source: string): ServiceHealth | null {
    return this.healthChecks.get(source) ?? null;
  }

  /**
   * Get all health statuses
   * 获取所有健康状态
   */
  getAllHealth(): ServiceHealth[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get aggregated service statistics
   * 获取聚合服务统计
   */
  getStats(): ServiceStats {
    const cacheTotal = this.cacheHits + this.cacheMisses;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      averageLatency:
        this.totalRequests > 0 ? this.totalLatency / this.totalRequests : 0,
      cacheHitRate: cacheTotal > 0 ? this.cacheHits / cacheTotal : 0,
      healthStatus: this.getAllHealth(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get recent logs
   * 获取最近日志
   */
  getLogs(
    options: {
      level?: LogLevel;
      source?: string;
      limit?: number;
      since?: number;
    } = {},
  ): LogEntry[] {
    let filtered = this.logs;

    if (options.level) {
      const minPriority = this.levelPriority[options.level];
      filtered = filtered.filter(
        (log) => this.levelPriority[log.level] >= minPriority,
      );
    }

    if (options.source) {
      filtered = filtered.filter((log) => log.source === options.source);
    }

    if (options.since) {
      const since = options.since;
      filtered = filtered.filter((log) => log.timestamp >= since);
    }

    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Get recent metrics
   * 获取最近指标
   */
  getMetrics(
    options: {
      source?: string;
      limit?: number;
      since?: number;
    } = {},
  ): RequestMetrics[] {
    let filtered = this.metrics;

    if (options.source) {
      filtered = filtered.filter((m) => m.source === options.source);
    }

    if (options.since) {
      const since = options.since;
      filtered = filtered.filter((m) => m.endTime >= since);
    }

    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Clear all data (for testing)
   * 清空所有数据（测试用）
   */
  clear(): void {
    this.logs = [];
    this.metrics = [];
    this.healthChecks.clear();
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.totalLatency = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// =============================================================================
// SINGLETON INSTANCE / 单例实例
// =============================================================================

export const logger = new DataServiceLogger();

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Generate a unique request ID
 * 生成唯一请求ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a request metrics object for tracking
 * 创建请求指标对象用于跟踪
 */
export function createRequestTracker(
  source: string,
  endpoint: string,
  method: string = "GET",
): {
  requestId: string;
  startTime: number;
  complete: (
    status: RequestMetrics["status"],
    options?: {
      statusCode?: number;
      cached?: boolean;
      errorMessage?: string;
    },
  ) => RequestMetrics;
} {
  const requestId = generateRequestId();
  const startTime = Date.now();

  return {
    requestId,
    startTime,
    complete: (status, options = {}) => {
      const endTime = Date.now();
      const metrics: RequestMetrics = {
        requestId,
        source,
        endpoint,
        method,
        startTime,
        endTime,
        latency: endTime - startTime,
        status,
        statusCode: options.statusCode,
        cached: options.cached ?? false,
        errorMessage: options.errorMessage,
      };

      logger.recordRequest(metrics);
      return metrics;
    },
  };
}
