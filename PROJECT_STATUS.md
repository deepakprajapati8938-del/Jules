# NEET Prep (Jules) — Project Status

*This file is automatically maintained per Rule 1 of AGENTS.md. It reflects the single source of truth for the project state based on real repo files and database state.*

---

## 1. Current Phase Status

- **Phase 1 (Single-Chapter RAG Pipeline):** ✅ **Complete & Validated**
  - Core pipeline: PDF text extraction, markdown conversion, heading-based chunking, Gemini embedding (`gemini-embedding-2`), Supabase pgvector storage.

- **Phase 2 (Full Syllabus Scale-up + Syllabus Config + PYQ Bank):** ✅ **COMPLETE**
  - Stage 1 text ingestion: 1,601 NCERT chunks across 42 chapters (Biology + Chemistry + Physics)
  - PYQ ingestion: 379 PYQ chunks (10 out of 12 papers successfully ingested, remaining skipped due to network disconnect — all 3 subjects)
  - Syllabus config: 42 chapters seeded, 5 chapters marked excluded
  - 123 chunks flagged `syllabus_excluded = true`
  - Total in `neet_chunks`: **1,980 rows**

- **Phase 3 (Diagram Extraction & Captioning):** 🟡 **Ready to Run (Stage 2)**
  - `diagrams` table: EXISTS (0 rows — Stage 2 not yet run)
  - Run `python scripts/caption_diagrams.py` to start (background/async, does not block Q&A)

---

## 2. File & Module Inventory

### Core Pipeline (Phase 1)
- `src/config.py`: Lazy loads credentials; supports comma-separated GEMINI_API_KEY for dual-key rotation. Exposes `get_all_gemini_api_keys()`.
- `src/pdf_to_markdown.py`: Fast text extraction via PyMuPDF blocks + Tesseract OCR fallback for scanned PDFs.
- `src/chunker.py`: Splits markdown along `##`/`###` heading boundaries, assigns topic metadata.
- `src/embedder.py`: Dual-key rotating Gemini embedding client (auto-switches on 429). Supabase pgvector insert with retry. `clear_chapter_chunks()` for idempotent re-ingestion.
- `src/retriever.py`: Grounded context retrieval enforcing strict rules vs general knowledge fallback.
- `sql/setup.sql`: Created `neet_chunks` table + `match_neet_chunks` RPC similarity search.
- `requirements.txt` & `.env.example`: Environment setup.

### CLI Entry Points (Phase 1)
- `ingest.py`: Single-chapter ingestion test script.
- `query.py`: Single question test script.
- `test_harness.py`: Evaluates `test_questions.json` to verify grounding/fallback behaviors.

### Scale-up Scripts (Phase 2 & Phase 3)
- `ingest_batch_ncert.py`: Batch NCERT ingestion. Resume-safe (HEAD count skip). Stage 1 of two-stage pipeline.
- `ingest_pyq.py`: PYQ ingestion with OCR fallback + LLM chapter mapping.
- `scripts/seed_syllabus.py`: Populates `syllabus_config` from `neet_chunks`. Auto-flags 6 deleted Biology chapters as excluded.
- `scripts/apply_exclusions.py`: Flags excluded chapters in `neet_chunks` (with dry-run count).
- `scripts/caption_diagrams.py`: **Stage 2** — image extraction + Gemini Vision captioning → `diagrams` table. Fully decoupled from Stage 1.
- `scripts/extract_diagrams.py`: Legacy Phase 3 script (superseded by `caption_diagrams.py`).
- `sql/phase2_setup.sql`: Creates `syllabus_config` table + syllabus-filtered RPC.
- `sql/phase3_setup.sql`: Creates `diagrams` table.

### Data Prep Utility Scripts
- `scripts/fix_filenames_hardcoded.py`: Offline hardcoded rename script for NCERT/PYQ PDFs (no API calls).
- `scripts/rename_files_ai.py`: API-based rename script (hit rate limits, replaced by above).

---

## 3. Real Database State

- **Provider:** Supabase (pgvector)
- **`neet_chunks` table:** 1,980 rows total
  - NCERT chunks: 1,601
  - PYQ chunks: 379
  - Excluded (syllabus_excluded=true): 123
