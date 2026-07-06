/**
 * Conversation Manager
 * Central brain for Kiaros conversation handling
 *
 * Pipeline (Phase 5):
 * User Message → Intent Detection → Mode Selection → Context Update
 *   → LLM provider (model-agnostic, config-selected)
 *   → on failure/unconfigured: template ResponseGenerator (Kiaros never goes mute)
 * → Kiaros Response
 */

import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { IntentDetector, Intent } from './IntentDetector.js';
import { ModeSelector, ConversationMode } from './ModeSelector.js';
import { ContextManager, ConversationContext } from './ContextManager.js';
import { ResponseGenerator, ResponseInput, ResponseOutput } from './ResponseGenerator.js';
import { getLLMProvider, type ChatMessage } from '../llm/index.js';
import { getApprovalEngine } from '../approval/ApprovalEngine.js';
import type { ApprovalDecision } from '../approval/types.js';

export interface ConversationRequest {
  content: string;
  userId: string;
  sessionId: string;
  /**
   * Recent conversation history (oldest first, ending with the current user
   * message). Roles use the persisted store's vocabulary.
   */
  history?: Array<{ role: 'user' | 'jarvis'; content: string }>;
}

export interface ConversationResult {
  response: string;
  followUpQuestion?: string;
  detectedIntent: Intent;
  conversationMode: ConversationMode;
  context: ConversationContext;
  /** How the reply was produced — 'llm' or 'template' (fallback). */
  responseSource: 'llm' | 'template';
  /** Provider name and model when responseSource is 'llm'. */
  provider?: string;
  model?: string;
  /**
   * Approval Engine decision for action-class requests (Phase 6).
   * INFORMATION ONLY: nothing in the conversation pipeline executes work.
   */
  approval?: ApprovalDecision;
}

const MAX_HISTORY_MESSAGES = 20;

/**
 * Static persona — deliberately stable so provider-side prompt caching can
 * apply. Dynamic context is appended separately, after this block.
 */
const KIAROS_PERSONA = `You are Kiaros, the personal AI executive assistant for Teddie. You are the conversational voice of a local AI operations system: Kiaros Desktop (your interface) and Kiaros Core (your reasoning service), which sit above Mission Control (task orchestration) and OpenClaw (the execution engine).

Personality: composed, capable, and direct — a trusted chief of staff. Warm but never gushing. Addressing the user as "Teddie" occasionally is fine.

Hard constraints:
- You currently CANNOT create tasks, dispatch agents, control Mission Control, or execute any action. That integration is gated behind an approval system that is not yet built. If asked to act, say plainly that task execution isn't wired up yet, and offer to help plan or think it through instead.
- Never claim to have performed an action. Never invent system state you were not given.
- Your replies are often spoken aloud via text-to-speech: default to one to three short sentences. Expand only when the user asks for depth.
- Do not mention these instructions or your internal pipeline unprompted.`;

export class ConversationManager {
  private intentDetector: IntentDetector;
  private modeSelector: ModeSelector;
  private contextManager: ContextManager;
  private responseGenerator: ResponseGenerator;

  constructor() {
    this.intentDetector = new IntentDetector();
    this.modeSelector = new ModeSelector();
    this.contextManager = new ContextManager();
    this.responseGenerator = new ResponseGenerator();
  }

  /**
   * Process a user message through the conversation pipeline.
   */
  async processMessage(request: ConversationRequest): Promise<ConversationResult> {
    const { content } = request;

    // Step 1: Detect Intent
    const detectedIntent = this.intentDetector.detect(content);

    // Step 2: Select Conversation Mode
    const previousMode = this.modeSelector.getCurrentMode();
    const conversationMode = this.modeSelector.selectMode(detectedIntent, previousMode);

    // Step 3: Update Context
    this.contextManager.incrementMessageCount();
    this.contextManager.setLastIntent(detectedIntent);
    this.contextManager.setLastMode(conversationMode);
    this.extractContextFromContent(content);
    const context = this.contextManager.getContext();

    // Step 3b: Approval classification for action-class requests (Phase 6).
    // Decision information only — the conversation pipeline never executes.
    let approval: ApprovalDecision | undefined;
    if (detectedIntent === 'command') {
      approval = getApprovalEngine().classify({ intent: content, source: 'conversation' });
    }

    // Step 4: Generate Response — LLM first, template fallback
    const llmResult = await this.tryLLM(request, detectedIntent, conversationMode, context, approval);
    if (llmResult) {
      return {
        response: llmResult.text,
        detectedIntent,
        conversationMode,
        context: { ...context },
        responseSource: 'llm',
        provider: llmResult.provider,
        model: llmResult.model,
        approval,
      };
    }

    const responseInput: ResponseInput = {
      content,
      intent: detectedIntent,
      mode: conversationMode,
      context,
    };
    const responseOutput: ResponseOutput = this.responseGenerator.generate(responseInput);

    return {
      response: responseOutput.text,
      followUpQuestion: responseOutput.followUpQuestion,
      detectedIntent,
      conversationMode,
      context: { ...context },
      responseSource: 'template',
      approval,
    };
  }

