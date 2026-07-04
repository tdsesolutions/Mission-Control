/**
 * Conversation Route
 * Handle conversations with Kiaros
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import type { Conversation } from '../../../../shared/types/index.js';
import { ConversationManager } from '../../services/conversation/ConversationManager.js';

const router = Router();

// In-memory conversation store
const conversations: Conversation[] = [];
const MAX_CONVERSATIONS = 100;

// Initialize Conversation Manager
const conversationManager = new ConversationManager();

router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const recentConversations = conversations.slice(-limit);
  
  res.json({
    success: true,
    data: recentConversations,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/message', (req, res) => {
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
  conversations.push(userMessage);
  
  // Trim conversations if needed
  if (conversations.length > MAX_CONVERSATIONS) {
    conversations.shift();
  }
  
  logger.info(`User message received: ${content.substring(0, 100)}...`);
  
  // Process through Conversation Manager
  const result = conversationManager.processMessage({
    content: content.trim(),
    userId: 'teddie',
    sessionId: 'default_session',
  });
  
  logger.info(`Intent detected: ${result.detectedIntent}, Mode: ${result.conversationMode}`);
  
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
  conversations.push(kiarosResponse);
  
  res.json({
    success: true,
    data: {
      userMessage,
      jarvisResponse: kiarosResponse,
      metadata: {
        intent: result.detectedIntent,
        mode: result.conversationMode,
        context: result.context,
      },
    },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

// Legacy response generator - kept for reference
// All responses now flow through ConversationManager

export { router as conversationRouter };
