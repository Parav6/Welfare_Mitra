/**
 * Welfare Mitra Frontend Logic
 * Manages chat lifecycle, persona selections, RAG logs console, tab switches, and metrics.
 */

// Generate a random session phone number for the active browser session
let currentPhone = localStorage.getItem('chatSessionPhone') || `+91-${Math.floor(Math.random() * 9000000000) + 1000000000}`;
localStorage.setItem('chatSessionPhone', currentPhone);

document.getElementById('statePhone').textContent = currentPhone;

let activeLanguage = 'hi';
let activeStep = 0;
let currentShortlist = [];
let allSchemes = [];

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const sendBtnIcon = document.getElementById('sendBtnIcon');
const botStatus = document.getElementById('botStatus');
const consoleLogs = document.getElementById('consoleLogs');

// Initialize Chat on load
document.addEventListener('DOMContentLoaded', () => {
  initChat();
  loadSchemesList();
  updateMetricsUI();
  
  // Input key listener
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  // Icon switcher (Send/Mic) based on input text
  userInput.addEventListener('input', () => {
    if (userInput.value.trim().length > 0) {
      sendBtnIcon.className = 'fa-solid fa-paper-plane';
    } else {
      sendBtnIcon.className = 'fa-solid fa-microphone';
    }
  });

  // Attach record simulation handler
  document.getElementById('recordAudioBtn').addEventListener('click', simulateAudioNote);
  sendBtn.addEventListener('click', () => {
    if (userInput.value.trim().length > 0) {
      sendMessage();
    } else {
      simulateAudioNote();
    }
  });
});

/**
 * Initialize Chat session state
 */
async function initChat() {
  addLog('Initializing session...', 'info');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone })
    });
    const data = await res.json();
    
    // Render starting greeting question
    renderBotBubble(data.reply);
    updateStateUI(data);
    addLog(`Welcome greeting loaded. Step: ${data.step}, Lang: ${data.language}`, 'response');
  } catch (err) {
    addLog(`Initialization failed: ${err.message}`, 'error');
  }
}

/**
 * Sends a text message to the server
 */
async function sendMessage(textToSend = null) {
  const text = textToSend || userInput.value.trim();
  if (!text) return;

  if (!textToSend) {
    userInput.value = '';
    sendBtnIcon.className = 'fa-solid fa-microphone';
  }

  // Render User Message
  renderUserBubble(text);
  
  // Show Typing
  setTyping(true);
  addLog(`Sending input: "${text}"`, 'request');

  const startTime = Date.now();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone, message: text })
    });
    
    const data = await res.json();
    setTyping(false);
    
    const latency = Date.now() - startTime;
    addLog(`Received response in ${latency}ms. Step: ${data.step}, Lang: ${data.language}`, 'response');
    
    if (data.step >= 7) {
      addLog(`RAG query processed. Shortlist size: ${data.shortlist.length}`, 'rag');
    }

    renderBotBubble(data.reply);
    updateStateUI(data);
    updateMetricsUI();
  } catch (err) {
    setTyping(false);
    addLog(`Error sending message: ${err.message}`, 'error');
    renderBotBubble(`Connection issue: Please call helpline: 1800-11-6446`);
  }
}

/**
 * Simulates a Voice Note input by the user (ASR Simulation)
 */
