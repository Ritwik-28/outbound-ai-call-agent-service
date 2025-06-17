#!/usr/bin/env node

import dotenv from 'dotenv';
import { generateReply } from './src/services/geminiService.js';

dotenv.config();

async function testGemini() {
  console.log('🧪 Testing Gemini Integration...\n');
  
  try {
    const testQuery = "Hi, I'm interested in learning about data analytics. What programs do you have?";
    console.log(`📝 Test Query: "${testQuery}"`);
    
    const response = await generateReply(testQuery, []);
    console.log(`🤖 Gemini Response: "${response}"`);
    
    console.log('\n✅ Gemini integration test completed successfully!');
  } catch (error) {
    console.error('❌ Gemini integration test failed:', error.message);
  }
}

testGemini(); 