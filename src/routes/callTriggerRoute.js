import { initiateCall } from '../services/twilioService.js';
import { logger } from '../utils/logger.js';

export default async function callTriggerRoute(fastify, options) {
  fastify.post('/trigger-call', async (request, reply) => {
    const { phoneNumber } = request.body;

    // Latency logging: start time
    const startTime = Date.now();
    logger.verbose('trigger-call: request started', { phoneNumber, timestamp: new Date().toISOString() });

    if (!phoneNumber) {
      return reply.status(400).send({ error: 'Missing phoneNumber in request body.' });
    }

    try {
      const webhookUrl = `${process.env.SERVER_HOST}/start`;
      const callStart = Date.now();
      const result = await initiateCall(phoneNumber, webhookUrl);
      const callEnd = Date.now();
      logger.verbose('trigger-call: Twilio call initiation finished', { phoneNumber, latencyMs: callEnd - callStart });
      reply.send({ success: true, ...result });
    } catch (error) {
      reply.status(500).send({ success: false, error: error.message });
    }

    // Latency logging: end time
    const endTime = Date.now();
    logger.verbose('trigger-call: request finished', { phoneNumber, totalLatencyMs: endTime - startTime });
  });
}