function simulateAudioNote() {
  let audioTranscript = '';
  let mockWaveDuration = 2500;
  const lang = activeLanguage || 'hi';

  const transcripts = {
    0: {
      en: "1",
      hi: "2",
      ta: "3"
    },
    1: {
      en: "Farmer",
      hi: "किसान (Farmer)",
      ta: "விவசாயி (Farmer)"
    },
    2: {
      en: "3",
      hi: "3",
      ta: "3"
    },
    3: {
      en: "45000",
      hi: "45000",
      ta: "45000"
    },
    4: {
      en: "Yes",
      hi: "हाँ (Yes)",
      ta: "ஆம் (Yes)"
    },
    5: {
      en: "Female",
      hi: "महिला (Female)",
      ta: "பெண் (Female)"
    },
    6: {
      en: "Yes",
      hi: "हाँ (Yes)",
      ta: "ஆம் (Yes)"
    }
  };

  const logPrompts = {
    0: {
      en: "[ASR] Voice note: 'Select English'",
      hi: "[ASR] Voice note: 'हिंदी भाषा चुनें' (Select Hindi)",
      ta: "[ASR] Voice note: 'தமிழ் மொழியைத் தேர்ந்தெடுக்கவும்' (Select Tamil)"
    },
    1: {
      en: "[ASR] Voice note: 'I am a farmer'",
      hi: "[ASR] Voice note: 'मैं एक किसान हूँ' (I am a farmer)",
      ta: "[ASR] Voice note: 'நான் ஒரு விவசாயி' (I am a farmer)"
    },
    2: {
      en: "[ASR] Voice note: 'I own three acres of land'",
      hi: "[ASR] Voice note: 'मेरे पास तीन एकड़ जमीन है' (I have 3 acres)",
      ta: "[ASR] Voice note: 'என்னிடம் மூன்று ஏக்கர் நிலம் உள்ளது' (I have 3 acres)"
    },
    3: {
      en: "[ASR] Voice note: 'My annual income is forty five thousand rupees'",
      hi: "[ASR] Voice note: 'मेरी आमदनी पैंतालीस हजार रुपये साल की है' (My income is 45,000/yr)",
      ta: "[ASR] Voice note: 'என் ஆண்டு வருமானம் நாற்பத்தி ஐந்தாயிரம் ரூபாய்' (My income is 45,000/yr)"
    },
    4: {
      en: "[ASR] Voice note: 'Yes, I have a BPL card'",
      hi: "[ASR] Voice note: 'हाँ, मेरे पास राशन कार्ड है' (Yes, I have a BPL card)",
      ta: "[ASR] Voice note: 'ஆம், என்னிடம் ரேஷன் கார்டு உள்ளது' (Yes, I have a BPL card)"
    },
    5: {
      en: "[ASR] Voice note: 'Female head of household'",
      hi: "[ASR] Voice note: 'घर की मुखिया महिला हैं' (Female head of household)",
      ta: "[ASR] Voice note: 'குடும்பத் தலைவி பெண்' (Female head of household)"
    },
    6: {
      en: "[ASR] Voice note: 'Yes, I have a daughter under ten'",
      hi: "[ASR] Voice note: 'हाँ, मेरी बेटी दस साल से कम की है' (Yes, daughter under 10)",
      ta: "[ASR] Voice note: 'ஆம், எனக்கு பத்து வயதுக்குட்பட்ட பெண் குழந்தை உள்ளது' (Yes, daughter under 10)"
    }
  };

  if (activeStep <= 6) {
    audioTranscript = transcripts[activeStep][lang];
    addLog(logPrompts[activeStep][lang], 'info');
  } else {
    // RAG stage
    if (lang === 'hi') {
      audioTranscript = "पीएम किसान योजना क्या है और पैसा कब मिलेगा?";
    } else if (lang === 'ta') {
      audioTranscript = "ஆயுஷ்மான் பாரத் திட்டத்தில் என்ன நன்மைகள் கிடைக்கும்?";
    } else {
      audioTranscript = "What documents do I need for PM SVANidhi?";
    }
    addLog(`[ASR] Transcribing Voice Message: "${audioTranscript}"`, 'info');
  }

  // Render visual Audio Wave bubble in chat
  const bubbleId = 'audio-' + Date.now();
  const timeStr = getFormattedTime();
  
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble msg-user';
  bubble.innerHTML = `
    <div class="audio-msg" id="${bubbleId}">
      <i class="fa-solid fa-play audio-msg-play" onclick="playMockAudio('${bubbleId}')"></i>
      <div class="audio-waveform">
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
        <div class="audio-wave-bar"></div>
      </div>
      <span>0:03</span>
    </div>
    <div class="msg-meta">
      <span>${timeStr}</span> <i class="fa-solid fa-check-double"></i>
    </div>
  `;
  
  chatMessages.appendChild(bubble);
  scrollToBottom();

  // Highlight wave animation active
  const audioEl = document.getElementById(bubbleId);
  audioEl.classList.add('audio-playing');

  // Trigger transcribing typing delay
  setTimeout(() => {
    audioEl.classList.remove('audio-playing');
    // Append small text indicator showing transcription
    const transcriptionIndicator = document.createElement('div');
    transcriptionIndicator.style.fontSize = '0.75rem';
    transcriptionIndicator.style.color = '#8696a0';
    transcriptionIndicator.style.marginTop = '4px';
    transcriptionIndicator.style.fontStyle = 'italic';
    transcriptionIndicator.innerHTML = `<i class="fa-solid fa-pen-nib"></i> Transcript: "${audioTranscript}"`;
    bubble.insertBefore(transcriptionIndicator, bubble.querySelector('.msg-meta'));
    
    // Now trigger message processing
    sendMessage(audioTranscript);
  }, mockWaveDuration);
}

