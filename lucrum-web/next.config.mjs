/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // Environment variables for runtime
  // 运行时环境变量
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "https://gushen.lurus.cn",
    USE_MOCK_DATA: process.env.USE_MOCK_DATA || "false",
    LURUS_API_URL:
      process.env.LURUS_API_URL ||
      "http://lurus-api.lurus-system.svc.cluster.local:8850",

    // Redis configuration
    // Redis 配置
    REDIS_ENABLED: process.env.REDIS_ENABLED || "true",
    REDIS_HOST:
      process.env.REDIS_HOST ||
      "redis-service.ai-qtrd.svc.cluster.local",
    REDIS_PORT: process.env.REDIS_PORT || "6379",
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || "",
    REDIS_DB: process.env.REDIS_DB || "0",
  },
};

export default nextConfig;
