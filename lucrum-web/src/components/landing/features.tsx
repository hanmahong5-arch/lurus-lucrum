'use client'

import { cn } from '@/lib/utils'

const features = [
  {
    icon: '🗣️',
    title: '自然语言策略',
    titleEn: 'Natural Language Strategy',
    description: '用日常语言描述交易逻辑，AI自动转换为可执行代码',
    descriptionEn: 'Describe trading logic in plain language, AI converts to executable code',
    highlight: true,
  },
  {
    icon: '🤖',
    title: '混合决策系统',
    titleEn: 'Hybrid Decision System',
    description: '规则信号处理确定性逻辑，LLM分析模糊判断',
    descriptionEn: 'Rule-based signals + LLM analysis for fuzzy judgments',
  },
  {
    icon: '📊',
    title: 'ML Alpha因子',
    titleEn: 'ML Alpha Factors',
    description: '基于Polars高性能计算，支持Alpha101、Alpha158因子集',
    descriptionEn: 'High-performance factor computation with Alpha101/158 factor sets',
  },
  {
    icon: '🔍',
    title: 'AI决策透明',
    titleEn: 'Transparent AI Decisions',
    description: '完整的AI思维链展示，了解每个决策背后的逻辑',
    descriptionEn: 'Full chain-of-thought display for every AI decision',
  },
  {
    icon: '⚡',
    title: '实时风控',
    titleEn: 'Real-time Risk Control',
    description: '持仓风险、市场风险、策略风险多维度监控',
    descriptionEn: 'Multi-dimensional risk monitoring: position, market, strategy',
  },
  {
    icon: '🌐',
    title: '多市场支持',
    titleEn: 'Multi-Market Support',
    description: 'A股、期货、期权、海外市场全覆盖',
    descriptionEn: 'A-shares, futures, options, and international markets',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            为什么选择 <span className="text-gradient">Lucrum</span>
          </h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            结合VeighNa量化框架与DeepSeek大语言模型，打造下一代AI交易平台
            <span className="block text-base mt-2 text-white/40">
              Combining VeighNa framework with DeepSeek LLM for next-gen AI trading
            </span>
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className={cn(
                'group relative p-6 rounded-2xl transition-all duration-300',
                'bg-surface/50 border border-border hover:border-accent/50',
                'hover:shadow-lg hover:shadow-accent/5',
                feature.highlight && 'md:col-span-2 lg:col-span-1 border-accent/30 bg-accent/5'
              )}
            >
              {/* Icon */}
              <div className="text-4xl mb-4">{feature.icon}</div>

              {/* Title */}
              <h3 className="text-xl font-semibold text-white mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-white/40 mb-3">{feature.titleEn}</p>

              {/* Description */}
              <p className="text-white/60 mb-2">{feature.description}</p>
              <p className="text-sm text-white/40">{feature.descriptionEn}</p>

              {/* Hover effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
