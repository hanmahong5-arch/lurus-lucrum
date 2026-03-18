import { describe, it, expect } from 'vitest';
import {
  success,
  failure,
  isSuccess,
  isFailure,
  unwrap,
  unwrapOr,
  mapResult,
  chainResult,
} from '../core/interfaces';
import type { ErrorInfo } from '../core/interfaces';

const mockError: ErrorInfo = {
  code: 'BT100',
  message: 'Test error',
  messageEn: 'Test error',
  recoverable: false,
};

describe('Result utility functions', () => {
  describe('success', () => {
    it('creates a success result with data', () => {
      const result = success(42);
      expect(result).toEqual({ success: true, data: 42 });
    });

    it('creates a success result with complex data', () => {
      const data = { name: 'test', values: [1, 2, 3] };
      const result = success(data);
      expect(result).toEqual({ success: true, data });
    });
  });

  describe('failure', () => {
    it('creates a failure result with error info', () => {
      const result = failure<number>(mockError);
      expect(result).toEqual({ success: false, error: mockError });
    });
  });

  describe('isSuccess', () => {
    it('returns true for success result', () => {
      expect(isSuccess(success('ok'))).toBe(true);
    });

    it('returns false for failure result', () => {
      expect(isSuccess(failure(mockError))).toBe(false);
    });
  });

  describe('isFailure', () => {
    it('returns true for failure result', () => {
      expect(isFailure(failure(mockError))).toBe(true);
    });

    it('returns false for success result', () => {
      expect(isFailure(success(1))).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('returns data from success result', () => {
      expect(unwrap(success('hello'))).toBe('hello');
    });

    it('throws on failure result with code and message', () => {
      expect(() => unwrap(failure(mockError))).toThrow('BT100: Test error');
    });
  });

  describe('unwrapOr', () => {
    it('returns data from success result', () => {
      expect(unwrapOr(success(10), 0)).toBe(10);
    });

    it('returns default value from failure result', () => {
      expect(unwrapOr(failure<number>(mockError), 99)).toBe(99);
    });
  });

  describe('mapResult', () => {
    it('applies function to success data', () => {
      const result = mapResult(success(5), (x) => x * 2);
      expect(result).toEqual({ success: true, data: 10 });
    });

    it('passes through failure unchanged', () => {
      const fail = failure<number>(mockError);
      const result = mapResult(fail, (x) => x * 2);
      expect(result).toEqual({ success: false, error: mockError });
    });
  });

  describe('chainResult', () => {
    it('chains async function on success', async () => {
      const result = await chainResult(success(3), async (x) =>
        success(String(x))
      );
      expect(result).toEqual({ success: true, data: '3' });
    });

    it('short-circuits on failure', async () => {
      const fail = failure<number>(mockError);
      const fn = async (x: number) => success(String(x));
      const result = await chainResult(fail, fn);
      expect(result).toEqual({ success: false, error: mockError });
    });

    it('propagates failure from chained function', async () => {
      const chainedError: ErrorInfo = { code: 'BT200', message: 'Chain fail', messageEn: 'Chain fail', recoverable: false };
      const result = await chainResult(success(1), async () =>
        failure<string>(chainedError)
      );
      expect(result).toEqual({ success: false, error: chainedError });
    });
  });
});
