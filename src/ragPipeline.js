/**
 * RAG Pipeline for Welfare Mitra
 * Retrieves scheme contexts from local JSON records and queries the Gemini LLM.
 * Implements strict honesty guardrails, citing constraints, and word limits.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { loadSchemes } = require('./eligibilityEngine');
require('dotenv').config();

// Initialize Gemini if key is present
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * Searches the scheme database to retrieve the top matching schemes for a query.
 * Prioritizes schemes in the user's eligibility shortlist.
 * @param {string} query User's query
 * @param {Array<string>} shortlist Session eligible scheme IDs
 * @returns {Array<Object>} List of matched scheme JSON objects
 */
function retrieveSchemes(query, shortlist = []) {
  const schemes = loadSchemes();
  const safeQuery = typeof query === 'string' ? query : '';
  const queryTokens = safeQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  const scoredSchemes = schemes.map(scheme => {
    let score = 0;
    
    // Boost score if scheme is in user's eligible shortlist
    if (shortlist.includes(scheme.scheme_id)) {
      score += 5;
    }
    
    // Check keyword matches in titles, benefits, documents, and ID
    const contentToSearch = [
      scheme.scheme_id,
      scheme.name_en,
      scheme.name_hi,
      scheme.name_ta,
      scheme.benefit_en,
      scheme.benefit_hi,
      scheme.benefit_ta,
      ...(scheme.documents_en || []),
      ...(scheme.documents_hi || []),
      ...(scheme.documents_ta || [])
    ].join(' ').toLowerCase();
    
    queryTokens.forEach(token => {
      if (contentToSearch.includes(token)) {
        score += 2;
      }
    });
    
    return { scheme, score };
  });

  // Sort and select top 3 schemes with score > 0 (or fallback to shortlist if nothing matches)
  const results = scoredSchemes
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.scheme)
    .slice(0, 3);
    
  if (results.length === 0 && shortlist.length > 0) {
    // Return the shortlist schemes as default context
    return schemes.filter(s => shortlist.includes(s.scheme_id)).slice(0, 3);
  }
  
  return results.length > 0 ? results : schemes.slice(0, 2); // Default fallback to first 2 schemes
}

/**
 * Formats scheme details into structured context text blocks for the LLM.
 */
function formatSchemeContext(schemes, lang = 'en') {
  return schemes.map(s => {
    const docs = s[`documents_${lang}`] || s.documents_en;
    const name = s[`name_${lang}`] || s.name_en;
    const benefit = s[`benefit_${lang}`] || s.benefit_en;
    
    return `Scheme ID: ${s.scheme_id}
Name: ${name}
Benefit: ${benefit}
Required Documents:
- ${docs.join('\n- ')}
Application Link: ${s.application_url}
Official Helpline: ${s.helpline || '1800-11-6446'}`;
  }).join('\n\n---\n\n');
}

/**
 * Queries Gemini using RAG to answer user questions about schemes.
 * @param {string} query User message
 * @param {Object} session Active session object
 * @returns {Promise<string>} Answer from Gemini
 */
async function queryLLM(query, session) {
  if (!genAI) {
    // If no API key, return a placeholder/mock response
    return `[Mock response in ${session.language.toUpperCase()}]: The Gemini API key is not set. However, according to your profile, you qualify for the following schemes: ${session.shortlist.join(', ')}. Please configure the GEMINI_API_KEY in .env to enable active chat.`;
  }

  const matchedSchemes = retrieveSchemes(query, session.shortlist);
  const context = formatSchemeContext(matchedSchemes, session.language);
  const userLang = session.language || 'en';

  const systemPrompt = `You are "Welfare Mitra", an empathetic and helpful conversational AI assistant designed to help rural Indian citizens discover and apply for government welfare schemes.
The user is speaking with you. Their current profile eligibility shortlist is: [${session.shortlist.join(', ')}].

CRITICAL CONSTRAINTS:
1. Answer ONLY based on the following scheme information:
---
${context}
---
2. If the user asks about eligibility or a scheme that is not in the context, or if the answer cannot be found in the context, strictly respond in their language: "मुझे यह जानकारी नहीं है" (I don't have this information) and give the official government helpline number: 1800-11-6446. Never guess eligibility or hallucinate entitlements.
3. Every response must be concise, readable on a small mobile screen, and strictly under 150 words.
4. The user may write in mixed Hindi-English (Hinglish) or Tamil-English (Tanglish). Understand it naturally. Respond in the language they used (e.g. if they write in Hinglish, respond in simple, natural Hinglish; if they write in Tamil, respond in Tamil; if English, respond in English).
5. Never state someone IS eligible for a scheme unless it is explicitly listed in their shortlist [${session.shortlist.join(', ')}]. If they are eligible, guide them with the required documents and application link.`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest',
      systemInstruction: systemPrompt
    });
    
    // Assemble recent chat history for context, ensuring it starts with a 'user' role for SDK compliance
    let recentHistory = session.history.slice(-6).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const firstUserIdx = recentHistory.findIndex(msg => msg.role === 'user');
    if (firstUserIdx !== -1) {
      recentHistory = recentHistory.slice(firstUserIdx);
    } else {
      recentHistory = [];
    }

    // Start chat with history and system instruction
    const chat = model.startChat({
      history: recentHistory,
      generationConfig: {
        maxOutputTokens: 1000, // Increased for non-English tokenization room
        temperature: 0.2 // Keep temperature low to prevent hallucination
      }
    });

    const result = await chat.sendMessage(query);
    let reply = result.response.text().trim();
    
    // Enforce word limit string slicing if LLM goes over
    const words = reply.split(/\s+/);
    if (words.length > 160) {
      reply = words.slice(0, 160).join(' ') + '...';
    }
    
    return reply;
  } catch (err) {
    console.error("Gemini RAG query failed:", err);
    return `Sorry, I encountered an issue. Please call the official helpline: 1800-11-6446. (error: ${err.message})`;
  }
}

module.exports = {
  retrieveSchemes,
  formatSchemeContext,
  queryLLM
};
