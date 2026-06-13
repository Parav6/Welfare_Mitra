/**
 * Eligibility Rule Engine for Welfare Mitra
 * Maps answer variables to 10 key government schemes.
 * Deterministic and free from LLM hallucinations.
 */

const fs = require('fs');
const path = require('path');

// Cache schemes loaded from JSON
let schemesCache = null;

function loadSchemes() {
  if (schemesCache) return schemesCache;
  const schemesDir = path.join(__dirname, '../data/schemes');
  const files = fs.readdirSync(schemesDir);
  schemesCache = files
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const filePath = path.join(schemesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    });
  return schemesCache;
}

/**
 * Evaluates which schemes the user is eligible for based on their answers.
 * @param {Object} answers User's responses to the 6 questions
 * @returns {Array<string>} List of eligible scheme IDs
 */
function evaluateEligibility(answers) {
  const eligibleSchemes = [];
  
  // Format answers for strict check
  const occupation = (answers.occupation || '').toLowerCase().trim();
  const landAcres = parseFloat(answers.land_acres) || 0;
  const income = parseFloat(answers.income) || 0;
  const hasBplCard = !!answers.has_bpl_card;
  const gender = (answers.gender || '').toLowerCase().trim();
  const hasGirlChild = !!answers.has_girl_child;

  // 1. PM-KISAN: Small/marginal farmers, land <= 5 acres
  if (occupation === 'farmer' && landAcres > 0 && landAcres <= 5) {
    eligibleSchemes.push('PM_KISAN');
  }

  // 2. Ayushman Bharat (PMJAY): BPL card or income < 250,000
  if (hasBplCard || income < 250000) {
    eligibleSchemes.push('AYUSHMAN_BHARAT');
  }

  // 3. PMAY-Gramin: Homeless/kutcha house, BPL card or income < 150,000
  if (hasBplCard || income < 150000) {
    eligibleSchemes.push('PMAY_GRAMIN');
  }

  // 4. Pradhan Mantri Ujjwala Yojana (PMUY): Female BPL household head
  if (gender === 'female' && hasBplCard) {
    eligibleSchemes.push('PM_UJJWALA');
  }

  // 5. MGNREGA: Rural manual wage job seekers (income < 300,000 and not a full-time student)
  if (occupation !== 'student' && income < 300000) {
    eligibleSchemes.push('MGNREGA');
  }

  // 6. Sukanya Samriddhi Yojana (SSY): Parents of girl child under 10
  if (hasGirlChild) {
    eligibleSchemes.push('SUKANYA_SAMRIDDHI');
  }

  // 7. PM Fasal Bima Yojana (PMFBY): Farmers with crop land
  if (occupation === 'farmer' && landAcres > 0) {
    eligibleSchemes.push('PM_FASAL_BIMA');
  }

  // 8. Janani Suraksha Yojana (JSY): Pregnant women (represented by female head/applicant & BPL/low income)
  if (gender === 'female' && (hasBplCard || income < 200000)) {
    eligibleSchemes.push('JANANI_SURAKSHA');
  }

  // 9. PM SVANidhi: Street vendors
  if (occupation === 'street vendor') {
    eligibleSchemes.push('PM_SVANIDHI');
  }

  // 10. National Scholarship Scheme (NSP): Students with income < 250,000
  if (occupation === 'student' && income < 250000) {
    eligibleSchemes.push('SCHOLARSHIP_NSP');
  }

  return eligibleSchemes;
}

module.exports = {
  evaluateEligibility,
  loadSchemes
};
