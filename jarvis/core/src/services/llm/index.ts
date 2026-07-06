/**
 * LLM Provider Registry
 *
 * The ONLY place that knows which providers exist. Selection is pure
 * configuration (jarvis/.env) — switching providers or models requires no
 * change to Kiaros code (Constitution + owner decision, 2026-07-05).
 *
 *   KIAROS_LLM_PROVIDER = anthropic | openai-compatible | none | auto (default)
 *
 * 'auto' picks the first configured provider: anthropic (if ANTHROPIC_API_KEY
 * is set), else openai-compatible (if OPENAI_COMPAT_BASE_URL + model are
 * set), else none. With no provider configured, Kiaros falls back to the
 * built-in template responses and keeps working — the LLM is an enhancement,
 * never a hard dependency.
 */

import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import type { LLMProvider } from './types.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';

export type { LLMProvider, LLMRequest, LLMReply, ChatMessage } from './types.js';

let resolved = false;
let activeProvider: LLMProvider | null = null;

function buildProvider(): LLMProvider | null {
  const llm = config.llm;

  const anthropic = new AnthropicProvider({
    apiKey: llm.anthropic.apiKey,
    model: llm.model || undefined,
    timeoutMs: llm.timeoutMs,
  });

  const openaiCompat = new OpenAICompatibleProvider({
    baseUrl: llm.openaiCompat.baseUrl,
    apiKey: llm.openaiCompat.apiKey,
    model: llm.model || llm.openaiCompat.model,
  });

  switch (llm.provider) {
    case 'anthropic':
      return anthropic.isConfigured() ? anthropic : null;
    case 'openai-compatible':
      return openaiCompat.isConfigured() ? openaiCompat : null;
    case 'none':
      return null;
    case 'auto':
    default:
      if (anthropic.isConfigured()) return anthropic;
      if (openaiCompat.isConfigured()) return openaiCompat;
      return null;
  }
}

export function getLLMProvider(): LLMProvider | null {
  if (!resolved) {
    activeProvider = buildProvider();
    resolved = true;
    if (activeProvider) {
      logger.info(
        `LLM provider active: ${activeProvider.name} (model: ${activeProvider.model})`,
      );
    } else {
      logger.info(
        `LLM provider: none configured (KIAROS_LLM_PROVIDER=${config.llm.provider}) — using template responses`,
      );
    }
  }
  return activeProvider;
}
