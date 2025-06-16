# AI Voice Agent with Twilio, Deepgram, and Gemini

## Overview
This real-time AI voice agent makes and receives calls using:
- **Twilio** for call handling and voice playback
- **Deepgram** for STT and TTS
- **Gemini** for AI-generated responses

## How It Works
1. User speaks on a call initiated by Twilio.
2. Twilio sends user speech via `<Gather>` to `/process-speech`.
3. Deepgram transcribes → Gemini responds → Deepgram synthesizes TTS.
4. The generated `.wav` is served via `<Play>` and the call loops back.

## Setup
1. `npm install`
2. Create `.env` (see example)
3. Start server: `node src/server.js`
4. Use `ngrok http 5000` and configure Twilio webhook to `/start`

## Folder Structure
- `src/routes`: Twilio endpoint handlers
- `src/services`: AI + audio integrations
- `public/audio`: Hosted TTS replies

## License
MIT
