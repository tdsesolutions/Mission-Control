/**
 * Response Generator
 * Generates Kiaros responses based on intent, mode, and context
 */

import { Intent } from './IntentDetector.js';
import { ConversationMode } from './ModeSelector.js';
import { ConversationContext } from './ContextManager.js';

export interface ResponseInput {
  content: string;
  intent: Intent;
  mode: ConversationMode;
  context: ConversationContext;
}

export interface ResponseOutput {
  text: string;
  followUpQuestion?: string;
}

export class ResponseGenerator {
  private recentResponses: Set<string> = new Set();
  private maxRecentResponses = 10;

  generate(input: ResponseInput): ResponseOutput {
    const { content, intent, mode, context } = input;
    const lowerContent = content.toLowerCase();

    // Generate response based on intent and mode
    let response = this.generateByIntentAndMode(intent, mode, lowerContent, context);

    // Avoid repetition
    response = this.avoidRepetition(response);

    // Track response
    this.trackResponse(response);

    // Determine if follow-up is needed
    const followUp = this.determineFollowUp(intent, mode, context);

    return {
      text: response,
      followUpQuestion: followUp,
    };
  }

  private generateByIntentAndMode(
    intent: Intent,
    mode: ConversationMode,
    content: string,
    context: ConversationContext
  ): string {
    // Greetings
    if (intent === 'conversation' && content.match(/^(hello|hi|hey|greetings)/)) {
      return "Greetings Teddie. I am Kiaros. Ready to assist.";
    }

    // Status inquiries
    if (intent === 'operations' && (content.includes('status') || content.includes('how are you'))) {
      return "All systems operational. Mission Control connected. What would you like me to check?";
    }

    // Task creation
    if (intent === 'command' && content.includes('task')) {
      if (content.includes('create') || content.includes('new') || content.includes('add')) {
        return "I can create that task. Provide the title and details.";
      }
      return "What would you like to do with tasks?";
    }

    // Project inquiries
    if (intent === 'operations' && content.includes('project')) {
      return "Which project requires attention?";
    }

    // Mission Control
    if (content.includes('mission control')) {
      return "Mission Control is online. What operation do you need?";
    }

    // Help
    if (intent === 'question' && (content.includes('help') || content.includes('what can you do'))) {
      return "I handle: task management, project oversight, system monitoring, research, planning, and technical work. What do you need?";
    }

    // Mode switching
    if (content.includes('mode') || content.includes('switch') || content.includes('orb') || content.includes('sphere')) {
      return "Use the mode selector at the bottom to switch visualization.";
    }

    // Thank you
    if (intent === 'conversation' && content.match(/(thank|thanks)/)) {
      return "You're welcome.";
    }

    // Goodbye
    if (intent === 'conversation' && content.match(/(bye|goodbye|see you)/)) {
      return "Goodbye Teddie. Monitoring continues in background.";
    }

    // Coding intent with technical mode
    if (intent === 'coding' && mode === 'technical') {
      return "I'll help with the code. What specifically needs implementation?";
    }

    // Debugging intent
    if (intent === 'debugging') {
      return "What error are you seeing? Share the relevant code or error message.";
    }

    // Planning intent with strategic mode
    if (intent === 'planning' && mode === 'strategic') {
      return "What's the objective? I'll outline an approach.";
    }

    // Research intent
    if (intent === 'research') {
      return "What do you need to understand? I'll research it.";
    }

    // Command intent
    if (intent === 'command') {
      return "Executing. What are the parameters?";
    }

    // Question intent
    if (intent === 'question') {
      return "What specifically do you need to know?";
    }

    // Default - concise and direct
    return "Understood. What action should I take?";
  }

  private avoidRepetition(response: string): string {
    // Check if we've recently used this exact response
    if (this.recentResponses.has(response)) {
      // Return a variation
      return this.getVariation(response);
    }
    return response;
  }

  private getVariation(response: string): string {
    // Simple variations for common responses
    const variations: Record<string, string[]> = {
      "Understood. What action should I take?": [
        "Acknowledged. What's next?",
        "Got it. What do you need?",
        "Clear. What should I do?",
      ],
      "You're welcome.": [
        "Anytime.",
        "Of course.",
        "Happy to help.",
      ],
    };

    const options = variations[response];
    if (options) {
      return options[Math.floor(Math.random() * options.length)];
    }

    return response;
  }

  private trackResponse(response: string): void {
    this.recentResponses.add(response);
    if (this.recentResponses.size > this.maxRecentResponses) {
      // Remove oldest (first) entry
      const first = this.recentResponses.values().next().value;
      if (first) {
        this.recentResponses.delete(first);
      }
    }
  }

  private determineFollowUp(
    intent: Intent,
    mode: ConversationMode,
    context: ConversationContext
  ): string | undefined {
    // Only ask follow-up for certain intents when context is unclear
    if (intent === 'command' && !context.currentProject) {
      return "Which project is this for?";
    }

    if (intent === 'debugging' && context.recentCommands.length === 0) {
      return "What were you working on when the error occurred?";
    }

    // Generally avoid follow-up questions unless necessary
    return undefined;
  }
}
