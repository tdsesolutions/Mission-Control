/**
 * OpenAI-Compatible Provider
 *
 * Speaks the de-facto-standard `/v1/chat/completions` shape, which covers
 * local model runtimes (Ollama, LM Studio, llama.cpp server, vLLM), OpenAI
 * itself, and most other hosted providers. This is the fully-local path:
 * pointed at a localhost runtime, no conversation data leaves the machine.
 */

import type { LLMProvider, LLMRequest, LLMReply } from './types.js';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = 'openai-compatible';
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: { baseUrl: string; apiKey?: string; model?: string }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey || '';
    this.model = options.model || '';
  }

  isConfigured(): boolean {
    return this.baseUrl.length > 0 && this.model.length > 0;
  }

  async generate(request: LLMRequest): Promise<LLMReply> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxTokens,
          messages: [
            { role: 'system', content: request.system },
            ...request.messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`${this.baseUrl} returned HTTP ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = (await response.json()) as ChatCompletionResponse;
      const text = data.choices?.[0]?.message?.content?.trim();

      if (!text) {
        throw new Error(
          `No completion text from ${this.model} (${data.error?.message || 'empty choices'})`,
        );
      }

      return { text };
    } finally {
      clearTimeout(timeout);
    }
  }
}
