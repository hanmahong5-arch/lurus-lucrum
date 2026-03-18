/**
 * Strategy Code Converter
 * 策略代码转换器
 *
 * Converts strategy code from various formats to VeighNa/vnpy compatible code.
 * Uses LLM (DeepSeek) for intelligent code transformation.
 *
 * 将各种格式的策略代码转换为VeighNa/vnpy兼容的代码
 * 使用LLM（DeepSeek）进行智能代码转换
 */

import type { ConversionRequest, ConversionResult } from './types';

// =============================================================================
// Types / 类型
// =============================================================================

interface LLMResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

// =============================================================================
// Constants / 常量
// =============================================================================

const VEIGHNA_TEMPLATE = `
from vnpy_ctastrategy import (
    CtaTemplate,
    StopOrder,
    TickData,
    BarData,
    TradeData,
    OrderData,
)

class {CLASS_NAME}(CtaTemplate):
    """
    {DESCRIPTION}
    """
    author = "{AUTHOR}"

    # Parameters / 参数
{PARAMETERS}

    # Variables / 变量
{VARIABLES}

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)
{INIT_CODE}

    def on_init(self):
        """Initialize strategy"""
        self.write_log("Strategy initialized")
        self.load_bar(10)

    def on_start(self):
        """Start strategy"""
        self.write_log("Strategy started")

    def on_stop(self):
        """Stop strategy"""
        self.write_log("Strategy stopped")

    def on_tick(self, tick: TickData):
        """Handle tick data"""
        pass

    def on_bar(self, bar: BarData):
        """Handle bar data"""
{ON_BAR_CODE}

    def on_order(self, order: OrderData):
        """Handle order update"""
        pass

    def on_trade(self, trade: TradeData):
        """Handle trade execution"""
        pass

    def on_stop_order(self, stop_order: StopOrder):
        """Handle stop order update"""
        pass
`;

const CONVERSION_PROMPT = `You are an expert Python developer specializing in quantitative trading.
Convert the following trading strategy code to VeighNa/vnpy CTA strategy format.

Original code:
\`\`\`python
{ORIGINAL_CODE}
\`\`\`

Strategy metadata:
- Name: {NAME}
- Description: {DESCRIPTION}
- Detected indicators: {INDICATORS}

Requirements:
1. Create a class that inherits from CtaTemplate
2. Define all parameters as class attributes with proper types
3. Initialize indicators in on_init() using ArrayManager
4. Implement trading logic in on_bar() method
5. Use proper vnpy functions: buy(), sell(), short(), cover()
6. Include proper position management
7. Add Chinese and English comments

Output ONLY the complete Python code, no explanations.
The code must be valid Python and follow vnpy conventions.`;

// =============================================================================
// Strategy Converter Class / 策略转换器类
// =============================================================================

/**
 * Strategy code converter using LLM
 * 使用LLM的策略代码转换器
 */
export class StrategyConverter {
  private apiUrl: string;
  private apiKey: string;
  private model: string;

  constructor(config?: {
    apiUrl?: string;
    apiKey?: string;
    model?: string;
  }) {
    this.apiUrl = config?.apiUrl ?? process.env.LLM_API_URL ?? 'https://api.deepseek.com/v1';
    this.apiKey = config?.apiKey ?? process.env.LLM_API_KEY ?? '';
    this.model = config?.model ?? 'deepseek-coder';
  }

