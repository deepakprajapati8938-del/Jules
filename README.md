# Jules - NEET Prep PWA

Jules is a single-user study tool and progressive web app (PWA) designed for a NEET UG 2027 aspirant. It features an NCERT-grounded RAG chatbot, a personal AI companion, test generation, a reflection journal, and spaced repetition flashcards.

## Getting Started

To run the application locally, you will need to start both the Python backend and the React frontend.

### Prerequisites
- Node.js (v18 or higher)
- Python 3.10+
- Supabase Project (with `phase4_setup.sql` and earlier schemas applied)

### 1. Start the Backend

The backend is built with FastAPI. It requires `SUPABASE_URL` and `SUPABASE_KEY` (and `GEMINI_API_KEY` for LLM calls).

Open a terminal window and run:

```bash
cd backend
# Create and activate a virtual environment (recommended)
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server on http://localhost:8000
python -m uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`. You can view the swagger documentation at `http://localhost:8000/docs`.

### 2. Start the Frontend

The frontend is a Progressive Web App (PWA) built with React, Vite, and Tailwind CSS v3.

Open a **new** terminal window and run:

```bash
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend will be available at `http://localhost:5173/`. 

> **Note:** The frontend expects the backend to be running at `http://localhost:8000`. This is configured in `frontend/src/core/api-client.ts`.

## Architecture Overview
- **Frontend (`/frontend`)**: React + Vite + TypeScript. Uses Tailwind CSS for styling and Recharts/Force Graph for data visualization.
- **Backend (`/backend`)**: FastAPI server containing routing for NCERT Chat, Personal Chat, Journaling, Tests, and Suggestions.
- **Database (`Supabase`)**: PostgreSQL with `pgvector` for embedding storage and similarity search (retrieval augmented generation).