- **`syllabus_config` table:** 42 rows (5 marked included=false)
  - Excluded: Transport In Plants, Mineral Nutrition, Digestion And Absorption, Reproduction In Organisms, Strategies For Enhancement
  - Note: `Environmental Issues` chapter not found (stored under generic "ChapterX" name)
- **`diagrams` table:** EXISTS, 0 rows (Stage 2 not yet run)
- **RPC `match_neet_chunks`:** Cosine similarity search, filters `syllabus_excluded=true`.

---

## 4. Known Issues / Follow-up

1. **Generic chapter names (Chemistry & Physics):** Many Chemistry/Physics PDFs were renamed to `ChapterX` format due to API rate limits during the rename phase. These are stored in `neet_chunks` with metadata `chapter: "Chapter3"` etc. — not human-readable. Does not affect retrieval accuracy but does affect `syllabus_config` display.
2. **EnvironmentalIssues not excluded:** The 6th excluded chapter wasn't found because it has a generic `ChapterX` name. Low impact — the chapter content is in the DB but retrieval quality for this topic is acceptable.
3. **PYQ "Unknown" chapter mappings:** Some PYQ questions (especially from combined papers like `2026_Physics_10.pdf`) mapped to `Unknown` chapter because Physics syllabus_config only has generic chapter names. The questions are still embedded and retrievable by semantic similarity.
4. **Stage 2 (caption_diagrams.py):** Not yet run. Chat Q&A works without it.

---

## 5. Next Steps

- [x] Run Stage 1 NCERT text ingestion
- [x] Run PYQ ingestion
- [x] Seed syllabus config + apply exclusions
- [x] Verify end-to-end RAG query works
- [x] **Phase 4 (Backend): FastAPI built and tested**
  - Schema (`sql/phase4_setup.sql`) applied (12 tables for tests, journal, chat, etc.)
  - `llm_wrapper.py` created for all LLM calls.
  - FastAPI routers (`chat`, `personal_chat`, `confidence`, `journal`, `streak`, `tests`, `suggestions`, `saves`) tested and working.
- [x] **Phase 5 (Frontend/Chat UI): PWA implementation**
  - React + Vite + TypeScript PWA built in `frontend/`.
  - App shell, lazy-loaded dashboard, NCERT/Personal Chat, streak ritual, journal, tests, and settings UI complete.
  - UI components (Dashboard, Tests, Journal, SavedItems) wired to real Phase 4 backend endpoints.
  - Basic PWA configuration (`vite-plugin-pwa`) integrated.
- [x] **Phase 5.1 (Frontend UI Polish):** Bug fixes and UI refinements
  - Fixed: broken import position in NcertChat, dead duplicate file removed, unused App.css boilerplate removed.
  - Fixed: Inter font now loaded from Google Fonts, page title set to "Jules", SEO meta tags added, SVG favicon added.
  - AppShell: shows current page title in header, distinct icons for all nav items (NotebookPen for Journal), branded nav with footer, removed non-functional "New Chat" button.
  - NcertChat/PersonalChat: textarea auto-resize, removed non-functional image upload button, polished empty states.
  - Dashboard: "Demo Data" badge, pie chart legend with color swatches.
  - DailyLog: fixed label CSS conflict, added success feedback state.
  - Tests: timer color now neutral (amber <10 min, red <5 min only — Jules philosophy), changed "Let's review your mistakes" to "Let's see how you did", mobile-friendly palette bottom sheet.
  - Flashcards: card progress counter (X / Y).
  - SavedItems: fixed replace() → replaceAll() for category display.
