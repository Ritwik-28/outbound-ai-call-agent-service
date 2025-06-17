import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const CONVERSATIONS_DIR = 'conversations';
const MAX_CONVERSATION_SIZE = 100; // Maximum number of messages per conversation
const MAX_FILE_SIZE = 1024 * 1024; // 1MB max file size

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
      // Check file size before reading
      const stats = fs.statSync(filePath);
      if (stats.size > MAX_FILE_SIZE) {
        logger.warn('Conversation file too large, truncating', { 
          callSid, 
          size: stats.size 
        });
        return [];
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const conversation = JSON.parse(content);
      
      // Ensure conversation is an array
      if (!Array.isArray(conversation)) {
        logger.warn('Invalid conversation format, resetting', { callSid });
        return [];
      }
      
      return conversation;
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
    
    // Add new message
    conversation.push({ 
      role, 
      content, 
      timestamp: new Date().toISOString() 
    });
    
    // Limit conversation size to prevent memory issues
    if (conversation.length > MAX_CONVERSATION_SIZE) {
      conversation.splice(0, conversation.length - MAX_CONVERSATION_SIZE);
      logger.info('Conversation truncated to prevent memory issues', { 
        callSid, 
        maxSize: MAX_CONVERSATION_SIZE 
      });
    }
    
    // Write to file with error handling
    const jsonContent = JSON.stringify(conversation, null, 2);
    fs.writeFileSync(filePath, jsonContent);
    
    logger.info('Saved message to conversation', { 
      callSid, 
      role, 
      messageCount: conversation.length 
    });
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

/**
 * Clean up old conversation files
 * @param {number} maxAge - Maximum age in hours (default: 24)
 */
export function cleanupOldConversations(maxAge = 24) {
  try {
    const files = fs.readdirSync(CONVERSATIONS_DIR);
    const now = Date.now();
    const maxAgeMs = maxAge * 60 * 60 * 1000;
    
    files.forEach(file => {
      if (file.endsWith('.txt')) {
        const filePath = path.join(CONVERSATIONS_DIR, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          fs.unlinkSync(filePath);
          logger.info('Cleaned up old conversation file', { file });
        }
      }
    });
  } catch (error) {
    logger.error('Error cleaning up conversations', { error: error.message });
  }
} 