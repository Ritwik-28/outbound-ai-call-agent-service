import { initiateCall } from '../services/twilioService.js';
import { logger } from '../utils/logger.js';

export default async function callTriggerRoute(fastify, options) {
  fastify.post('/trigger-call', async (request, reply) => {
    const { phoneNumber } = request.body;

    if (!phoneNumber) {
      return reply.status(400).send({ error: 'Missing phoneNumber in request body.' });
    }

    try {
      const webhookUrl = `${process.env.SERVER_HOST}/start`;
      const result = await initiateCall(phoneNumber, webhookUrl);
      reply.send({ success: true, ...result });
    } catch (error) {
      reply.status(500).send({ success: false, error: error.message });
    }
  });
}
