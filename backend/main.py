"""
backend/main.py — FastAPI application entry point for Jules NEET Prep backend.

Run with:
    uvicorn backend.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import (
    chat, personal_chat, confidence, journal, streak, tests, suggestions, saves, dashboard, home, concept_map, daily_log, diagrams, facts, cheatsheet, syllabus_tracker, models
)

app = FastAPI(
    title="Jules — NEET Prep API",
    description="Backend API for Jules, a personal NEET UG 2027 study companion.",
    version="1.0.0",
)

# CORS — allow all origins for local development; tighten in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(chat.router,          prefix=API_PREFIX)
app.include_router(personal_chat.router, prefix=API_PREFIX)
app.include_router(confidence.router,    prefix=API_PREFIX)
app.include_router(journal.router,       prefix=API_PREFIX)
app.include_router(streak.router,        prefix=API_PREFIX)
app.include_router(tests.router,         prefix=API_PREFIX)
app.include_router(suggestions.router,   prefix=API_PREFIX)
app.include_router(saves.router,         prefix=API_PREFIX)
app.include_router(dashboard.router,     prefix=API_PREFIX)
app.include_router(home.router,          prefix=API_PREFIX)
app.include_router(concept_map.router,   prefix=API_PREFIX)
app.include_router(daily_log.router,     prefix=API_PREFIX)
app.include_router(diagrams.router,      prefix=API_PREFIX)
app.include_router(facts.router,         prefix=API_PREFIX)
app.include_router(cheatsheet.router,    prefix=API_PREFIX)
app.include_router(syllabus_tracker.router, prefix=API_PREFIX)
app.include_router(models.router,           prefix=API_PREFIX)

@app.get("/")
def root():
    return {"status": "ok", "service": "Jules NEET API", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}
