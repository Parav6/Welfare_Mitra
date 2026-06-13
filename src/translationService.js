/**
 * Translation Service for Welfare Mitra
 * Handles script detection, Bhashini API calls (if credentials provided),
 * and falls back to Gemini LLM for translation.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Gemini if key is present
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * Automatically detects language based on Unicode character script inspection.
 * Falls back to 'en' or mixed.
 * @param {string} text 
 * @returns {string} Detected language code: 'hi', 'ta', or 'en'
 */
function detectLanguage(text) {
  if (!text) return 'en';
  
  // Hindi Unicode range: 0900 to 097F
  const hindiRegex = /[\u0900-\u097F]/;
  // Tamil Unicode range: 0B80 to 0BFF
  const tamilRegex = /[\u0B80-\u0BFF]/;

  if (hindiRegex.test(text)) {
    return 'hi';
  }
  if (tamilRegex.test(text)) {
    return 'ta';
  }
  
  // Default/Fallback
  return 'en';
}

/**
 * Translates a text string between English, Hindi, and Tamil.
 * Uses Bhashini if configured, falls back to Gemini LLM, and finally returns original on failure.
 */
async function translateText(text, targetLang, sourceLang = null) {
  if (!text || !targetLang) return text;
  
  const detectedSource = sourceLang || detectLanguage(text);
  if (detectedSource === targetLang) return text;

  // 1. Try Bhashini API if credentials are present
  if (process.env.BHASHINI_API_KEY && process.env.BHASHINI_USER_ID) {
    try {
      const result = await translateWithBhashini(text, detectedSource, targetLang);
      if (result) return result;
    } catch (err) {
      console.warn("Bhashini translation failed, falling back to Gemini:", err.message);
    }
  }

  // 2. Fallback to Gemini API
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const languageNames = {
        en: 'English',
        hi: 'Hindi',
        ta: 'Tamil'
      };

      const prompt = `Translate the following text from ${languageNames[detectedSource] || 'Auto-detect'} to ${languageNames[targetLang]}.
Provide ONLY the translated text, with no explanations, introduction, or quotes.

Text to translate:
"${text}"`;

      const response = await model.generateContent(prompt);
      const translated = response.response.text().trim();
      // Remove enclosing quotes if model added them
      return translated.replace(/^"|"$/g, '');
    } catch (err) {
      console.error("Gemini translation fallback failed:", err);
    }
  }

  // 3. Last resort: Return original text
  return text;
}

/**
 * Internal helper to simulate/call Bhashini translation API
 */
async function translateWithBhashini(text, sourceLang, targetLang) {
  // Bhashini expects ISO-2 format or custom lang codes (e.g., 'hi', 'ta', 'en')
  // We place a standard Bhashini HTTP POST template here.
  // URL: https://meity-auth.ulca.in/ulca/apis/v0/model/getModelsPipeline
  // This complies with Bhashini's MeitY specifications.
  
  const payload = {
    pipelineTasks: [
      {
        taskType: "translation",
        config: {
          language: {
            sourceLanguage: sourceLang,
            targetLanguage: targetLang
          }
        }
      }
    ],
    pipelineRequestConfig: {
      pipelineId: process.env.BHASHINI_PIPELINE_ID || "64392f55f603c1520e545bb8"
    }
  };

  // If mock Bhashini is explicitly set for testing
  if (process.env.MOCK_BHASHINI === 'true') {
    return `[Bhashini Mocked Translation to ${targetLang}]: ${text}`;
  }

  // Fetch using native Node.js fetch (Node 18+)
  const response = await fetch("https://dhruva.gov.in/services/inference/pipeline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": process.env.BHASHINI_API_KEY,
      "userID": process.env.BHASHINI_USER_ID,
      "ulcaApiKey": process.env.BHASHINI_ULCA_API_KEY || process.env.BHASHINI_API_KEY
    },
    body: JSON.stringify({
      pipelineTasks: [
        {
          taskType: "translation",
          config: {
            language: {
              sourceLanguage: sourceLang,
              targetLanguage: targetLang
            },
            serviceId: `ai4bharat/indictrans2-bilingual-${sourceLang}-${targetLang}`
          }
        }
      ],
      inputData: {
        input: [
          {
            source: text
          }
        ]
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Bhashini API error: ${response.statusText}`);
  }

  const data = await response.json();
  if (data && data.pipelineResponse && data.pipelineResponse[0] && data.pipelineResponse[0].output && data.pipelineResponse[0].output[0]) {
    return data.pipelineResponse[0].output[0].target;
  }
  
  return null;
}

module.exports = {
  detectLanguage,
  translateText
};
