/**
 * Mode Selector
 * Selects the appropriate conversation mode based on intent and context
 */

import { Intent } from './IntentDetector.js';

export type ConversationMode = 
  | 'executive'
  | 'technical'
  | 'strategic'
  | 'research'
  | 'creative'
  | 'operations';

interface ModeMapping {
  mode: ConversationMode;
  intents: Intent[];
  description: string;
}

const MODE_MAPPINGS: ModeMapping[] = [
  {
    mode: 'executive',
    intents: ['command', 'operations', 'planning'],
    description: 'Direct, action-oriented responses focused on execution and outcomes',
  },
  {
    mode: 'technical',
    intents: ['coding', 'debugging'],
    description: 'Technical precision with code examples and implementation details',
  },
  {
    mode: 'strategic',
    intents: ['planning'],
    description: 'High-level thinking with trade-offs and recommendations',
  },
  {
    mode: 'research',
    intents: ['research', 'question'],
    description: 'Analytical responses with evidence and exploration',
  },
  {
    mode: 'creative',
    intents: ['creative'],
    description: 'Open, exploratory responses with generated content',
  },
  {
    mode: 'operations',
    intents: ['operations', 'command'],
    description: 'System-focused responses about status and health',
  },
];

export class ModeSelector {
  private currentMode: ConversationMode = 'executive';

  selectMode(intent: Intent, previousMode?: ConversationMode): ConversationMode {
    // Find mode that matches the intent
    for (const mapping of MODE_MAPPINGS) {
      if (mapping.intents.includes(intent)) {
        this.currentMode = mapping.mode;
        return this.currentMode;
      }
    }

    // Default to previous mode or executive
    this.currentMode = previousMode || 'executive';
    return this.currentMode;
  }

  getCurrentMode(): ConversationMode {
    return this.currentMode;
  }

  getModeDescription(mode: ConversationMode): string {
    const mapping = MODE_MAPPINGS.find(m => m.mode === mode);
    return mapping?.description || 'General purpose mode';
  }
}