function playMockAudio(id) {
  const el = document.getElementById(id);
  const icon = el.querySelector('.audio-msg-play');
  
  if (el.classList.contains('audio-playing')) {
    el.classList.remove('audio-playing');
    icon.className = 'fa-solid fa-play audio-msg-play';
  } else {
    el.classList.add('audio-playing');
    icon.className = 'fa-solid fa-pause audio-msg-play';
    setTimeout(() => {
      el.classList.remove('audio-playing');
      icon.className = 'fa-solid fa-play audio-msg-play';
    }, 3000);
  }
}

/**
 * Load persona preset with 1-click
 */
async function loadPersona(personaName) {
  addLog(`Quick-loading persona preset: [${personaName.toUpperCase()}]`, 'info');
  chatMessages.innerHTML = '';
  setTyping(true);
  
  try {
    const res = await fetch('/api/session/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone, personaName })
    });
    const data = await res.json();
    setTyping(false);
    
    // Add user config simulation display message
    const answersText = Object.entries(data.answers).map(([k,v]) => `${k}: ${v}`).join(', ');
    renderUserBubble(`[Preset Load]: Evaluated answers profile: { ${answersText} }`);
    
    renderBotBubble(data.reply);
    updateStateUI(data);
    updateMetricsUI();
    addLog(`Persona loaded. Shortlisted ${data.shortlist.length} schemes!`, 'response');
  } catch (err) {
    setTyping(false);
    addLog(`Error loading persona: ${err.message}`, 'error');
  }
}

/**
 * Resets the session state
 */
async function resetChat() {
  addLog('Resetting session...', 'info');
  chatMessages.innerHTML = '';
  setTyping(true);
  
  try {
    const res = await fetch('/api/session/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone })
    });
    const data = await res.json();
    setTyping(false);
    
    renderBotBubble(data.reply);
    updateStateUI(data);
    updateMetricsUI();
    addLog('Session reset successfully.', 'info');
  } catch (err) {
    setTyping(false);
    addLog(`Error resetting: ${err.message}`, 'error');
  }
}

/**
 * Renders user chat bubble
 */
function renderUserBubble(text) {
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble msg-user';
  bubble.innerHTML = `
    <div>${escapeHtml(text)}</div>
    <div class="msg-meta">
      <span>${getFormattedTime()}</span> <i class="fa-solid fa-check-double"></i>
    </div>
  `;
  chatMessages.appendChild(bubble);
  scrollToBottom();
}

/**
 * Renders bot chat bubble with basic markdown formatting (*bold*, ✅, 💰, etc.)
 */
function renderBotBubble(text) {
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble msg-bot';
  
  // Simple markdown conversion: *bold* -> <strong>bold</strong>, and replacement of double newlines
  let formattedText = escapeHtml(text)
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  bubble.innerHTML = `
    <div>${formattedText}</div>
    <div class="msg-meta">
      <span>${getFormattedTime()}</span>
    </div>
  `;
  chatMessages.appendChild(bubble);
  scrollToBottom();
  
  // Play a subtle notification text-to-speech simulation sound if Bhashini ASR/TTS demo is clicked
}

