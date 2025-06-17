// Import the default export from the twilio package (CommonJS module)
import pkg from 'twilio';
const { twiml: { VoiceResponse } } = pkg;
import { logger } from '../utils/logger.js'; // Import logger utility for logging
import { initializeConversation } from '../utils/conversationStateManager.js';
import formbody from '@fastify/formbody';
import { saveMessage } from '../utils/conversationManager.js';

// Destructure VoiceResponse from the default twilio export
// const { VoiceResponse } = pkg;

/**
 * Registers the /start route for handling incoming voice calls with Fastify.
 * @param {Object} fastify - The Fastify instance to register the route.
 * @param {Object} options - Fastify route options.
 * @returns {Promise<void>} - Registers the route with Fastify.
 */
export default async function startRoute(fastify, options) {
  // Register formbody plugin to parse application/x-www-form-urlencoded bodies
  fastify.register(formbody);

  // Register a POST route for /start to handle incoming Twilio voice calls
  fastify.post('/start', async (request, reply) => {
    const callSid = request.body.CallSid;
    const from = request.body.From;
    const to = request.body.To;

    // Log the incoming request details for debugging
    logger.info('Headers', request.headers);
    logger.info('Body', request.body);
    logger.info('Received incoming call', {
      callSid,
      from,
      to,
      timestamp: new Date().toISOString(),
    });

    try {
      // Initialize conversation with metadata
      const metadata = {
        name: request.body.CallerName || null,
        programInterested: request.body.ProgramInterested || null,
        source: request.body.Source || null,
        day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        phoneNumber: from
      };

      initializeConversation(callSid, metadata);

      // Initialize Twilio VoiceResponse object to generate TwiML
      logger.debug('Creating new VoiceResponse object');
      const twiml = new VoiceResponse();

      // Add initial greeting
      twiml.say('Hey, hi there! Awesome to connect! I\'m Ritwik from Crio Dot Do, here to chat about your next steps in tech. I\'d love to hear about your goals and see how our hands-on programs can fit in. We\'ve got a free-trial workshop today that could be a cool way to kick things off. What caught your eye about Crio?');
      saveMessage(callSid, 'assistant', 'Hey, hi there! Awesome to connect! I\'m Ritwik from Crio Dot Do, here to chat about your next steps in tech. I\'d love to hear about your goals and see how our hands-on programs can fit in. We\'ve got a free-trial workshop today that could be a cool way to kick things off. What caught your eye about Crio?');

      // Configure a Gather verb to collect speech input from the user
      logger.debug('Configuring Gather verb for speech input');
      twiml.gather({
        input: 'speech', // Collect speech input
        action: '/process-speech', // Endpoint to handle the gathered speech
        method: 'POST', // Use POST method for the action
        timeout: 5, // Wait 5 seconds for user input
        speechTimeout: 'auto',
        bargeIn: true
      });

      // Log the generated TwiML for debugging
      logger.info('Generated initial TwiML', {
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
        callSid,
      });

      // Fallback TwiML response in case of error
      const twiml = new VoiceResponse();
      twiml.say('Sorry, an error occurred. Please try again later.');
      reply.type('text/xml');
      reply.send(twiml.toString());
    }
  });
}