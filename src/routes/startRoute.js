// Import the default export from the twilio package (CommonJS module)
import pkg from 'twilio';
const { twiml: { VoiceResponse } } = pkg;
import { logger } from '../utils/logger.js'; // Import logger utility for logging
import formbody from '@fastify/formbody';

// Destructure VoiceResponse from the default twilio export
// const { VoiceResponse } = pkg;

/**
 * Registers the /start route for handling incoming voice calls with Fastify.
 * @param {Object} fastify - The Fastify instance to register the route.
 * @param {Object} options - Fastify route options (not used in this implementation).
 * @returns {Promise<void>} - Registers the route with Fastify.
 */
export default async function startRoute(fastify, options) {
  // Register formbody plugin to parse application/x-www-form-urlencoded bodies
  fastify.register(formbody);

  // Register a POST route for /start to handle incoming Twilio voice calls
  fastify.post('/start', async (request, reply) => {
    // Log the incoming request details for debugging
    logger.info('Headers', request.headers);
    logger.info('Body', request.body);
    logger.info('Received incoming call request on /start', {
      callSid: request.body.CallSid,
      from: request.body.From,
      to: request.body.To,
      timestamp: new Date().toISOString(),
    });

    try {
      // Initialize Twilio VoiceResponse object to generate TwiML
      logger.debug('Creating new VoiceResponse object');
      const twiml = new VoiceResponse();

      // Configure a Gather verb to collect speech input from the user
      logger.debug('Configuring Gather verb for speech input');
      const gather = twiml.gather({
        input: 'speech', // Collect speech input
        action: '/process-speech', // Endpoint to handle the gathered speech
        method: 'POST', // Use POST method for the action
        timeout: 5, // Wait 5 seconds for user input
      });

      // Add a prompt to the user
      logger.debug('Adding Say verb to TwiML');
      gather.say('Hello! How can I help you today?');

      // Log the generated TwiML for debugging
      logger.info('Generated TwiML response', {
        twiml: twiml.toString(),
      });

      // Set response content type to XML and send the TwiML
      reply.type('text/xml');
      reply.send(twiml.toString());
    } catch (err) {
      // Log detailed error information for debugging
      logger.error('Failed to process /start route', {
        errorMessage: err.message,
        errorStack: err.stack,
        callSid: request.body.CallSid,
      });

      // Fallback TwiML response in case of error
      const twiml = new VoiceResponse();
      twiml.say('Sorry, an error occurred. Please try again later.');
      reply.type('text/xml');
      reply.send(twiml.toString());
    }
  });
}