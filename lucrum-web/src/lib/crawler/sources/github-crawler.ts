/**
 * GitHub Strategy Crawler
 * GitHub策略爬虫
 *
 * Crawls quantitative trading strategies from GitHub:
 * - Awesome-Quant repository
 * - Popular trading strategy repositories
 * - Search for Python trading strategies
 *
 * 从GitHub爬取量化交易策略：
 * - Awesome-Quant仓库
 * - 流行的交易策略仓库
 * - 搜索Python交易策略
 */

import {
  BaseCrawler,
  detectIndicators,
  detectStrategyType,
} from '../base-crawler';
import type {
  StrategySource,
  CrawlerConfig,
  RawStrategyData,
  ProcessedStrategy,
  TargetMarket,
} from '../types';

// =============================================================================
// Types / 类型
// =============================================================================

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  language: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  owner: {
    login: string;
  };
}

interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
  content?: string;
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubRepo[];
}

// =============================================================================
// Constants / 常量
// =============================================================================

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Default repositories to crawl
 * 默认爬取的仓库
 */
const DEFAULT_REPOSITORIES = [
  'wilsonfreitas/awesome-quant',
  'microsoft/qlib',
  'stefan-jansen/machine-learning-for-trading',
  'vnpy/vnpy',
];

/**
 * Default search queries
 * 默认搜索查询
 */
const DEFAULT_SEARCH_QUERIES = [
  'python trading strategy stars:>50',
  'quantitative trading python stars:>30',
  'backtest python strategy stars:>20',
];

// =============================================================================
// GitHub Crawler Class / GitHub爬虫类
// =============================================================================

export class GitHubCrawler extends BaseCrawler {
  private token: string | undefined;

  constructor(config: Partial<CrawlerConfig> = {}) {
    super({
      ...config,
      source: 'github',
      maxStrategies: config.maxStrategies ?? 50,
      rateLimitMs: config.rateLimitMs ?? 2000, // GitHub rate limits
    });

    // Get GitHub token from environment
    // 从环境变量获取GitHub令牌
    this.token = process.env.GITHUB_TOKEN;
  }

  getSource(): StrategySource {
    return 'github';
  }

  /**
   * Fetch strategies from GitHub
   * 从GitHub获取策略
   */
  protected async fetchStrategies(): Promise<RawStrategyData[]> {
    const strategies: RawStrategyData[] = [];

    // 1. Crawl configured repositories
    // 1. 爬取配置的仓库
    const repos = this.config.github?.repositories ?? DEFAULT_REPOSITORIES;
    for (const repo of repos) {
      try {
        const repoStrategies = await this.crawlRepository(repo);
        strategies.push(...repoStrategies);
      } catch (error) {
        console.error(`[GitHubCrawler] Failed to crawl repo ${repo}:`, error);
      }
    }

    // 2. Search for additional strategies
    // 2. 搜索其他策略
    const searchQuery = this.config.github?.searchQuery;
    if (searchQuery) {
      try {
        const searchStrategies = await this.searchStrategies(searchQuery);
        strategies.push(...searchStrategies);
      } catch (error) {
        console.error('[GitHubCrawler] Search failed:', error);
      }
    }

    // Deduplicate by sourceId
    // 按sourceId去重
    const seen = new Set<string>();
    const unique = strategies.filter((s) => {
      if (seen.has(s.sourceId)) return false;
      seen.add(s.sourceId);
      return true;
    });

    // Limit to max strategies
    // 限制最大策略数
    return unique.slice(0, this.config.maxStrategies);
  }