function setTyping(isTyping) {
  if (isTyping) {
    botStatus.textContent = 'Typing...';
    botStatus.className = 'status-typing';
  } else {
    botStatus.textContent = 'Online';
    botStatus.className = 'status-online';
  }
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getFormattedTime() {
  const now = new Date();
  let hrs = now.getHours();
  let mins = now.getMinutes();
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12 || 12;
  mins = mins < 10 ? '0' + mins : mins;
  return `${hrs}:${mins} ${ampm}`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Update UI telemetry state display
 */
function updateStateUI(data) {
  activeStep = data.step;
  activeLanguage = data.language || 'hi';
  currentShortlist = data.shortlist || [];

  const langNames = { en: 'English', hi: 'Hindi', ta: 'Tamil' };
  document.getElementById('stateLang').innerHTML = `<span class="lang-dot ${data.language}"></span> ${langNames[data.language] || data.language}`;
  
  const stepText = data.step === 7 ? '7 / 7 (RAG Chat Active)' : `${data.step} / 6`;
  document.getElementById('stateStep').textContent = stepText;
  
  const shortlistText = data.shortlist && data.shortlist.length > 0 ? data.shortlist.join(', ') : 'None';
  document.getElementById('stateShortlist').textContent = shortlistText;

  if (data.answers) {
    document.getElementById('stateAnswersJSON').textContent = JSON.stringify(data.answers, null, 2);
  }
}

/**
 * Switch tabs in dashboard
 */
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.getAttribute('onclick').includes(tabId));
  if (activeBtn) activeBtn.classList.add('active');
  
  document.getElementById(tabId).classList.add('active');
}

/**
 * Logs data to developer console logger UI
 */
function addLog(text, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line log-${type}`;
  line.innerHTML = `[${new Date().toLocaleTimeString()}] ${text}`;
  consoleLogs.appendChild(line);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

/**
 * Fetch and load all schemes into Catalog view
 */
async function loadSchemesList() {
  try {
    const res = await fetch('/api/schemes');
    allSchemes = await res.json();
    renderSchemes(allSchemes);
  } catch (err) {
    addLog(`Error fetching schemes database: ${err.message}`, 'error');
  }
}

function renderSchemes(schemes) {
  const container = document.getElementById('schemeList');
  container.innerHTML = '';

  schemes.forEach(s => {
    const item = document.createElement('div');
    item.className = 'scheme-item';
    item.innerHTML = `
      <div class="scheme-title-row">
        <h4>${s.name_en}</h4>
        <span class="tag tag-hi">${s.scheme_id}</span>
      </div>
      <div class="scheme-body">
        <p><strong>Benefit:</strong> ${s.benefit_en}</p>
        <p><strong>Documents:</strong> ${s.documents_en.join(', ')}</p>
        <div class="scheme-meta-grid">
          <div class="scheme-meta-item"><strong>Helpline:</strong> ${s.helpline}</div>
          <div class="scheme-meta-item"><strong>Apply:</strong> <a href="${s.application_url}" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">Link <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.65rem;"></i></a></div>
          <div class="scheme-meta-item"><strong>Occupation:</strong> ${s.eligibility.occupation || 'Any'}</div>
          <div class="scheme-meta-item"><strong>Max Acres:</strong> ${s.eligibility.land_acres_max || 'No limit'}</div>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function filterSchemes() {
  const q = document.getElementById('schemeSearch').value.toLowerCase();
  const filtered = allSchemes.filter(s => {
    return s.name_en.toLowerCase().includes(q) || 
           s.scheme_id.toLowerCase().includes(q) || 
           s.benefit_en.toLowerCase().includes(q) || 
           (s.eligibility.occupation && s.eligibility.occupation.toLowerCase().includes(q));
  });
  renderSchemes(filtered);
}

/**
 * Telemetry Updates
 */
async function updateMetricsUI() {
  try {
    const res = await fetch('/api/metrics');
    const data = await res.json();

    document.getElementById('metricCompletion').textContent = `${data.completionRate}%`;
    document.getElementById('metricComprehension').textContent = `${data.comprehensionScore}%`;
    document.getElementById('metricLatency').textContent = `${data.medianLatencyMs}ms`;

    // Render drop-offs chart bars
    const steps = ['step0_lang', 'step1_occ', 'step2_land', 'step3_inc', 'step4_bpl', 'step5_gender', 'step6_girl'];
    const maxVal = Math.max(...Object.values(data.dropOffPoints), 1);

    steps.forEach((step, idx) => {
      const val = data.dropOffPoints[step] || 0;
      const pct = Math.round((val / maxVal) * 100);
      document.getElementById(`bar-step${idx}`).style.width = `${pct}%`;
      document.getElementById(`val-step${idx}`).textContent = `${val} drops`;
    });
  } catch (err) {
    console.error("Failed to load metrics:", err);
  }
}
