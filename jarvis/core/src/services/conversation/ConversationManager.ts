/**
 * Conversation Manager
 * Central brain for Kiaros conversation handling
 * 
 * Pipeline:
 * User Message → Intent Detection → Mode Selection → Context Update → Response Generation → Kiaros Response
 */

import { IntentDetector, Intent } from './IntentDetector.js';
import { ModeSelector, ConversationMode } from './ModeSelector.js';
import { ContextManager, ConversationContext } from './ContextManager.js';
import { ResponseGenerator, ResponseInput, ResponseOutput } from './ResponseGenerator.js';

export interface ConversationRequest {
  content: string;
  userId: string;
  sessionId: string;
}

export interface ConversationResult {
  response: string;
  followUpQuestion?: string;
  detectedIntent: Intent;
  conversationMode: ConversationMode;
  context: ConversationContext;
}

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
   * Process a user message through the conversation pipeline
   */
  processMessage(request: ConversationRequest): ConversationResult {
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

    // Extract potential topic/project from content
    this.extractContextFromContent(content);

    // Step 4: Generate Response
    const context = this.contextManager.getContext();
    const responseInput: ResponseInput = {
      content,
      intent: detectedIntent,
      mode: conversationMode,
      context,
    };

    const responseOutput = this.responseGenerator.generate(responseInput);

    // Step 5: Return Result
    return {
      response: responseOutput.text,
      followUpQuestion: responseOutput.followUpQuestion,
      detectedIntent,
      conversationMode,
      context: { ...context },
    };
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
