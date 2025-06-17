// Import the default export from the twilio package (CommonJS module)
import pkg from 'twilio';
const { twiml: { VoiceResponse } } = pkg;
import { generateReply } from '../services/geminiService.js'; // Import Gemini service for AI responses
import { synthesizeSpeech } from '../services/deepgramService.js'; // Import Deepgram service for text-to-speech
import { logger } from '../utils/logger.js'; // Import logger utility for logging
import { handleInterruption, updateState, getConversationMetadata } from '../utils/conversationStateManager.js';
import fs from 'fs'; // Import Node.js file system module
import path from 'path'; // Import Node.js path module for file path handling
import formbody from '@fastify/formbody';
import { getConversation } from '../utils/conversationManager.js';
import { saveMessage } from '../utils/conversationManager.js';

// Destructure VoiceResponse from the default twilio export
// const { VoiceResponse } = pkg;

/**
 * Registers the /process-speech route for handling speech input from Twilio Gather.
 * @param {Object} fastify - The Fastify instance to register the route.
 * @param {Object} options - Fastify route options.
 * @returns {Promise<void>} - Registers the route with Fastify.
 */
export default async function processSpeechRoute(fastify, options) {
  // Register formbody plugin to parse application/x-www-form-urlencoded bodies
  fastify.register(formbody);
  // Register a POST route for /process-speech to handle speech input
  fastify.post('/process-speech', async (request, reply) => {
    const callSid = request.body.CallSid;
    const speech = request.body.SpeechResult || '';
    const isInterrupted = request.body.SpeechResult === 'interrupted';

    // Log the incoming request details for debugging
    logger.info('Received speech processing request', {
      callSid,
      speech,
      isInterrupted,
      timestamp: new Date().toISOString(),
    });

    try {
      // Handle interruption
      if (isInterrupted) {
        const shouldStop = handleInterruption(callSid);
        if (shouldStop) {
          const twiml = new VoiceResponse();
          twiml.say('I apologize for the interruption. Please go ahead.');
          twiml.gather({
            input: 'speech',
            action: '/process-speech',
            method: 'POST',
            timeout: 5,
            speechTimeout: 'auto',
            bargeIn: true
          });
          reply.type('text/xml');
          reply.send(twiml.toString());
          return;
        }
      }

      // Update state to processing
      updateState(callSid, 'processing');

      if (!speech) {
        // Handle case where no speech input is received
        logger.warn('No speech input received');
        const twiml = new VoiceResponse();
        twiml.say("Sorry, I didn't hear anything. Please try again.");
        twiml.gather({
          input: 'speech',
          action: '/process-speech',
          method: 'POST',
          timeout: 5,
          speechTimeout: 'auto',
          bargeIn: true
        });
        reply.type('text/xml');
        reply.send(twiml.toString());
        return;
      }

      // Check for objections
      const metadata = getConversationMetadata(callSid);
      const objectionKeywords = {
        'price': ['expensive', 'cost', 'price', 'money', 'payment'],
        'time': ['busy', 'schedule', 'time', 'long', 'duration'],
        'experience': ['experience', 'background', 'skill', 'level']
      };

      let objectionType = null;
      for (const [type, keywords] of Object.entries(objectionKeywords)) {
        if (keywords.some(keyword => speech.toLowerCase().includes(keyword))) {
          objectionType = type;
          break;
        }
      }

      let textReply;
      if (objectionType) {
        textReply = 'I understand your concern. Let me provide more information or address your question.';
      } else {
        // Generate an AI response using the Gemini service
        logger.info('Generating AI reply');
        const history = getConversation(callSid);
        textReply = await generateReply(speech, history);
      }
      // Save the user's speech and the AI's reply to the conversation history
      saveMessage(callSid, 'user', speech);
      saveMessage(callSid, 'assistant', textReply);

      // Update state to speaking
      updateState(callSid, 'speaking');

      // Convert the AI response to speech using Deepgram
      logger.info('Synthesizing speech');
      const audioBuffer = await synthesizeSpeech(textReply);
      logger.debug('Generated audio buffer', { bufferSize: audioBuffer.length });

      // Save the audio to a file
      const filename = `response-${Date.now()}.wav`;
      const filePath = path.join('public/audio', filename);
      logger.debug('Saving audio file', { filename, filePath });
      fs.writeFileSync(filePath, audioBuffer);
      logger.info('Audio file saved', { filename });

      // Create TwiML response to play the audio and gather next input
      const twiml = new VoiceResponse();
      const audioUrl = `${process.env.SERVER_HOST}/audio/${filename}`;
      logger.debug('Configuring TwiML to play audio', { audioUrl });
      
      // Add a small pause before playing response
      twiml.pause({ length: 0.5 });
      
      // Play the response
      twiml.play(audioUrl);
      
      // Add a small pause after response
      twiml.pause({ length: 0.5 });

      // Gather next input with barge-in enabled
      twiml.gather({
        input: 'speech',
        action: '/process-speech',
        method: 'POST',
        timeout: 5,
        speechTimeout: 'auto',
        bargeIn: true
      });

      logger.info('Generated TwiML response', { twiml: twiml.toString() });

      // Set response content type to XML and send the TwiML
      reply.type('text/xml');
      reply.send(twiml.toString());
    } catch (err) {
      // Log detailed error information for debugging
      logger.error('Failed to process speech', {
        errorMessage: err.message,
        errorStack: err.stack,
        callSid,
        speech
      });

      // Fallback TwiML response in case of error
      const twiml = new VoiceResponse();
      twiml.say('Sorry, an error occurred. Please try again.');
      twiml.gather({
        input: 'speech',
        action: '/process-speech',
        method: 'POST',
        timeout: 5,
        speechTimeout: 'auto',
        bargeIn: true
      });
      logger.info('Generated fallback TwiML response', { twiml: twiml.toString() });
      reply.type('text/xml');
      reply.send(twiml.toString());
    }
  });
}