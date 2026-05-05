/**
 * Tests for `lib/strategy/generate-shared` — these helpers are shared between
 * the JSON route and the streaming route; they MUST behave identically across
 * the two transports or the public-strategy cache will fragment.
 */

import { describe, expect, it } from 'vitest';
import {
  buildStrategyUserMessage,
  computeStrategyCacheKey,
  extractCode,
  extractCodeProgressively,
} from '../generate-shared';

describe('computeStrategyCacheKey', () => {
  it('is deterministic for the same prompt', () => {
    const a = computeStrategyCacheKey('双均线金叉买入死叉卖出');
    const b = computeStrategyCacheKey('双均线金叉买入死叉卖出');
    expect(a).toBe(b);
  });

  it('is whitespace- and case-insensitive (semantic dedup)', () => {
    const a = computeStrategyCacheKey('Double MA cross');
    const b = computeStrategyCacheKey('  double   ma   cross  ');
    expect(a).toBe(b);
  });

  it('produces different keys for different prompts', () => {
    const a = computeStrategyCacheKey('双均线');
    const b = computeStrategyCacheKey('RSI 超买超卖');
    expect(a).not.toBe(b);
  });
});

describe('buildStrategyUserMessage', () => {
  it('embeds the prompt verbatim after the leading instruction', () => {
    const msg = buildStrategyUserMessage('test prompt');
    expect(msg).toContain('test prompt');
    expect(msg.startsWith('请根据以下策略描述生成')).toBe(true);
  });
});

describe('extractCode', () => {
  it('extracts content from a fenced ```python block', () => {
    const raw = 'preamble\n```python\nclass Foo: pass\n```\nepilogue';
    expect(extractCode(raw)).toBe('class Foo: pass\n');
  });

  it('extracts content from a bare ``` block', () => {
    const raw = '```\nclass Bar: pass\n```';
    expect(extractCode(raw)).toBe('class Bar: pass\n');
  });

  it('returns the raw string when no fence is present', () => {
    const raw = 'class Baz: pass';
    expect(extractCode(raw)).toBe(raw);
  });
});

describe('extractCodeProgressively', () => {
  it('matches extractCode on a complete fenced block', () => {
    const raw = '```python\nclass Foo: pass\n```\n';
    expect(extractCodeProgressively(raw)).toBe(extractCode(raw));
  });

  it('strips the opener while the closing fence is still streaming', () => {
    const raw = '```python\nclass Foo:\n    def bar(self):\n        re';
    // No closing ``` yet — should still return the body without the opener.
    expect(extractCodeProgressively(raw)).toBe('class Foo:\n    def bar(self):\n        re');
  });

  it('strips a bare ``` opener mid-stream', () => {
    const raw = '```\nclass Foo: pa';
    expect(extractCodeProgressively(raw)).toBe('class Foo: pa');
  });

  it('returns raw text before any fence appears', () => {
    expect(extractCodeProgressively('class Foo')).toBe('class Foo');
  });

  it('returns raw text when the fence is empty', () => {
    expect(extractCodeProgressively('')).toBe('');
  });
});
