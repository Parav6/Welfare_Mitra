/**
 * Session Manager for Welfare Mitra
 * Tracks session states, pre-written questions, parsing inputs, and advancing stages.
 */

const { evaluateEligibility } = require('./eligibilityEngine');

const sessions = new Map();

// Localized question templates
const QUESTIONS = {
  0: {
    en: "Welcome to Welfare Mitra!\nSelect your language / अपनी भाषा चुनें / உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்:\n1. English\n2. Hindi (हिंदी)\n3. Tamil (தமிழ்)\n\n(Please reply with 1, 2, or 3)",
    hi: "कल्याण मित्र में आपका स्वागत है!\nअपनी भाषा चुनें / Select your language / உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்:\n1. English\n2. Hindi (हिंदी)\n3. Tamil (தமிழ்)\n\n(कृपया 1, 2 या 3 के साथ उत्तर दें)",
    ta: "நலன் மித்ராவிற்கு உங்களை வரவேற்கிறோம்!\nஉங்கள் மொழியைத் தேர்ந்தெடுக்கவும் / Select your language / अपनी भाषा चुनें:\n1. English\n2. Hindi (हिंदी)\n3. Tamil (தமிழ்)\n\n(தயவுசெய்து 1, 2 அல்லது 3 என பதிலளிக்கவும்)"
  },
  1: {
    en: "Step 1/6: What is your primary occupation?\n1. Farmer\n2. Daily Wage Worker\n3. Street Vendor\n4. Homemaker\n5. Student\n6. Other\n\n(Reply with the number)",
    hi: "चरण 1/6: आपका मुख्य व्यवसाय क्या है?\n1. किसान\n2. दैनिक वेतन भोगी मजदूर\n3. रेहड़ी-पटरी विक्रेता (स्ट्रीट वेंडर)\n4. गृहणी\n5. छात्र\n6. अन्य\n\n(संख्या के साथ उत्तर दें)",
    ta: "படி 1/6: உங்கள் முதன்மை தொழில் என்ன?\n1. விவசாயி\n2. தினசரி கூலி தொழிலாளி\n3. வீதி வியாபாரி\n4. இல்லத்தரசி\n5. மாணவர்\n6. மற்றவை\n\n(எண்ணை மட்டும் பதிலாக அனுப்பவும்)"
  },
  2: {
    en: "Step 2/6: Do you own agricultural land? If yes, how many acres? (Reply with 0 if you do not own land)",
    hi: "चरण 2/6: क्या आपके पास कृषि भूमि है? यदि हाँ, तो कितने एकड़? (यदि आपके पास भूमि नहीं है तो 0 लिखें)",
    ta: "படி 2/6: உங்களிடம் விவசாய நிலம் உள்ளதா? ஆம் எனில், எத்தனை ஏக்கர்? (நிலம் இல்லை எனில் 0 என உள்ளிடவும்)"
  },
  3: {
    en: "Step 3/6: What is your approximate annual household income in ₹ (Rupees)? (e.g. 150000)",
    hi: "चरण 3/6: आपकी वार्षिक पारिवारिक आय लगभग कितनी है (₹ में)? (जैसे 150000)",
    ta: "படி 3/6: உங்கள் தோராயமான ஆண்டு குடும்ப வருமானம் எவ்வளவு (₹)? (எ.கா. 150000)"
  },
  4: {
    en: "Step 4/6: Do you have a BPL (Below Poverty Line) / Ration Card?\n1. Yes\n2. No\n\n(Reply with the number)",
    hi: "चरण 4/6: क्या आपके पास बीपीएल (गरीबी रेखा से नीचे) या राशन कार्ड है?\n1. हाँ\n2. नहीं\n\n(संख्या के साथ उत्तर दें)",
    ta: "படி 4/6: உங்களிடம் பிபிஎல் (வறுமைக் கோட்டிற்கு கீழ்) அல்லது ரேஷன் கார்டு உள்ளதா?\n1. ஆம்\n2. இல்லை\n\n(எண்ணை மட்டும் பதிலாக அனுப்பவும்)"
  },
  5: {
    en: "Step 5/6: What is the gender of the head of your household?\n1. Female\n2. Male\n3. Other\n\n(Reply with the number)",
    hi: "चरण 5/6: आपके परिवार के मुखिया का लिंग क्या है?\n1. महिला\n2. पुरुष\n3. अन्य\n\n(संख्या के साथ उत्तर दें)",
    ta: "படி 5/6: உங்கள் குடும்பத் தலைவரின் பாலினம் என்ன?\n1. பெண்\n2. ஆண்\n3. மற்றவை\n\n(எண்ணை மட்டும் பதிலாக அனுப்பவும்)"
  },
  6: {
    en: "Step 6/6: Do you have a girl child under 10 years of age?\n1. Yes\n2. No\n\n(Reply with the number)",
    hi: "चरण 6/6: क्या आपकी 10 वर्ष से कम उम्र की बेटी है?\n1. हाँ\n2. नहीं\n\n(संख्या के साथ उत्तर दें)",
    ta: "படி 6/6: உங்களிடம் 10 வயதுக்குட்பட்ட பெண் குழந்தை உள்ளதா?\n1. ஆம்\n2. இல்லை\n\n(எண்ணை மட்டும் பதிலாக அனுப்பவும்)"
  }
};

