/**
 * twilioService.js
 * ----------------
 * Responsible for programmatically initiating outbound calls via Twilio.
 */

import twilio from 'twilio';
import { logger } from '../utils/logger.js';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Initiates a call using Twilio REST API.
 * @param {string} toNumber - The recipient's phone number.
 * @param {string} webhookUrl - Your /start webhook URL for TwiML instructions.
 * @returns {object} Twilio call SID and status.
 */
export async function initiateCall(toNumber, webhookUrl) {
  try {
    logger.info('📞 Initiating Twilio call', { to: toNumber });

    const call = await client.calls.create({
      url: webhookUrl,
      to: toNumber,
      from: process.env.TWILIO_NUMBER,
    });

    logger.info('✅ Call initiated successfully', { sid: call.sid, status: call.status });
    return { sid: call.sid, status: call.status };
  } catch (err) {
    logger.error('❌ Failed to initiate Twilio call', {
      message: err.message,
      stack: err.stack,
    });
    throw err;
  }
}
