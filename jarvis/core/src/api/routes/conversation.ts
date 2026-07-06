/**
 * Conversation Route
 * Handle conversations with Kiaros
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import type { Conversation } from '../../../../shared/types/index.js';
import { ConversationManager } from '../../services/conversation/ConversationManager.js';
import { getMemoryService } from '../../services/memoryService.js';

const router = Router();

// Conversation history is persisted through the shared MemoryService so it
// survives Core restarts. Loaded lazily on first access — requests only
// arrive after index.ts has initialized the memory service.
const MEMORY_KEY = 'conversation.history';
const MAX_CONVERSATIONS = 100;

let conversations: Conversation[] | null = null;

function getConversations(): Conversation[] {
  if (conversations === null) {
    const stored = getMemoryService().get<Conversation[]>(MEMORY_KEY);
    conversations = Array.isArray(stored) ? stored : [];
  }
  return conversations;
}

function persistConversations(): void {
  const memory = getMemoryService();
  memory.set(MEMORY_KEY, getConversations());
  void memory.saveMemory();
}

// Initialize Conversation Manager
const conversationManager = new ConversationManager();

router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const recentConversations = getConversations().slice(-limit);
  
  res.json({
    success: true,
    data: recentConversations,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/message', async (req, res) => {
  const { content, type = 'text' } = req.body;
  
  if (!content || typeof content !== 'string') {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_CONTENT',
        message: 'Message content is required',
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  // Store user message
  const userMessage: Conversation = {
    id: `msg_${Date.now()}`,
    timestamp: new Date(),
    role: 'user',
    content: content.trim(),
    type,
  };
  const history = getConversations();
  history.push(userMessage);

  // Trim conversations if needed
  if (history.length > MAX_CONVERSATIONS) {
    history.shift();
  }
  
  logger.info(`User message received: ${content.substring(0, 100)}...`);

  // Process through the Conversation Manager (LLM provider with template
  // fallback — see services/llm). History includes the just-stored user
  // message, so it arrives as the final turn.
  const result = await conversationManager.processMessage({
    content: content.trim(),
    userId: 'teddie',
    sessionId: 'default_session',
    history: history.flatMap((entry) =>
      entry.role === 'user' || entry.role === 'jarvis'
        ? [{ role: entry.role, content: entry.content }]
        : [],
    ),
  });

  logger.info(
    `Intent: ${result.detectedIntent}, Mode: ${result.conversationMode}, ` +
    `Source: ${result.responseSource}${result.provider ? ` (${result.provider}/${result.model})` : ''}`,
  );
  
  // Generate Kiaros response
  const kiarosResponse: Conversation = {
    id: `msg_${Date.now()}_response`,
    timestamp: new Date(),
    role: 'jarvis',
    content: result.followUpQuestion
      ? `${result.response} ${result.followUpQuestion}`
      : result.response,
    type: 'text',
  };
  history.push(kiarosResponse);
  if (history.length > MAX_CONVERSATIONS) {
    history.shift();
  }
  persistConversations();
  
  res.json({
    success: true,
    data: {
      userMessage,
      jarvisResponse: kiarosResponse,
      metadata: {
        intent: result.detectedIntent,
        mode: result.conversationMode,
        context: result.context,
        responseSource: result.responseSource,
        provider: result.provider ?? null,
        model: result.model ?? null,
        approval: result.approval ?? null,
      },
    },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

// Legacy response generator - kept for reference
// All responses now flow through ConversationManager

export { router as conversationRouter };
