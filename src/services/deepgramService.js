import { createClient } from '@deepgram/sdk'; // Import Deepgram SDK for text-to-speech
import { logger } from '../utils/logger.js';  // Import logger utility for logging
import dotenv from 'dotenv';                 // Import dotenv to manage environment variables
dotenv.config();                              // Load environment variables from .env file

/**
 * Initializes the Deepgram client with the API key from environment variables.
 * @throws {Error} - Throws an error if the DEEPGRAM_API_KEY is not set.
 * @returns {Object} - The initialized Deepgram client.
 */
function initializeDeepgramClient() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  console.log('Deepgram API Key:', apiKey); // Debugging line to check API key presence

  if (!apiKey) {
    logger.error('Deepgram API key is not set in environment variables', {
      envVariable: 'DEEPGRAM_API_KEY',
      timestamp: new Date().toISOString(),
    });
    throw new Error('DEEPGRAM_API_KEY is required but not set');
  }

  // Log initialization attempt
  logger.debug('Initializing Deepgram client', { apiKeyLength: apiKey.length });
  const deepgram = createClient(apiKey);
  logger.info('Deepgram client initialized successfully');
  return deepgram;
}

// Initialize the Deepgram client
const deepgram = initializeDeepgramClient();

/**
 * Synthesizes speech from text using Deepgram's text-to-speech API.
 * @param {string} text - The text to convert to speech.
 * @returns {Promise<Buffer>} - A buffer containing the audio data in WAV format.
 * @throws {Error} - Throws an error if the synthesis fails or input is invalid.
 */
export async function synthesizeSpeech(text) {
  // Log the start of the speech synthesis process
  logger.info('Starting speech synthesis via Deepgram TTS', {
    inputText: text,
    textLength: text?.length || 0,
    timestamp: new Date().toISOString(),
  });

  // Validate input text
  if (!text || typeof text !== 'string') {
    logger.error('Invalid input text for speech synthesis', {
      inputText: text,
      timestamp: new Date().toISOString(),
    });
    throw new Error('Text input must be a non-empty string');
  }

  try {
    // Use direct HTTP fetch to call Deepgram REST TTS endpoint
    logger.debug('Sending text-to-speech HTTP request to Deepgram', {
      model: 'aura-asteria-en',
      encoding: 'linear16',
      container: 'wav',
    });

    const url = `https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&container=wav`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Deepgram HTTP error ${resp.status}: ${errBody}`);
    }

    const arrayBuffer = await resp.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    logger.info('Speech synthesis completed successfully', {
      bufferSize: audioBuffer.length,
      timestamp: new Date().toISOString(),
    });
    return audioBuffer;

  } catch (err) {
    // Log detailed error information
    logger.error('Deepgram TTS error', {
      errorMessage: err.message,
      errorStack: err.stack,
      inputText: text,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Deepgram TTS failed: ${err.message}`);
  }
}
