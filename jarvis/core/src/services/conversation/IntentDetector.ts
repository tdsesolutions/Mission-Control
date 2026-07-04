/**
 * Intent Detector
 * Identifies the primary intent from user messages
 */

export type Intent = 
  | 'conversation'
  | 'question'
  | 'command'
  | 'coding'
  | 'debugging'
  | 'planning'
  | 'research'
  | 'creative'
  | 'operations'
  | 'unknown';

interface IntentPattern {
  intent: Intent;
  patterns: RegExp[];
  keywords: string[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'coding',
    patterns: [
      /\b(code|coding|program|function|class|implement|write\s+(code|a\s+function|a\s+script))\b/i,
      /\b(typescript|javascript|python|java|rust|go|react|vue|angular)\b/i,
      /\b(debug|fix|error|exception|stack\s+trace)\b.*\b(code|script|function)\b/i,
    ],
    keywords: ['code', 'coding', 'program', 'function', 'implement', 'script', 'typescript', 'javascript'],
  },
  {
    intent: 'debugging',
    patterns: [
      /\b(debug|fix|troubleshoot|solve|resolve)\b.*\b(error|issue|problem|bug|crash|fail)\b/i,
      /\b(error|exception|bug|crash|failure)\b.*\b(fix|solve|resolve|debug)\b/i,
      /\b(why|what).*\b(not\s+working|broken|failing|error)\b/i,
    ],
    keywords: ['debug', 'fix', 'error', 'bug', 'crash', 'troubleshoot', 'issue'],
  },
  {
    intent: 'planning',
    patterns: [
      /\b(plan|roadmap|strategy|approach|design)\b.*\b(architecture|system|project|implementation)\b/i,
      /\b(how\s+should|how\s+to)\b.*\b(approach|structure|organize|design)\b/i,
      /\b(what\s+is\s+the\s+best\s+way|what\s+approach)\b/i,
    ],
    keywords: ['plan', 'roadmap', 'strategy', 'architecture', 'design', 'approach'],
  },
  {
    intent: 'research',
    patterns: [
      /\b(research|investigate|explore|analyze|study|evaluate)\b/i,
      /\b(what\s+is|how\s+does|explain)\b.*\b(work|function|operate)\b/i,
      /\b(compare|contrast|difference\s+between|vs|versus)\b/i,
    ],
    keywords: ['research', 'investigate', 'explore', 'analyze', 'evaluate', 'compare'],
  },
  {
    intent: 'command',
    patterns: [
      /\b(create|make|generate|build|start|run|execute|deploy|stop|restart)\b.*\b(task|project|agent|service)\b/i,
      /\b(dispatch|assign|delegate)\b/i,
      /^\s*(create|make|generate|build)\s+(a|an|the)\s+/i,
    ],
    keywords: ['create', 'make', 'generate', 'build', 'run', 'execute', 'deploy', 'dispatch'],
  },
  {
    intent: 'operations',
    patterns: [
      /\b(status|health|check|monitor|state)\b.*\b(system|service|agent|task)\b/i,
      /\b(is|are)\b.*\b(running|online|up|healthy|operational)\b/i,
      /\b(what\s+is\s+the\s+status|how\s+is)\b/i,
    ],
    keywords: ['status', 'health', 'check', 'monitor', 'running', 'online'],
  },
  {
    intent: 'creative',
    patterns: [
      /\b(write|draft|compose|create)\b.*\b(content|text|message|email|document|proposal)\b/i,
      /\b(help\s+me\s+write|can\s+you\s+write)\b/i,
      /\b(generate|create)\b.*\b(ideas|concepts|names|titles)\b/i,
    ],
    keywords: ['write', 'draft', 'compose', 'content', 'creative', 'ideas'],
  },
  {
    intent: 'question',
    patterns: [
      /^(what|why|how|when|where|who|which|can|could|would|will|is|are|do|does)\b/i,
      /\?\s*$/,
    ],
    keywords: ['what', 'why', 'how', 'when', 'where', 'who', 'which'],
  },
  {
    intent: 'conversation',
    patterns: [
      /\b(hello|hi|hey|greetings|good\s+(morning|afternoon|evening))\b/i,
      /\b(thank|thanks|appreciate)\b/i,
      /\b(bye|goodbye|see\s+you|later)\b/i,
    ],
    keywords: ['hello', 'hi', 'thanks', 'bye', 'goodbye'],
  },
];

export class IntentDetector {
  detect(content: string): Intent {
    const lowerContent = content.toLowerCase();
    const scores: Map<Intent, number> = new Map();

    for (const pattern of INTENT_PATTERNS) {
      let score = 0;

      // Check regex patterns
      for (const regex of pattern.patterns) {
        if (regex.test(content)) {
          score += 2;
        }
      }

      // Check keywords
      for (const keyword of pattern.keywords) {
        if (lowerContent.includes(keyword)) {
          score += 1;
        }
      }

      if (score > 0) {
        scores.set(pattern.intent, (scores.get(pattern.intent) || 0) + score);
      }
    }

    // Return intent with highest score
    let maxIntent: Intent = 'unknown';
    let maxScore = 0;

    for (const [intent, score] of scores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        maxIntent = intent;
      }
    }

    return maxIntent;
  }
}
