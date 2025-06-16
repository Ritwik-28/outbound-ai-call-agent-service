import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const CONVERSATIONS_DIR = 'conversations';

// Ensure conversations directory exists
if (!fs.existsSync(CONVERSATIONS_DIR)) {
  fs.mkdirSync(CONVERSATIONS_DIR);
}

/**
 * Get conversation history for a specific call
 * @param {string} callSid - The Twilio Call SID
 * @returns {Array} Array of conversation messages
 */
export function getConversation(callSid) {
  const filePath = path.join(CONVERSATIONS_DIR, `${callSid}.txt`);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
    return [];
  } catch (error) {
    logger.error('Error reading conversation', { callSid, error: error.message });
    return [];
  }
}

/**
 * Save a new message to the conversation
 * @param {string} callSid - The Twilio Call SID
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - The message content
 */
export function saveMessage(callSid, role, content) {
  const filePath = path.join(CONVERSATIONS_DIR, `${callSid}.txt`);
  try {
    const conversation = getConversation(callSid);
    conversation.push({ role, content, timestamp: new Date().toISOString() });
    fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2));
    logger.info('Saved message to conversation', { callSid, role });
  } catch (error) {
    logger.error('Error saving message', { callSid, error: error.message });
  }
}

/**
 * Format conversation history for Gemini API
 * @param {string} callSid - The Twilio Call SID
 * @returns {Array} Formatted conversation history
 */
export function getFormattedConversation(callSid) {
  const conversation = getConversation(callSid);
  return conversation.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));
} 