const OCCUPATIONS = {
  1: 'farmer',
  2: 'daily wage',
  3: 'street vendor',
  4: 'homemaker',
  5: 'student',
  6: 'other'
};

const GENDERS = {
  1: 'female',
  2: 'male',
  3: 'other'
};

function getOrCreateSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, {
      phone,
      language: 'hi', // Default language is Hindi, detected/selected later
      step: 0,        // Step 0 is language selection
      answers: {
        occupation: null,
        land_acres: null,
        income: null,
        has_bpl_card: null,
        gender: null,
        has_girl_child: null
      },
      shortlist: [],
      current_scheme: null,
      history: []
    });
  }
  return sessions.get(phone);
}

function updateSession(phone, updates) {
  const session = getOrCreateSession(phone);
  Object.assign(session, updates);
  sessions.set(phone, session);
  return session;
}

function resetSession(phone) {
  sessions.delete(phone);
  return getOrCreateSession(phone);
}

/**
 * Validates and parses user response for the current step.
 * Returns true if valid and updates the session, false otherwise.
 */
function parseAndValidateInput(session, text) {
  if (text === undefined || text === null || typeof text !== 'string') {
    return false;
  }
  const cleanText = text.trim();
  const num = parseInt(cleanText);

  switch (session.step) {
    case 0: // Language selection
      if (num === 1 || cleanText.toLowerCase() === 'english') {
        session.language = 'en';
        return true;
      } else if (num === 2 || cleanText.toLowerCase() === 'hindi' || cleanText.toLowerCase() === 'हिंदी') {
        session.language = 'hi';
        return true;
      } else if (num === 3 || cleanText.toLowerCase() === 'tamil' || cleanText.toLowerCase() === 'தமிழ்') {
        session.language = 'ta';
        return true;
      }
      return false;

    case 1: // Occupation
      if (num >= 1 && num <= 6) {
        session.answers.occupation = OCCUPATIONS[num];
        return true;
      }
      // String backup
      const matchedOcc = Object.values(OCCUPATIONS).find(occ => cleanText.toLowerCase().includes(occ));
      if (matchedOcc) {
        session.answers.occupation = matchedOcc;
        return true;
      }
      return false;

    case 2: // Land acres
      const acres = parseFloat(cleanText);
      if (!isNaN(acres) && acres >= 0) {
        session.answers.land_acres = acres;
        return true;
      }
      return false;

    case 3: // Income
      // Extract numbers
      const cleanedIncome = cleanText.replace(/[^0-9.]/g, '');
      const incomeVal = parseFloat(cleanedIncome);
      if (!isNaN(incomeVal) && incomeVal >= 0) {
        session.answers.income = incomeVal;
        return true;
      }
      return false;

    case 4: // BPL card
      if (num === 1 || cleanText.toLowerCase() === 'yes' || cleanText.includes('हाँ') || cleanText.includes('ஆம்')) {
        session.answers.has_bpl_card = true;
        return true;
      } else if (num === 2 || cleanText.toLowerCase() === 'no' || cleanText.includes('नहीं') || cleanText.includes('இல்லை')) {
        session.answers.has_bpl_card = false;
        return true;
      }
      return false;

    case 5: // Gender
      if (num >= 1 && num <= 3) {
        session.answers.gender = GENDERS[num];
        return true;
      }
      const matchedGender = Object.values(GENDERS).find(g => cleanText.toLowerCase().includes(g));
      if (matchedGender) {
        session.answers.gender = matchedGender;
        return true;
      }
      return false;

    case 6: // Girl child under 10
      if (num === 1 || cleanText.toLowerCase() === 'yes' || cleanText.includes('हाँ') || cleanText.includes('ஆம்')) {
        session.answers.has_girl_child = true;
        return true;
      } else if (num === 2 || cleanText.toLowerCase() === 'no' || cleanText.includes('नहीं') || cleanText.includes('இல்லை')) {
        session.answers.has_girl_child = false;
        return true;
      }
      return false;

    default:
      return true;
  }
}

/**
 * Retrieves the message corresponding to the current step.
 */
function getQuestion(session) {
  const step = session.step;
  const lang = session.language || 'en';
  return QUESTIONS[step] ? QUESTIONS[step][lang] : null;
}

module.exports = {
  getOrCreateSession,
  updateSession,
  resetSession,
  parseAndValidateInput,
  getQuestion,
  QUESTIONS
};
