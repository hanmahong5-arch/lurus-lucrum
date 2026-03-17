/**
 * Shared Strategy Types
 */

export interface Strategy {
  id: string;
  name: string;
  description: string;
  code: string;
  params: Record<string, number>;
  indicators: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StrategyGenerateRequest {
  prompt: string;
  style?: "aggressive" | "conservative" | "balanced";
  indicators?: string[];
}

export interface StrategyGenerateResponse {
  strategy: Strategy;
  explanation: string;
}