  /**
   * Crawl a specific repository for strategies
   * 爬取特定仓库的策略
   */
  private async crawlRepository(repoPath: string): Promise<RawStrategyData[]> {
    const strategies: RawStrategyData[] = [];

    // Get repository info
    // 获取仓库信息
    const repoInfo = await this.fetchRepoInfo(repoPath);
    if (!repoInfo) return strategies;

    // For awesome-quant, parse the README
    // 对于awesome-quant，解析README
    if (repoPath.includes('awesome-quant')) {
      const awesomeStrategies = await this.parseAwesomeQuant(repoPath);
      return awesomeStrategies;
    }

    // For other repos, treat the repo itself as a strategy
    // 对于其他仓库，将仓库本身作为策略
    const strategy = await this.repoToStrategy(repoInfo);
    if (strategy) {
      strategies.push(strategy);
    }

    return strategies;
  }

  /**
   * Search for strategy repositories
   * 搜索策略仓库
   */
  private async searchStrategies(query: string): Promise<RawStrategyData[]> {
    const strategies: RawStrategyData[] = [];
    const minStars = this.config.github?.minStars ?? 10;

    try {
      const searchUrl = `${GITHUB_API_BASE}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=30`;
      const response = await this.fetchWithAuth(searchUrl);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = (await response.json()) as GitHubSearchResponse;

      for (const repo of data.items) {
        if (repo.stargazers_count >= minStars) {
          const strategy = await this.repoToStrategy(repo);
          if (strategy) {
            strategies.push(strategy);
          }
        }

        // Rate limiting
        await this.delay(this.config.rateLimitMs);
      }
    } catch (error) {
      console.error('[GitHubCrawler] Search error:', error);
    }

    return strategies;
  }

