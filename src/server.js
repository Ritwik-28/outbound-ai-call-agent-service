import Fastify from 'fastify';
import dotenv from 'dotenv';
import path from 'path';
import fastifyStatic from '@fastify/static';
import startRoute from './routes/startRoute.js';
import processSpeechRoute from './routes/processSpeechRoute.js';
import callTriggerRoute from './routes/callTriggerRoute.js';
import { logger } from './utils/logger.js';

dotenv.config();

const fastify = Fastify({ logger: true });

fastify.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public/audio'),
  prefix: '/audio/',
});

fastify.register(startRoute);
fastify.register(processSpeechRoute);
fastify.register(callTriggerRoute);

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 5000, host: '0.0.0.0' });
    logger.info('🚀 Fastify server started');
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
