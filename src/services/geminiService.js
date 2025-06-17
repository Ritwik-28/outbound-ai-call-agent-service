import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';
import { getCache, setCache, generateCacheKey, TTL } from './cacheService.js';
import { getRelevantChunks, formatChunksForContext } from './knowledgeBaseService.js';

// Initialize Gemini client with error handling
let genAI = null;
let model = null;

try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required but not set');
  }
  genAI = new GoogleGenerativeAI(apiKey);
  
  // Try different model names in order of preference
  const modelNames = ['gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'];
  
  for (const modelName of modelNames) {
    try {
      model = genAI.getGenerativeModel({ model: modelName });
      logger.info(`Gemini client initialized successfully with model: ${modelName}`);
      break;
    } catch (modelError) {
      logger.warn(`Failed to initialize model ${modelName}`, { error: modelError.message });
      if (modelName === modelNames[modelNames.length - 1]) {
        throw new Error('All Gemini models failed to initialize');
      }
    }
  }
} catch (error) {
  logger.error('Failed to initialize Gemini client', { error: error.message });
  // Don't throw here, let the service handle missing client gracefully
}

// Initialize response cache
const responseCache = new Map();
const CACHE_TTL = TTL.RESPONSE;

/**
 * Generate cache key for response
 * @param {string} query - User query
 * @param {Array} history - Conversation history
 * @returns {string} Cache key
 */
function generateResponseCacheKey(query, history) {
  const historyString = history.map(h => `${h.role}:${h.content}`).join('|');
  return `${query}|${historyString}`;
}

/**
 * Get cached response
 * @param {string} query - User query
 * @param {Array} history - Conversation history
 * @returns {string|null} Cached response or null
 */
function getCachedResponse(query, history) {
  const key = generateResponseCacheKey(query, history);
  const cached = responseCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('Using cached response');
    return cached.response;
  }
  
  return null;
}

/**
 * Cache response
 * @param {string} query - User query
 * @param {Array} history - Conversation history
 * @param {string} response - AI response
 */
function cacheResponse(query, history, response) {
  const key = generateResponseCacheKey(query, history);
  responseCache.set(key, {
    response,
    timestamp: Date.now()
  });
}

/**
 * Format conversation history
 * @param {Array} history - Conversation history
 * @returns {string} Formatted history
 */
function formatHistory(history) {
  // Only include the last 4 messages to prevent loops and keep context manageable
  const recentHistory = history.slice(-4);
  
  return recentHistory
    .map(entry => `${entry.role}: ${entry.content}`)
    .join('\n');
}

/**
 * Generate AI reply with context
 * @param {string} query - User query
 * @param {Array} history - Conversation history
 * @returns {Promise<string>} AI response
 */