  /**
   * Parse awesome-quant README for strategy links
   * 解析awesome-quant的README获取策略链接
   */
  private async parseAwesomeQuant(repoPath: string): Promise<RawStrategyData[]> {
    const strategies: RawStrategyData[] = [];

    try {
      // Fetch README
      const readmeUrl = `${GITHUB_API_BASE}/repos/${repoPath}/readme`;
      const response = await this.fetchWithAuth(readmeUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch README: ${response.status}`);
      }

      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');

      // Parse markdown for GitHub links
      // 解析markdown中的GitHub链接
      const linkPattern = /\[([^\]]+)\]\((https:\/\/github\.com\/([^/]+\/[^/)]+))\)/g;
      let match;

      const links: { name: string; url: string; repoPath: string }[] = [];
      while ((match = linkPattern.exec(content)) !== null) {
        links.push({
          name: match[1] ?? '',
          url: match[2] ?? '',
          repoPath: match[3] ?? '',
        });
      }

      // Limit and process links
      const limitedLinks = links.slice(0, Math.min(links.length, this.config.maxStrategies));

      for (const link of limitedLinks) {
        try {
          const repoInfo = await this.fetchRepoInfo(link.repoPath);
          if (repoInfo) {
            const strategy = await this.repoToStrategy(repoInfo);
            if (strategy) {
              strategies.push(strategy);
            }
          }
        } catch {
          // Skip failed repos
        }

        await this.delay(this.config.rateLimitMs);
      }
    } catch (error) {
      console.error('[GitHubCrawler] Failed to parse awesome-quant:', error);
    }

    return strategies;
  }

  /**
   * Fetch repository information
   * 获取仓库信息
   */
  private async fetchRepoInfo(repoPath: string): Promise<GitHubRepo | null> {
    try {
      const url = `${GITHUB_API_BASE}/repos/${repoPath}`;
      const response = await this.fetchWithAuth(url);

      if (!response.ok) {
        return null;
      }

      return response.json() as Promise<GitHubRepo>;
    } catch {
      return null;
    }
  }

  /**
   * Convert repository to strategy data
   * 将仓库转换为策略数据
   */
  private async repoToStrategy(repo: GitHubRepo): Promise<RawStrategyData | null> {
    // Skip non-Python repos unless they have quant-related topics
    const isPython = repo.language?.toLowerCase() === 'python';
    const hasQuantTopics = repo.topics?.some((t) =>
      ['trading', 'quant', 'quantitative', 'strategy', 'backtest', 'algorithmic-trading'].includes(
        t.toLowerCase()
      )
    );

    if (!isPython && !hasQuantTopics) {
      return null;
    }

    // Try to fetch main strategy file
    let code: string | undefined;
    if (this.config.includeCode) {
      code = await this.fetchStrategyCode(repo.full_name);
    }

    return {
      source: 'github',
      sourceId: `github:${repo.id}`,
      name: repo.name,
      description: repo.description ?? undefined,
      author: repo.owner.login,
      code,
      url: repo.html_url,
      views: repo.watchers_count,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      tags: repo.topics,
      language: repo.language ?? 'Python',
      createdAt: new Date(repo.created_at),
      updatedAt: new Date(repo.updated_at),
    };
  }

  /**
   * Fetch strategy code from repository
   * 从仓库获取策略代码
   */
  private async fetchStrategyCode(repoPath: string): Promise<string | undefined> {
    try {
      // Look for common strategy file patterns
      const patterns = [
        'strategy.py',
        'strategies/main.py',
        'src/strategy.py',
        'trading_strategy.py',
        'main.py',
      ];

      for (const pattern of patterns) {
        try {
          const url = `${GITHUB_API_BASE}/repos/${repoPath}/contents/${pattern}`;
          const response = await this.fetchWithAuth(url);

          if (response.ok) {
            const data = await response.json();
            if (data.content) {
              return Buffer.from(data.content, 'base64').toString('utf-8');
            }
          }
        } catch {
          // Try next pattern
        }
      }

      // If no specific file found, try to get the first Python file
      const contentsUrl = `${GITHUB_API_BASE}/repos/${repoPath}/contents`;
      const response = await this.fetchWithAuth(contentsUrl);

      if (response.ok) {
        const contents = (await response.json()) as GitHubContent[];
        const pyFile = contents.find(
          (c) => c.type === 'file' && c.name.endsWith('.py') && c.download_url
        );

        if (pyFile?.download_url) {
          const codeResponse = await fetch(pyFile.download_url);
          if (codeResponse.ok) {
            return codeResponse.text();
          }
        }
      }
    } catch {
      // Code fetch failed, return undefined
    }

    return undefined;
  }

  /**
   * Classify strategy type and extract indicators
   * 分类策略类型并提取指标
   */
  protected async classifyStrategy(
    raw: RawStrategyData
  ): Promise<Pick<ProcessedStrategy, 'strategyType' | 'markets' | 'indicators'>> {
    const textToAnalyze = [raw.name, raw.description, raw.code].filter(Boolean).join(' ');

    // Detect strategy type
    // 检测策略类型
    const strategyType = detectStrategyType(textToAnalyze);

    // Detect indicators
    // 检测指标
    const indicators = detectIndicators(textToAnalyze);

    // Detect target markets
    // 检测目标市场
    const markets: TargetMarket[] = [];
    const marketPatterns: [RegExp, TargetMarket][] = [
      [/stock|equity|a\-?share|a股|股票/i, 'stock'],
      [/futures|期货|ctp/i, 'futures'],
      [/crypto|bitcoin|btc|eth|加密/i, 'crypto'],
      [/options|期权/i, 'options'],
      [/forex|外汇|fx/i, 'forex'],
    ];

    for (const [pattern, market] of marketPatterns) {
      if (pattern.test(textToAnalyze)) {
        markets.push(market);
      }
    }

    // Default to stock if no market detected
    if (markets.length === 0) {
      markets.push('stock');
    }

    return {
      strategyType,
      markets,
      indicators,
    };
  }

  /**
   * Fetch with authentication
   * 带认证的请求
   */
  private async fetchWithAuth(url: string): Promise<Response> {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Lucrum-Crawler/1.0',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return this.retry(() =>
      fetch(url, { headers })
    );
  }
}

// =============================================================================
// Factory Function / 工厂函数
// =============================================================================

/**
 * Create a GitHub crawler instance
 * 创建GitHub爬虫实例
 */
export function createGitHubCrawler(config?: Partial<CrawlerConfig>): GitHubCrawler {
  return new GitHubCrawler(config);
}