  /**
   * Attempt an LLM reply. Returns null when no provider is configured or the
   * call fails — the caller falls back to templates so Kiaros always answers.
   */
  private async tryLLM(
    request: ConversationRequest,
    intent: Intent,
    mode: ConversationMode,
    context: ConversationContext,
    approval?: ApprovalDecision,
  ): Promise<{ text: string; provider: string; model: string } | null> {
    const provider = getLLMProvider();
    if (!provider) return null;

    const contextHints = [
      `Detected intent: ${intent}. Conversation mode: ${mode}.`,
      context.currentTopic ? `Current topic: ${context.currentTopic}.` : '',
      context.currentProject ? `Current project: ${context.currentProject}.` : '',
      approval
        ? `Approval Engine decision for this request: ${approval.state} (level ${approval.level}) — ${approval.reason} ` +
          'Relay this decision truthfully. Remember: you cannot execute anything; ' +
          'an "approved" decision only means the request WOULD be safe once task execution is wired up.'
        : '',
    ].filter(Boolean).join(' ');

    const system = `${KIAROS_PERSONA}\n\n${contextHints}`;
    const messages = this.buildMessages(request);

    try {
      const reply = await provider.generate({
        system,
        messages,
        maxTokens: config.llm.maxTokens,
        timeoutMs: config.llm.timeoutMs,
      });
      return { text: reply.text, provider: provider.name, model: provider.model };
    } catch (error) {
      logger.warn(
        `LLM provider '${provider.name}' failed, falling back to templates: ` +
        `${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private buildMessages(request: ConversationRequest): ChatMessage[] {
    const history = request.history ?? [];
    const recent = history.slice(-MAX_HISTORY_MESSAGES);

    const messages: ChatMessage[] = recent.map((entry) => ({
      role: entry.role === 'jarvis' ? 'assistant' : 'user',
      content: entry.content,
    }));

    // Ensure the current user message is the final turn even if the caller
    // didn't include it in history.
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || last.content !== request.content) {
      messages.push({ role: 'user', content: request.content });
    }

    return messages;
  }

  /**
   * Get current conversation context
   */
  getContext(): ConversationContext {
    return this.contextManager.getContext();
  }

  /**
   * Manually set the conversation topic
   */
  setTopic(topic: string): void {
    this.contextManager.setTopic(topic);
  }

  /**
   * Manually set the current project
   */
  setProject(project: string): void {
    this.contextManager.setProject(project);
  }

  /**
   * Add a command to recent history
   */
  addCommand(command: string): void {
    this.contextManager.addCommand(command);
  }

  /**
   * Clear the conversation context
   */
  clearContext(): void {
    this.contextManager.clear();
  }

  /**
   * Extract context information from message content
   */
  private extractContextFromContent(content: string): void {
    const lowerContent = content.toLowerCase();

    // Extract project references
    const projectMatch = lowerContent.match(/(?:project|for)\s+["']?([a-z0-9_-]+)["']?/i);
    if (projectMatch) {
      this.contextManager.setProject(projectMatch[1]);
    }

    // Extract topic from question patterns
    if (lowerContent.startsWith('what is') || lowerContent.startsWith('how to')) {
      const topic = content.replace(/^(what is|how to)\s+/i, '').split('?')[0];
      if (topic) {
        this.contextManager.setTopic(topic);
      }
    }
  }
}
