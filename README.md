# AI Voice Agent with Twilio, Deepgram, and Gemini

## Overview
This real-time AI voice agent makes and receives calls using:
- **Twilio** for call handling and voice playback
- **Deepgram** for text-to-speech synthesis
- **Gemini** for AI-generated responses
- **Redis** (optional) for caching with in-memory fallback

## How It Works
1. User speaks on a call initiated by Twilio
2. Twilio sends user speech via `<Gather>` to `/process-speech`
3. Gemini generates AI response using conversation history and knowledge base
4. Deepgram synthesizes TTS from the response
5. The generated `.wav` is served via `<Play>` and the call loops back

## Features
- Real-time voice conversations with AI
- Knowledge base integration for contextual responses
- Conversation history tracking
- Caching for improved performance
- Graceful fallbacks when services are unavailable
- Objection handling and conversation state management

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `env.example` to `.env` and configure your environment variables:

```bash
cp env.example .env
```

Required environment variables:
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `TWILIO_NUMBER` - Your Twilio phone number
- `DEEPGRAM_API_KEY` - Your Deepgram API key
- `GEMINI_API_KEY` - Your Google Gemini API key
- `SERVER_HOST` - Your public server URL (for ngrok)

Optional:
- `REDIS_URL` - Redis connection URL (uses in-memory fallback if not provided)
- `KNOWLEDGE_BASE_DIR` - Path to knowledge base files (defaults to `./knowledge-base`)
- `PORT` - Server port (defaults to 5000)

### 3. Start the Server
```bash
npm start
```

### 4. Expose with ngrok
```bash
ngrok http 5000
```

### 5. Configure Twilio Webhook
Set your Twilio webhook URL to: `https://your-ngrok-url.ngrok.io/start`

## API Endpoints

### POST `/start`
Handles incoming voice calls and initiates conversation.

### POST `/process-speech`
Processes speech input from Twilio Gather and returns AI response.

### POST `/trigger-call`
Initiates outbound calls to specified phone numbers.

## Folder Structure
```
src/
├── routes/           # Twilio endpoint handlers
├── services/         # AI + audio integrations
│   ├── twilioService.js
│   ├── deepgramService.js
│   ├── geminiService.js
│   ├── knowledgeBaseService.js
│   └── cacheService.js
├── utils/            # Utility functions
│   ├── logger.js
│   ├── conversationManager.js
│   └── conversationStateManager.js
└── server.js         # Main server file
public/
└── audio/           # Generated TTS audio files
conversations/       # Conversation history files
```

## Knowledge Base
Place your knowledge base files (`.txt` format) in the `KNOWLEDGE_BASE_DIR` directory. The system will automatically index and use these files to provide contextual responses.

## Caching
The system uses Redis for caching with an in-memory fallback. If Redis is not available, the system will continue to work using local memory caching.

## Error Handling
The system includes comprehensive error handling:
- Graceful degradation when services are unavailable
- Fallback responses for failed AI generation
- Automatic retry mechanisms
- Detailed logging for debugging

## License
MIT