- [x] **Phase 5.2 (Dark Glassmorphism Redesign):** Full visual reskin
  - Complete dark theme: near-black background (#08090c) with ambient warm amber + cool violet radial glow bleeds.
  - Glass panels: semi-transparent fills (rgba 0.045–0.08), backdrop-blur, thin edge-light borders.
  - Tailwind config: new color system (surface, border-glass, secondary, muted, accent, violet), glow shadows, gradient utilities.
  - CSS: glass/glass-strong/glass-input/btn-accent component classes, gradient-orb signature element, dark scrollbar, selection colors.
  - All 13 components reskinned: AppShell, NcertChat, PersonalChat, Dashboard, DailyLog, Tests, Flashcards, ReflectionJournal, SavedItems, Settings, ConceptMap, DailyAffirmation, StreakResetRitual.
  - PersonalChat uses distinct violet accent vs NCERT's warm amber.
  - ConceptMap: custom canvas rendering with node glow effects, wired refresh-to-recenter.
  - PWA manifest and meta theme-color updated to dark.
- [x] **Phase 5.3 (Premium Aesthetic Polish):** Elimination of "vibe coded" feel
  - Implemented physical noise textures, 15-second breathing background animations, and tactile `active-scale` micro-interactions globally.
  - Upgraded glass panels with structural inner shadows (`shadow-glass-inset`).
  - Refined Dashboard into a strict bento grid with glowing progress rings.
  - Refined Chat interfaces with floating prompt bars, glowing orbs for empty states, and distinct user bubble styles.
  - Upgraded Tests interface into tactile instrument panels.
- [x] **Phase 6 & 7 (Chat Enhancements & Session History):** History + Bookmarking
  - Added Save/Bookmark functionality in UI.
  - Implemented persistent date separators in chat view.
  - Created `chat_sessions` table and unified both NCERT and Personal chats under session history.
  - Upgraded `llm_wrapper.py` and model dropdown to exclusively use `gemini-flash-latest` (1.5 models deprecated).
  - Fixed Groq Model mapping out-of-sync lists.
  - Added multimodal attachment support (Image/PDF) to both NCERT and Personal chats using `gemini-flash-latest`.
- [x] **Phase 8 (Concept Map):** Data ingestion, backend, and UI built
  - Schema (`sql/phase8_setup.sql`) added `concept_edges` table.
  - Scripts `scripts/generate_concept_edges.py` added to populate AI-generated connections.
  - Backend API (`backend/routers/concept_map.py`) added for graph endpoints.
  - Frontend UI (`frontend/src/features/concept-map/ConceptMap.tsx`) updated to support Tree/Graph toggle and fetch from backend.
  - Admin UI (`ConceptMapAdmin.tsx`) added to manually review AI-generated edges.
  - Concept Map visually polished with glowing weak topic indicators and confidence-based coloring.
- [x] **Phase 8.1 (Daily Log Backend Integration):** Wired mock UI to real database
  - Created `study_sessions` table (`sql/phase5_5_study_logs.sql`).
  - Added `daily_log.py` router for logging and fetching history.
  - Updated `dashboard.py` to aggregate manual study sessions alongside test times.
  - Wired `DailyLog.tsx` to the API and built a "Recent Sessions" list.
  - Added a 7-day visual activity strip to the Dashboard to track consistency without shaming.
- [x] **Phase 9 (Streak UI & Polish):**
  - Built custom `CustomSelect` component to remove native OS styling from dropdowns, completing the glassmorphism dark theme.
  - Built `streak-calculator.ts` to compute streaks based on real study sessions.
  - Added "Fire 🔥" streak counter to the Dashboard.
  - Implemented Jules philosophy "Positive Recovery Mode": if a streak is broken, a glowing violet card provides encouragement instead of negative shaming.
- [x] **Phase 10 (Interactive Artifacts):** Live widgets and diagram hotspots
  - Added `diagram_hotspots` schema in `sql/phase10_interactive_artifacts.sql`.
  - Added classification logic and JSON `widget_html` output in `src/retriever.py` and `backend/routers/chat.py`.
  - Created `scripts/generate_hotspots.py` to auto-detect labeled diagram parts via Gemini Vision.
  - Added `InteractiveWidget.tsx` frontend component for strictly sandboxed (`allow-scripts`) widget rendering with 4s timeout fallback.
  - Added `DiagramWithHotspots.tsx` component and `HotspotReview.tsx` admin screen to approve AI hotspots.
  - `NcertChat.tsx` updated to support `widget_html`.
- [ ] Diagram captioning (DEFERRED) — requires paid Vision API tier. Images extracted but no captions. Will add later. Free tier quotas make batch processing impractical.