  /**
   * Convert strategy code to VeighNa format
   * 将策略代码转换为VeighNa格式
   */
  async convert(request: ConversionRequest): Promise<ConversionResult> {
    // Validate input
    // 验证输入
    if (!request.originalCode || request.originalCode.trim().length === 0) {
      return {
        success: false,
        error: 'Original code is empty',
      };
    }

    // Check if already vnpy compatible
    // 检查是否已经兼容vnpy
    if (this.isVnpyCompatible(request.originalCode)) {
      return {
        success: true,
        convertedCode: request.originalCode,
        confidence: 1.0,
        warnings: ['Code appears to already be vnpy compatible'],
      };
    }

    // Try LLM conversion
    // 尝试LLM转换
    try {
      const convertedCode = await this.convertWithLLM(request);

      // Validate converted code
      // 验证转换后的代码
      const validation = this.validateConvertedCode(convertedCode);

      if (validation.valid) {
        return {
          success: true,
          convertedCode,
          confidence: validation.confidence,
          warnings: validation.warnings,
        };
      } else {
        return {
          success: false,
          error: validation.error,
          warnings: validation.warnings,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Conversion failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check if code is already vnpy compatible
   * 检查代码是否已经兼容vnpy
   */
  private isVnpyCompatible(code: string): boolean {
    const vnpyPatterns = [
      /class\s+\w+\s*\(\s*CtaTemplate\s*\)/,
      /from\s+vnpy/,
      /from\s+vnpy_ctastrategy/,
    ];

    return vnpyPatterns.some((pattern) => pattern.test(code));
  }

  /**
   * Convert code using LLM
   * 使用LLM转换代码
   */
  private async convertWithLLM(request: ConversionRequest): Promise<string> {
    if (!this.apiKey) {
      // Fall back to template-based conversion
      // 回退到基于模板的转换
      return this.templateBasedConversion(request);
    }

    const prompt = CONVERSION_PROMPT
      .replace('{ORIGINAL_CODE}', request.originalCode)
      .replace('{NAME}', request.metadata?.name ?? 'ConvertedStrategy')
      .replace('{DESCRIPTION}', request.metadata?.description ?? 'Converted strategy')
      .replace('{INDICATORS}', request.metadata?.indicators?.join(', ') ?? 'unknown');

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert Python developer for quantitative trading.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = (await response.json()) as LLMResponse;
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    // Extract code from markdown if present
    // 如果存在markdown则提取代码
    const codeMatch = content.match(/```python\n([\s\S]*?)```/) ||
                      content.match(/```\n([\s\S]*?)```/);

    return codeMatch?.[1]?.trim() ?? content.trim();
  }

  /**
   * Template-based conversion fallback
   * 基于模板的转换回退
   */
  private templateBasedConversion(request: ConversionRequest): string {
    const className = this.extractClassName(request.originalCode) ?? 'ConvertedStrategy';
    const description = request.metadata?.description ?? 'Converted strategy';
    const parameters = this.extractParameters(request.originalCode);
    const variables = this.extractVariables(request.originalCode);
    const logic = this.extractTradingLogic(request.originalCode);

    return VEIGHNA_TEMPLATE
      .replace('{CLASS_NAME}', className)
      .replace('{DESCRIPTION}', description)
      .replace('{AUTHOR}', 'Lucrum Converter')
      .replace('{PARAMETERS}', parameters)
      .replace('{VARIABLES}', variables)
      .replace('{INIT_CODE}', '        pass')
      .replace('{ON_BAR_CODE}', logic);
  }

  /**
   * Extract class name from original code
   * 从原始代码提取类名
   */
  private extractClassName(code: string): string | null {
    const match = code.match(/class\s+(\w+)/);
    return match?.[1] ?? null;
  }

  /**
   * Extract parameters from original code
   * 从原始代码提取参数
   */
  private extractParameters(code: string): string {
    const params: string[] = [];
    const patterns = [
      /(\w+)\s*=\s*(\d+(?:\.\d+)?)/g, // number assignments
      /(\w+)\s*:\s*(?:int|float)\s*=\s*(\d+(?:\.\d+)?)/g, // typed assignments
    ];

    const seen = new Set<string>();
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const name = match[1];
        const value = match[2];
        if (name && value && !seen.has(name) && !this.isReservedWord(name)) {
          seen.add(name);
          params.push(`    ${name} = ${value}`);
        }
      }
    }

    return params.length > 0 ? params.join('\n') : '    # No parameters extracted';
  }

  /**
   * Extract variables from original code
   * 从原始代码提取变量
   */
  private extractVariables(code: string): string {
    return `    pos = 0
    am = None`;
  }

  /**
   * Extract trading logic from original code
   * 从原始代码提取交易逻辑
   */
  private extractTradingLogic(code: string): string {
    // Look for buy/sell conditions
    const buyCondition = code.match(/if\s+(.+?)\s*:\s*(?:buy|long)/i);
    const sellCondition = code.match(/if\s+(.+?)\s*:\s*(?:sell|short)/i);

    const lines = [
      '        # Update ArrayManager',
      '        am = self.am',
      '        am.update_bar(bar)',
      '        if not am.inited:',
      '            return',
      '',
      '        # Calculate indicators',
      '        # TODO: Add indicator calculations',
      '',
      '        # Trading logic',
    ];

    if (buyCondition) {
      lines.push(`        # Original buy condition: ${buyCondition[1]}`);
      lines.push('        # if buy_condition:');
      lines.push('        #     self.buy(bar.close_price, 1)');
    }

    if (sellCondition) {
      lines.push(`        # Original sell condition: ${sellCondition[1]}`);
      lines.push('        # if sell_condition:');
      lines.push('        #     self.sell(bar.close_price, 1)');
    }

    return lines.join('\n');
  }

  /**
   * Validate converted code
   * 验证转换后的代码
   */
  private validateConvertedCode(code: string): {
    valid: boolean;
    confidence: number;
    error?: string;
    warnings?: string[];
  } {
    const warnings: string[] = [];
    let confidence = 1.0;

    // Check for class definition
    if (!code.match(/class\s+\w+\s*\(\s*CtaTemplate\s*\)/)) {
      return {
        valid: false,
        confidence: 0,
        error: 'Missing CtaTemplate class definition',
      };
    }

    // Check for required methods
    const requiredMethods = ['on_init', 'on_bar'];
    for (const method of requiredMethods) {
      if (!code.includes(`def ${method}`)) {
        warnings.push(`Missing ${method} method`);
        confidence -= 0.1;
      }
    }

    // Check for vnpy imports
    if (!code.includes('vnpy')) {
      warnings.push('Missing vnpy imports');
      confidence -= 0.1;
    }

    // Check for trading functions
    const tradingFuncs = ['buy', 'sell', 'short', 'cover'];
    const hasTradingFunc = tradingFuncs.some((f) => code.includes(`self.${f}(`));
    if (!hasTradingFunc) {
      warnings.push('No trading functions found');
      confidence -= 0.2;
    }

    return {
      valid: true,
      confidence: Math.max(0.3, confidence),
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Check if word is reserved
   * 检查是否为保留字
   */
  private isReservedWord(word: string): boolean {
    const reserved = [
      'if', 'else', 'for', 'while', 'def', 'class', 'return', 'import', 'from',
      'True', 'False', 'None', 'self', 'and', 'or', 'not', 'in', 'is',
    ];
    return reserved.includes(word);
  }
}

// =============================================================================
// Factory Function / 工厂函数
// =============================================================================

let converterInstance: StrategyConverter | null = null;

/**
 * Get strategy converter instance (singleton)
 * 获取策略转换器实例（单例）
 */
export function getStrategyConverter(): StrategyConverter {
  if (!converterInstance) {
    converterInstance = new StrategyConverter();
  }
  return converterInstance;
}

/**
 * Convert strategy code
 * 转换策略代码
 */
export async function convertStrategy(request: ConversionRequest): Promise<ConversionResult> {
  const converter = getStrategyConverter();
  return converter.convert(request);
}
