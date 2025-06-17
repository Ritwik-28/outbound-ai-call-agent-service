import Fastify from 'fastify';
import dotenv from 'dotenv';
import path from 'path';
import fastifyStatic from '@fastify/static';
import startRoute from './routes/startRoute.js';
import processSpeechRoute from './routes/processSpeechRoute.js';
import callTriggerRoute from './routes/callTriggerRoute.js';
import { logger } from './utils/logger.js';
import { cleanupOldConversations } from './utils/conversationManager.js';

dotenv.config();

const fastify = Fastify({ 
  logger: true,
  trustProxy: true // Trust proxy for ngrok
});

// Register static file serving for audio files
fastify.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public/audio'),
  prefix: '/audio/',
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      deepgram: !!process.env.DEEPGRAM_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    }
  };
});

// Register routes
fastify.register(startRoute);
fastify.register(processSpeechRoute);
fastify.register(callTriggerRoute);

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  logger.error('Unhandled error', { 
    error: error.message, 
    stack: error.stack,
    url: request.url,
    method: request.method
  });
  
  reply.status(500).send({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

const start = async () => {
  try {
    // Clean up old conversations on startup
    logger.info('Cleaning up old conversations...');
    cleanupOldConversations(24); // Clean up conversations older than 24 hours
    
    const port = process.env.PORT || 5000;
    const host = '0.0.0.0';
    
    await fastify.listen({ port, host });
    logger.info(`🚀 Fastify server started on port ${port}`);
    logger.info(`📞 Twilio webhook URL: ${process.env.SERVER_HOST || 'http://localhost:' + port}/start`);
    
    // Log missing environment variables
    const missingVars = [];
    if (!process.env.TWILIO_ACCOUNT_SID) missingVars.push('TWILIO_ACCOUNT_SID');
    if (!process.env.TWILIO_AUTH_TOKEN) missingVars.push('TWILIO_AUTH_TOKEN');
    if (!process.env.TWILIO_NUMBER) missingVars.push('TWILIO_NUMBER');
    if (!process.env.DEEPGRAM_API_KEY) missingVars.push('DEEPGRAM_API_KEY');
    if (!process.env.GEMINI_API_KEY) missingVars.push('GEMINI_API_KEY');
    if (!process.env.SERVER_HOST) missingVars.push('SERVER_HOST');
    
    if (missingVars.length > 0) {
      logger.warn('Missing environment variables', { missingVars });
    }
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
};

start();
