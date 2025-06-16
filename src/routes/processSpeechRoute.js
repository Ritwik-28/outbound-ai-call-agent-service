// Import the default export from the twilio package (CommonJS module)
import pkg from 'twilio';
const { twiml: { VoiceResponse } } = pkg;
import { generateReply } from '../services/geminiService.js'; // Import Gemini service for AI responses
import { synthesizeSpeech } from '../services/deepgramService.js'; // Import Deepgram service for text-to-speech
import { logger } from '../utils/logger.js'; // Import logger utility for logging
import fs from 'fs'; // Import Node.js file system module
import path from 'path'; // Import Node.js path module for file path handling
import formbody from '@fastify/formbody';

// Destructure VoiceResponse from the default twilio export
// const { VoiceResponse } = pkg;

/**
 * Registers the /process-speech route for handling speech input from Twilio Gather.
 * Processes user speech, generates an AI reply, converts it to audio, and returns TwiML.
 * @param {Object} fastify - The Fastify instance to register the route.
 * @param {Object} options - Fastify route options (not used in this implementation).
 * @returns {Promise<void>} - Registers the route with Fastify.
 */
export default async function processSpeechRoute(fastify, options) {
  // Register formbody plugin to parse application/x-www-form-urlencoded bodies
  fastify.register(formbody);
  // Register a POST route for /process-speech to handle speech input
  fastify.post('/process-speech', async (request, reply) => {
    // Log the incoming request details for debugging
    logger.info('Received speech processing request on /process-speech', {
      callSid: request.body.CallSid,
      from: request.body.From,
      to: request.body.To,
      speechResult: request.body.SpeechResult,
      timestamp: new Date().toISOString(),
    });

    try {
      // Get the speech input from the request
      const speech = request.body.SpeechResult || '';
      logger.debug('Processing speech input', { speech });

      if (!speech) {
        // Handle case where no speech input is received
        logger.warn('No speech input received');
        const twiml = new VoiceResponse();
        twiml.say('Sorry, I didn’t hear anything. Please try again.');
        twiml.redirect('/start');
        logger.info('Generated fallback TwiML response', { twiml: twiml.toString() });
        reply.type('text/xml');
        reply.send(twiml.toString());
        return;
      }

      // Generate an AI response using the Gemini service
      logger.info('Generating AI reply for speech input');
      const textReply = await generateReply(speech);
      logger.debug('Received AI reply', { textReply, replyLength: textReply.length });

      // Convert the AI response to speech using Deepgram
      logger.info('Synthesizing speech for AI reply');
      const audioBuffer = await synthesizeSpeech(textReply);
      logger.debug('Generated audio buffer', { bufferSize: audioBuffer.length });

      // Save the audio to a file
      const filename = `response-${Date.now()}.wav`;
      const filePath = path.join('public/audio', filename);
      logger.debug('Saving audio file', { filename, filePath });
      fs.writeFileSync(filePath, audioBuffer);
      logger.info('Audio file saved successfully', { filename });

      // Create TwiML response to play the audio and redirect to /start
      logger.debug('Creating new VoiceResponse object');
      const twiml = new VoiceResponse();
      const audioUrl = `${process.env.SERVER_HOST}/audio/${filename}`;
      logger.debug('Configuring TwiML to play audio', { audioUrl });
      twiml.play(audioUrl);
      twiml.redirect('/start');
      logger.info('Generated TwiML response', { twiml: twiml.toString() });

      // Set response content type to XML and send the TwiML
      reply.type('text/xml');
      reply.send(twiml.toString());
    } catch (err) {
      // Log detailed error information for debugging
      logger.error('Failed to process /process-speech route', {
        errorMessage: err.message,
        errorStack: err.stack,
        callSid: request.body.CallSid,
        speechResult: request.body.SpeechResult,
      });

      // Fallback TwiML response in case of error
      const twiml = new VoiceResponse();
      twiml.say('Sorry, an error occurred. Please try again later.');
      twiml.redirect('/start');
      logger.info('Generated fallback TwiML response', { twiml: twiml.toString() });
      reply.type('text/xml');
      reply.send(twiml.toString());
    }
  });
}