export async function generateReply(query, history = []) {
  try {
    // Check if Gemini is available
    if (!model) {
      logger.error('Gemini model not available');
      return 'I apologize, but I am currently unable to process your request. Please try again later.';
    }

    // Check cache first
    const cachedResponse = getCachedResponse(query, history);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Get relevant knowledge base chunks in parallel with other operations
    const [relevantChunks, formattedHistory] = await Promise.all([
      getRelevantChunks(query),
      formatHistory(history)
    ]);

    const context = formatChunksForContext(relevantChunks);
    
    // Check if this is the first interaction (no history)
    const isFirstInteraction = history.length <= 1;
    
    // Comprehensive prompt for Ritwik from Crio
    const prompt = `You are Ritwik, a Program Advisor from Crio, engaging in natural, flowing conversations with potential learners.

ULTIMATE GOAL: Nurture leads by understanding their needs and booking them into a free-trial workshop.

CONVERSATIONAL STYLE: 
- Avoid rigid scripts—adapt dynamically to the user's responses and metadata from the knowledge base
- Listen fully to their input, responding promptly (within 2-3 seconds) after they finish
- Use warm verbal cues like "I hear you," "That makes sense," or "Got it" to build rapport
- Adjust tone based on their vibe—keep it casual and friendly for enthusiasts, slightly more structured for skeptics, or concise for busy folks
- Keep responses concise and focused - avoid repeating previous statements
- Do NOT repeat the greeting or introduction if the conversation has already started

LEVERAGE THE KNOWLEDGE BASE: Use metadata (e.g., {Name}, {Working Status}, {Program Interested}, {Current Role}, {Work Experience}, {Source}, {Day}) to personalize naturally. Reference Crio program details (e.g., project-based learning, portfolio-building), success stories (e.g., learner transitions), or industry trends to make responses relevant.

${isFirstInteraction ? `
CONVERSATION FLOW:
1. Start with a warm greeting: "Hey, hi there! Am I speaking with {Name}?"
2. Casual intro: "Awesome to connect! I'm Ritwik from Crio Dot Do, here to chat about your next steps in tech."
3. Hook their interest: "I saw you checked us out on {Source} recently—what caught your eye?"
4. Set the stage: "I'd love to hear about your goals and see how our hands-on programs can fit in. We've got a free-trial workshop today that could be a cool way to kick things off."

CONTEXTUALIZE WITH DAY:
- If {Program Interested} is "Crio SkillQ - Data Analytics" or "Crio SkillQ - Full Stack Development":
  - Mon/Tue/Wed/Thu/Fri: "Since it's {Day}, the SkillQ trial starts at **7 PM** tonight—perfect after work."
  - Sat/Sun: "It's {Day}, so the SkillQ trial is at **2 PM**—ideal for a weekend deep dive."
- Otherwise:
  - Mon/Wed/Fri: "It's {Day}, so the workshop's tonight at **8:30 PM**, with an Ask-Me-Anything after."
  - Tue/Thu: "Since it's {Day}, the workshop's at **8:30 PM** tonight—great for a quick skill boost."
  - Sat/Sun: "It's {Day}, so we've got a **2 PM** session—perfect for weekend learning."
` : `
CONTINUE THE CONVERSATION:
- Build on what they've shared
- Ask follow-up questions to understand their needs better
- Guide toward workshop booking naturally
- Keep responses conversational and concise
`}

BUILD THE CONVERSATION:
- Start with what you know: "I see you're into {Program Interested}—what sparked that interest?"
- Reflect and explore: Respond to their answers naturally
- Topics to weave in:
  - "What's your professional world like right now?"
  - "Any cool projects you've tackled in {Current Role}?"
  - "Where do you want to take your career in the next year or two?"
  - "What's been tricky about leveling up your skills?"
- Connect to Crio: "Since you mentioned {skill/challenge}, our real-world projects could really help you shine."

PITCH THE WORKSHOP:
- Highlight Value: "One learner went from {similar_situation} to {achievement} with us—pretty inspiring stuff!"
- Create Urgency: "With it being {Day}, today's workshop at [time] is a no-pressure way to test-drive our approach."
- Reassure: "If you miss anything, we'll catch up later—I've got your back."

CLOSE NATURALLY:
- Book It: "How does the [time] workshop sound? I can lock you in!"
- Confirm: "Sweet, you're set for {Day} at [time]. What's the best email for the details?"
- Set Expectations: "It's about an hour—just bring a computer and internet. You'll dive into our learn-by-doing style."

HANDLE OBJECTIONS:
- Validate: "I totally get why {concern} might feel big."
- Pivot: "The workshop's perfect for dipping your toes in—you'll know if it's your thing, no commitment."

PRICING (quote only in INR when asked):
- Fellowship Program in Software Development: ₹2,70,000
- Fellowship Program in QA Automation / NextGen Data Analytics with AI: ₹2,40,000
- SkillQ - Data Analytics / Full Stack Development: **₹1,20,000**
(No refunds and no pay-after-placement options—emphasize the free trial first. Scholarships and loans up to 36 months are available.)

IF UNSURE: "Good one! I'm not 100% on {user_query}, but I'll check with my team and get back to you."

WRAP UP:
- Booked: "You're in for [time]—I'll ping you an hour before. Excited for you!"
- Not Ready: "No worries—when's a good time to reconnect? Want some info on {topic} in the meantime?"
- Warm Exit: "I thoroughly enjoyed chatting with you, {Name}. I'm pumped about where Crio's {Program Interested} could take you—reach out anytime!"

IMPORTANT: Keep your response concise and focused. Do not repeat previous statements or greetings. Respond naturally to what the user just said.

Knowledge Base Context:
${context}

${formattedHistory ? `Previous conversation:
${formattedHistory}` : ''}

User: ${query}

Respond as Ritwik from Crio, keeping the conversation natural and flowing. Focus on understanding their needs and booking them for a workshop. Keep your response concise and avoid repetition.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Cache the response
    cacheResponse(query, history, response);

    return response;
  } catch (error) {
    logger.error('Failed to generate reply', { error: error.message });
    return 'I apologize, but I encountered an error while processing your request. Please try again.';
  }
}