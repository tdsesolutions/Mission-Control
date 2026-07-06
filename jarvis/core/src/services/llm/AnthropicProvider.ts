/**
 * Anthropic Provider
 *
 * First provider implementation behind the LLMProvider abstraction — not the
 * permanent architecture (owner decision, 2026-07-05). All Anthropic-specific
 * code is confined to this module.
 *
 * Privacy note: when this provider is selected, conversation text (not audio)
 * is sent to the Anthropic API. Selecting a local provider keeps everything
 * on-machine.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMRequest, LLMReply } from './types.js';

const DEFAULT_MODEL = 'claude-opus-4-8';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private client: Anthropic | null = null;

  constructor(options: { apiKey: string; model?: string; timeoutMs: number }) {
    this.apiKey = options.apiKey;
    this.model = options.model || DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: this.apiKey,
        timeout: this.timeoutMs, // TypeScript SDK timeout is in milliseconds
        maxRetries: 1,
      });
    }
    return this.client;
  }

  async generate(request: LLMRequest): Promise<LLMReply> {
    const response = await this.getClient().messages.create({
      model: this.model,
      max_tokens: request.maxTokens,
      system: request.system,
      // No temperature/top_p/top_k: removed on current Claude models (400).
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // Check stop_reason before reading content — a refusal can carry an
    // empty content array. Any no-text outcome throws; the conversation
    // pipeline owns the fallback to the template engine.
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!text) {
      throw new Error(`Anthropic returned no text (stop_reason: ${response.stop_reason})`);
    }

    return { text };
  }
}
