/**
 * LLM Provider Abstraction
 *
 * Kiaros is model-agnostic by constitutional mandate: no provider or model
 * may ever be hardcoded into Kiaros itself (owner decision, 2026-07-05).
 * All provider-specific logic lives in provider modules implementing this
 * interface; everything else in Kiaros talks only to these types. Adding a
 * future provider (local models, OpenAI, OpenClaw, Hermes, ...) means adding
 * one module and one registry entry — never changing Kiaros.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  /** System prompt (persona, constraints, context hints). */
  system: string;
  /** Conversation history, oldest first, ending with the current user turn. */
  messages: ChatMessage[];
  /** Upper bound on generated tokens. */
  maxTokens: number;
  /** Wall-clock budget for the call in milliseconds. */
  timeoutMs: number;
}

export interface LLMReply {
  text: string;
}

export interface LLMProvider {
  /** Stable identifier, e.g. 'anthropic', 'openai-compatible'. */
  readonly name: string;
  /** Human-readable model identifier used for logging/metadata. */
  readonly model: string;
  /** True when the provider has the configuration it needs to attempt calls. */
  isConfigured(): boolean;
  /** Generate a reply. Throws on any failure — callers own the fallback. */
  generate(request: LLMRequest): Promise<LLMReply>;
}
