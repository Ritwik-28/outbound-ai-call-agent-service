import { logger } from '../utils/logger.js';

// API endpoint and model configuration
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MODEL = 'gemini-2.0-flash';

/**
 * Generates a reply using the Google Gemini REST API based on the provided user text.
 * @param {string} text - The input text from the user to generate a response for.
 * @returns {Promise<string>} - The generated reply or a fallback message if an error occurs.
 */
export async function generateReply(text) {
  logger.info('Starting reply generation', {
    inputText: text,
    model: MODEL,
    apiKeySet: !!process.env.GEMINI_API_KEY,
  });

  // Check if API key is set
  if (!process.env.GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY environment variable is not set');
    return 'Sorry, the AI service is currently unavailable. Please try again later.';
  }

  try {
    // Prepare the content payload for the REST API
    const content = {
      contents: [{
        role: 'user',
        parts: [{
          text: `You are a helpful and polite AI assistant. \n${text}`,
        }],
      }],
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    };
    logger.debug('Prepared content for Gemini API', { content });

    // Make the REST API call using fetch
    logger.info('Sending request to Gemini API');
    const response = await fetch(
      `${API_ENDPOINT}${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(content),
      }
    );

    // Check if the response is successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`[Gemini API Error]: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    // Parse the response
    const result = await response.json();
    const reply = result.candidates[0].content.parts[0].text;
    logger.info('Successfully generated reply from Gemini API', {
      reply,
      responseLength: reply.length,
    });

    return reply;
  } catch (err) {
    logger.error('Failed to generate reply from Gemini API', {
      errorMessage: err.message,
      errorStack: err.stack,
      inputText: text,
      model: MODEL,
    });

    // Handle specific API key errors
    if (err.message.includes('API_KEY_INVALID') || err.message.includes('400')) {
      return 'Sorry, there’s an issue with the AI service configuration. Please try again later.';
    }
    return 'Sorry, could you please repeat that?';
  }
}