# Welfare Mitra (कल्याण मित्र / நலன் மித்ரா)

An AI-powered, low-bandwidth multilingual chatbot designed for rural India to close the welfare scheme awareness gap. This application provides a deterministic rule-based eligibility evaluation, localized document checklists, and a RAG (Retrieval-Augmented Generation) pipeline backed by Gemini to answer detailed inquiries without hallucinating.

---

## Key Features

1. **Deterministic Eligibility Engine**: Computes eligibility for **10 major welfare schemes** using strict logic filters (LLM-free) to prevent hallucinated entitlements.
2. **Conversation State Machine**: A 6-step questionnaire tracking state per user session (handles occupation, land size, income, BPL status, gender, and family makeup).
3. **Multilingual translation fallback**: Automated Hindi and Tamil script detection with support for Hinglish and Tamil-English code-mixing. Transparent Bhashini government API integration with a Gemini translation fallback.
4. **Resilient Offline / Demo Mode**: If no Gemini API key is provided, the backend operates in a full simulation mode, displaying mock messages, transcripts, and telemetry so judges can test the user flows immediately.
5. **Polished Sandbox UI**: A responsive browser dashboard with:
   - A physical smartphone chassis mockup running the simulated WhatsApp chatbot.
   - 1-click persona quick-loaders (Ramesh, Meena, Suresh).
   - Real-time developer console logging the RAG pipeline steps.
   - Interactive live session state explorer.
   - Telemetry analytics tracking latency, completion rate, and drop-off points.

---

## Project Structure

```text
nssProject/
├── data/
│   └── schemes/                # Ground-truth JSON database (10 schemes)
│       ├── PM_KISAN.json
│       ├── AYUSHMAN_BHARAT.json
│       └── ...
├── public/                     # High-fidelity Web Simulation UI
│   ├── index.html
│   ├── index.css
│   └── app.js
├── src/                        # Backend Node.js Express Application
│   ├── server.js               # Express server routing & telemetry APIs
│   ├── eligibilityEngine.js    # Rule-based eligibility filters
│   ├── sessionManager.js       # Conversation flow state manager
│   ├── translationService.js   # Script detection, Bhashini & Gemini fallbacks
│   └── ragPipeline.js          # Retrieval-Augmented Generation with Gemini
├── .env.example
├── .env                        # Local configuration
├── package.json
└── README.md
```

---

## Installation & Running

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Steps

1. **Clone/Navigate to the workspace**:
   ```bash
   cd c:\Users\parav\Downloads\nssProject
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   - Open the `.env` file in the root.
   - Add your Gemini API key to enable live RAG-based conversations:
     ```env
     GEMINI_API_KEY=your_actual_gemini_api_key_here
     ```
   - *Note: If left blank, the app will run in offline demo mode using visual mocks, allowing you to walk through the entire flow without API keys.*

4. **Start the Application**:
   ```bash
   # Run the server
   npm start
   
   # Or run with auto-reload (development mode)
   npm run dev
   ```

5. **Open in Browser**:
   - Navigate to **[http://localhost:3000](http://localhost:3000)**.

---

## Testing Personas

The dashboard provides a **Persona Panel** specifically designed for hackathon judges to verify the bot under different demographics in one click:

| Persona Name | Background | Expected Eligible Schemes |
| :--- | :--- | :--- |
| **Ramesh Kumar** | Farmer, owns 3 acres, holds BPL card (Haryana) | PM-KISAN, Ayushman Bharat, PMAY-Gramin, MGNREGA, PM Fasal Bima |
| **Meena Selvi** | Daily wage earner, has a girl child under 10 (Tamil Nadu) | Ayushman Bharat, PMAY-Gramin, PM Ujjwala, MGNREGA, Sukanya Samriddhi, Janani Suraksha |
| **Suresh Gupta** | Street vendor, no land, no BPL card (Delhi) | PM SVANidhi, Ayushman Bharat, MGNREGA |

---

## Honesty & RAG Guidelines

- **Eligibility Control**: The chatbot will **never** declare a user eligible for a scheme unless computed by the rules.
- **RAG Constraints**: Gemini is instructed to reply strictly within the retrieved scheme context. If an answer cannot be determined, it outputs a default helpline fallback: `1800-11-6446`.
- **Word Limit**: Responses are capped at `150 words` for mobile readability under low-bandwidth networks.
