# 🌌 Jules — AI-Powered NEET UG 2027 Study Companion

![Jules Banner](https://via.placeholder.com/1200x300/08090c/9333ea?text=Jules+-+NEET+Prep+PWA)

**Jules** is a hyper-personalized, single-user Progressive Web App (PWA) designed exclusively for a NEET UG 2027 aspirant. Far beyond a simple Q&A bot, Jules acts as a holistic study companion, bringing together RAG-powered NCERT grounding, intelligent CBT (Computer-Based Test) simulation, concept mapping, and an emotionally intelligent personal companion—all wrapped in a premium, distraction-free "Dark Glassmorphism" aesthetic.

---

## 🧭 The Jules Philosophy

Jules is built on a strict, student-first psychological framework to prevent burnout and foster long-term consistency:
- **No comparisons or rankings.**
- **No urgency or anxiety tactics** (no countdowns, no pressure framing).
- **Positive Recovery System:** Broken streaks are met with encouragement, not guilt or shaming.
- **Student Control:** Jules suggests, but the student always decides.

---

## ✨ Key Features

### 📚 1. Dual-AI Chat Engine (Grounded RAG)
- **NCERT Chat:** Strictly grounded in NCERT syllabus (Physics, Chemistry, Biology). Answers are generated using semantic search across 3,488+ vectorized NCERT and PYQ chunks to eliminate hallucinations.
- **Personal Chat:** An empathetic, ungrounded companion mode for motivation, strategy, and stress relief.
- **Multimodal Support:** Paste images or PDFs directly into the chat for instant OCR and analysis (powered by Gemini Vision).

### 📝 2. NTA-Style CBT Engine & Mock Tests
- **PDF to Test Generation:** Upload a PDF test paper, and Jules automatically chunks and converts it into a digital mock test using AI.
- **NTA CBT Interface:** Exact replica of the official NTA Exam interface (Color-coded palette: Unanswered, Answered, Marked for Review, etc.).
- **Two-Pass Architecture:** Separate processing for Question PDFs and Answer Key PDFs to ensure 100% accuracy.

### 🧠 3. Concept Maps & Visual Learning
- **Dynamic Topic Graphs:** Visualize how chapters and topics connect via interactive 2D Force Graphs.
- **Confidence Tracking:** Nodes glow based on the student's confidence level, highlighting weak spots instantly.
- **Diagram Hotspots:** AI-generated interactive labels on complex NCERT diagrams for active recall.

### 📈 4. Syllabus Tracking & Daily Logs
- **Syllabus Tracker:** Track progress at the subject, chapter, and topic levels with granular progress bars.
- **Backdated Logging:** Seamlessly log missed study sessions with custom dates, durations, and subject tags.
- **Analytics:** View 7-day, 30-day, and all-time study trends through interactive area charts.

### ⚡ 5. Premium PWA Experience
- **Dark Glassmorphism Theme:** Near-black background (`#08090c`) with ambient warm amber and cool violet radial glows.
- **Haptic Feedback & Micro-interactions:** Tactile feedback on mobile devices for a premium feel.
- **Offline Resilience:** Submissions and logs are safely queued offline and flushed automatically upon reconnection.
- **Installable:** Native app feel with standalone display, home screen shortcuts, and custom splash screens.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS (Custom Glassmorphism plugin/tokens)
- **State/Routing:** React Router DOM
- **PWA:** `vite-plugin-pwa` (Workbox)
- **Visuals:** Recharts, React Force Graph, KaTeX (for Math equations)

### Backend & Core Data Pipeline
- **API Server:** FastAPI (Python 3.10+)
- **LLM Engine:** Google Gemini (Flash & Pro models) with multi-key rotation and robust fallback chains.
- **PDF Extraction:** PyMuPDF, Tesseract OCR
- **Vector Database:** Supabase (PostgreSQL with `pgvector`)

---

## 🚀 Getting Started

To run Jules locally, you need to spin up both the FastAPI backend and the Vite frontend.

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Supabase Project (Local or Cloud)
- Gemini API Key

### 1. Database Setup
Ensure your Supabase project is active. You must run the SQL schema files located in the `/sql` directory sequentially to set up `pgvector`, the RAG tables (`neet_chunks`), and user-tracking tables (`study_sessions`, `chat_sessions`, etc.).

### 2. Backend Setup
The backend handles LLM interactions, database logic, and RAG retrieval.

```bash
# Navigate to backend/core root
cd Jules

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file based on .env.example
# Add SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY
```

Start the FastAPI server:
```bash
python -m uvicorn backend.main:app --reload
```
*API available at: `http://localhost:8000` (Swagger UI at `/docs`)*

### 3. Frontend Setup
The frontend is a PWA that connects to the FastAPI backend.

```bash
# Navigate to frontend
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```
*Frontend available at: `http://localhost:5173`*

---

## 📂 Project Structure

```text
Jules/
├── backend/                  # FastAPI Application
│   ├── routers/              # API endpoints (chat, tests, concept_map, etc.)
│   └── main.py               # FastAPI entry point
├── frontend/                 # React PWA
│   ├── public/               # PWA icons, manifest assets
│   ├── src/
│   │   ├── components/       # Reusable UI (Buttons, AppShell, Widgets)
│   │   ├── features/         # Feature modules (Chat, Dashboard, Tests, etc.)
│   │   └── core/             # API client, hooks, utilities
│   └── vite.config.ts        # Vite & PWA configuration
├── scripts/                  # Data ingestion & AI batch processing scripts
│   ├── ingest_batch_ncert.py # PDF to Supabase ingestion
│   └── caption_diagrams.py   # AI diagram extraction
├── sql/                      # Supabase schema definitions (Phases 1-10+)
├── src/                      # Shared core python utilities
│   ├── embedder.py           # Gemini embedding logic
│   ├── llm_wrapper.py        # Centralized LLM call wrapper with fallbacks
│   └── retriever.py          # Vector search logic
├── AGENTS.md                 # Strict architectural rules & project philosophy
└── PROJECT_STATUS.md         # Single source of truth for phase tracking
```

---

## 📜 Development Guidelines & Architecture Rules

For anyone contributing or maintaining this project, **reading `AGENTS.md` is mandatory.**
1. **Rule of Status:** Always read and update `PROJECT_STATUS.md` before and after any task.
2. **Modular Features:** Every feature lives in its own isolated file/folder. Do not entangle feature logic with core RAG layers (`retriever.py`, `embedder.py`).
3. **Additive Schema Changes:** Only add new tables/columns. Do not restructure existing database schemas that earlier phases depend on.

---

*Designed for Focus. Engineered for NEET. Powered by AI.*
