import { logger } from './logger.js';

// Conversation states
const STATES = {
  GREETING: 'greeting',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  BOOKING: 'booking',
  CLOSING: 'closing'
};

// Conversation metadata
const conversationMetadata = new Map();

/**
 * Initialize conversation metadata
 * @param {string} callSid - The Twilio Call SID
 * @param {Object} metadata - Initial metadata
 */
export function initializeConversation(callSid, metadata) {
  conversationMetadata.set(callSid, {
    state: STATES.GREETING,
    metadata: metadata || {},
    lastInteraction: Date.now(),
    interruptions: 0,
    bookingAttempts: 0,
    objections: new Set()
  });
  logger.info('Initialized conversation', { callSid, state: STATES.GREETING });
}

/**
 * Update conversation state
 * @param {string} callSid - The Twilio Call SID
 * @param {string} newState - The new state
 */
export function updateState(callSid, newState) {
  const conversation = conversationMetadata.get(callSid);
  if (conversation) {
    conversation.state = newState;
    conversation.lastInteraction = Date.now();
    logger.info('Updated conversation state', { callSid, newState });
  }
}

/**
 * Handle user interruption
 * @param {string} callSid - The Twilio Call SID
 * @returns {boolean} Whether to stop current response
 */
export function handleInterruption(callSid) {
  const conversation = conversationMetadata.get(callSid);
  if (conversation) {
    conversation.interruptions++;
    conversation.lastInteraction = Date.now();
    
    // Stop response if too many interruptions
    const shouldStop = conversation.interruptions >= 2;
    logger.info('Handled interruption', { 
      callSid, 
      interruptions: conversation.interruptions,
      shouldStop 
    });
    return shouldStop;
  }
  return false;
}

/**
 * Track booking attempt
 * @param {string} callSid - The Twilio Call SID
 * @returns {number} Number of booking attempts
 */
export function trackBookingAttempt(callSid) {
  const conversation = conversationMetadata.get(callSid);
  if (conversation) {
    conversation.bookingAttempts++;
    logger.info('Tracked booking attempt', { 
      callSid, 
      attempts: conversation.bookingAttempts 
    });
    return conversation.bookingAttempts;
  }
  return 0;
}

/**
 * Track objection
 * @param {string} callSid - The Twilio Call SID
 * @param {string} objection - The objection type
 */
export function trackObjection(callSid, objection) {
  const conversation = conversationMetadata.get(callSid);
  if (conversation) {
    conversation.objections.add(objection);
    logger.info('Tracked objection', { 
      callSid, 
      objection,
      totalObjections: conversation.objections.size 
    });
  }
}

/**
 * Get conversation metadata
 * @param {string} callSid - The Twilio Call SID
 * @returns {Object} Conversation metadata
 */
export function getConversationMetadata(callSid) {
  return conversationMetadata.get(callSid) || null;
}

/**
 * Check if conversation is stale
 * @param {string} callSid - The Twilio Call SID
 * @param {number} timeout - Timeout in milliseconds
 * @returns {boolean} Whether conversation is stale
 */
export function isConversationStale(callSid, timeout = 300000) { // 5 minutes default
  const conversation = conversationMetadata.get(callSid);
  if (conversation) {
    const isStale = Date.now() - conversation.lastInteraction > timeout;
    if (isStale) {
      logger.info('Conversation is stale', { 
        callSid, 
        lastInteraction: conversation.lastInteraction 
      });
    }
    return isStale;
  }
  return true;
}

/**
 * Clean up conversation
 * @param {string} callSid - The Twilio Call SID
 */
export function cleanupConversation(callSid) {
  conversationMetadata.delete(callSid);
  logger.info('Cleaned up conversation', { callSid });
} 