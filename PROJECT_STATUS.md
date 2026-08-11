# NEET Prep (Jules) — Project Status

*This file is automatically maintained per Rule 1 of AGENTS.md. It reflects the single source of truth for the project state based on real repo files and database state.*
*Git Remote:* `https://github.com/deepakprajapati8938-del/Jules.git` (main branch synced)

---

## 1. Current Phase Status

- **Phase 1 (Single-Chapter RAG Pipeline):** ✅ **Complete & Validated**
  - Core pipeline: PDF text extraction, markdown conversion, heading-based chunking, Gemini embedding (`gemini-embedding-2`), Supabase pgvector storage.

- **Phase 2 (Full Syllabus Scale-up + Syllabus Config + PYQ Bank):** ✅ **COMPLETE**
  - Stage 1 text ingestion: 3,109 NCERT chunks across 48 chapters (Biology + Chemistry + Physics)
  - PYQ ingestion: 379 PYQ chunks
  - Syllabus config: 48 chapters seeded, 5 chapters marked excluded
  - Total in `neet_chunks`: **3,488 rows**

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
- **`neet_chunks` table:** 3,488 rows total
  - NCERT chunks: 3,109
  - PYQ chunks: 379
- **`syllabus_config` table:** 48 rows (5 marked included=false)
  - Excluded: Transport In Plants, Mineral Nutrition, Digestion And Absorption, Reproduction In Organisms, Strategies For Enhancement
  - Note: Physics and Chemistry chapters correctly named and ingested.
- **RPC `match_neet_chunks`:** Cosine similarity search, filters `syllabus_excluded=true`.

---

## 4. Known Issues / Follow-up

1. ~~**Generic chapter names (Chemistry & Physics):** Many Chemistry/Physics PDFs were renamed to `ChapterX` format due to API rate limits during the rename phase. These are stored in `neet_chunks` with metadata `chapter: "Chapter3"` etc. — not human-readable. Does not affect retrieval accuracy but does affect `syllabus_config` display. **Consequence: chapter-wise tests for Physics/Chemistry will find 0 questions** since the frontend sends human-readable names that don't match stored `ChapterX` values.~~ (✅ FIXED: Renamed and re-ingested on 2026-07-27)
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
- [x] **Phase 6 & 7 (Chat Enhancements, History & Facts):**
  - Added Save/Bookmark functionality in UI.
  - Implemented persistent date separators in chat view.
  - Created `chat_sessions` table and unified both NCERT and Personal chats under session history.
  - Upgraded `llm_wrapper.py` and model dropdown to exclusively use `gemini-flash-latest` (1.5 models deprecated).
  - Fixed Groq Model mapping out-of-sync lists.
  - Added multimodal attachment support (Image/PDF) to both NCERT and Personal chats using `gemini-flash-latest`.
  - Added "NCERT Byte" daily facts and Smart Loading screen facts.
  - Extracted 5,478 facts to `ncert_facts` table via background scripts (100% complete across all NCERT chapters and PYQs).
  - Wired `Flashcards.tsx` to read facts from backend.
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
- [x] **Phase 11 (PDF to Mock Test & NTA UI):** CBT Interface and PDF ingestion
  - Added `POST /generate-from-pdf` endpoint in `backend/routers/tests.py`.
  - Configured `src.llm_wrapper.call_llm` to process Base64 PDFs via Gemini Vision.
  - Updated `Tests.tsx` with NTA layout (Clear Response, Mark for Review buttons).
  - Added full NTA CBT palette color-coding (Gray, Red, Green, Purple, Purple/Green dot).
  - Added multi-threaded 4-page PDF chunking to support full 200-question mock tests without timeouts.
  - Added Two-Pass Architecture for optional separate Answer Key PDF uploads.
  - Added dynamic loading screen with simulated progress bar to keep students engaged during 40s wait times.
- [x] **Phase 12 (Onboarding & User Guide):** Jules Handbook
  - Added `Handbook.tsx` with a premium Dark Glassmorphism Bento grid layout.
  - Implemented interactive modal cards for core features (NCERT Chat, CBT Tests, Concept Map, Journal).
  - Added `/guide` route and wired it to the AppShell sidebar.
- [x] **Phase 13 (Offline Resilience & Premium UX):** Native-like PWA capabilities
  - Implemented `jules_offline_queue` in `api-client.ts` to silently save test submissions and daily logs during network drops.
  - Wired `AppShell.tsx` to automatically flush the offline queue upon reconnecting to the internet.
  - Added background pre-caching for Syllabus Tracker and Daily Log on startup to ensure instant offline availability.
  - Added Haptic Feedback (`navigator.vibrate`) for tests, flashcards, and chat sends for a premium tactile feel.
  - Added PWA Manifest Home Screen Shortcuts (NCERT Chat, Mock Test, Daily Log).
  - Prevented accidental "Pull-to-Refresh" data loss via CSS `overscroll-behavior-y`.
- [ ] Diagram captioning (DEFERRED) — requires paid Vision API tier. Images extracted but no captions. Will add later. Free tier quotas make batch processing impractical.
- [x] **Vercel Deployment Fixes (2026-07-27):** Fixed 3 bugs that caused failures after Vercel/production deploy:
  - `backend/routers/tests.py`: Fixed JSONB filter operators `->` → `->>` for chapter, subject, and source_type metadata fields. The `->` operator returns raw JSON (quoted), while `->>` returns plain text — Supabase `eq` filter only matches text, so chapter-wise and subject-wise tests returned 0 questions on production.
  - `src/config.py`: Wrapped `OUTPUT_DIR.mkdir()` in `try/except (OSError, PermissionError)` to prevent import-time crash on Vercel's read-only serverless filesystem. This was silently crashing every backend endpoint.
  - `src/llm_wrapper.py`: Removed dead stub `call_llm` definition (had docstring only, no body). Only the real implementation at module level remains.
  - **Data Layer (Physics/Chemistry)**: Fixed the generic `ChapterX` naming issue by standardizing PDF names and re-ingesting them correctly, then re-seeding the syllabus. Chapter-wise tests for Physics and Chemistry now work as expected.
- [x] **Phase 14 (Resilience & Chat UI Polish):** Added on 2026-07-28
  - `src/retriever.py`: Fixed Vercel 504 serverless timeout error caused by `time.sleep()` blocking during rate limit hits when embedding images. Replaced with robust multi-key rotation `embed_with_retry` from `src/embedder.py`.
  - `NcertChat.tsx` & `PersonalChat.tsx`: Added `onPaste` event handler to natively support clipboard image pasting (Ctrl+V) directly into the chat prompt.
  - Added Model Switcher UI to NCERT Chat. Removed "Groq Ultra-Fast" models, renamed "GPT-OSS 120B" to "ChatGPT", and set `gemini-flash-latest` as the unified default for speed and multimodal safety.
  - `SyllabusTracker.tsx`: Fixed a UI bug where manually completing all topics in a chapter wouldn't update the subject-level progress bar properly.
  - `backend/routers/syllabus_tracker.py`: Added `CHAPTER_ALIASES` mapping to fix "Topics pending extraction" for Chemistry/Physics chapters whose Yakeen planner names didn't exactly match the NCERT PDF names in the database.
- [x] **Phase 15 (Syllabus Tracker Full Fix) — 2026-07-31:**
  - `SyllabusTracker.tsx`: Fixed subject-level progress bar not updating when individual topics were ticked (was only counting `chapter.is_completed`, not topic-level completions).
  - `SyllabusTracker.tsx`: Full per-subject color theming — Botany=emerald, Zoology=blue, Physics=rose, Chemistry=amber — applied to avatar, ring, progress bar, and expanded header background.
  - `backend/routers/syllabus_tracker.py`: Fixed critical bug — `topic.startswith(ch)` filter was silently dropping ALL topics whose names began with the chapter name (e.g. "Redox Reactions in Terms of Electron Transfer" was filtered because it starts with "Redox Reactions"). Fixed to exact equality check only.
  - `backend/routers/syllabus_tracker.py`: Added comprehensive `CHAPTER_ALIASES` covering all Botany, Zoology, Physics, and Chemistry planner↔NCERT name mismatches.
- [x] **Phase 17 (Backdated Daily Logging & High-End NEET 2027 Study Vault) — 2026-08-04:**
  - `backend/routers/daily_log.py`: Updated `StudySessionCreate` schema to support optional `session_date` (YYYY-MM-DD) for logging missed past days. Updated `get_session_history` to support a high history limit (`limit=500`) and subject filtering.
  - `frontend/src/core/api-client.ts`: Updated `logSession` and `getHistory` methods to pass `session_date`, limit, and subject filters.
  - `frontend/src/features/daily-log/DailyLog.tsx`: Redesigned Daily Log into a high-end Dark Glassmorphism Studio view:
    - **Date Selector**: Quick preset pills (`Today`, `Yesterday`, `Custom Date`) so Prachi can log missed past study sessions anytime.
    - **Quick Duration Chips**: `30m`, `45m`, `1h`, `1.5h`, `2h`, `3h` for 1-tap fast logging.
    - **Bento Overview Banner**: Displays total hours logged, total sessions count, and live subject distribution bars (Physics ⚡, Chemistry 🧪, Biology 🧬).
    - **Fast Search & Jump Navigation (300+ Days Ready)**:
      - **Month Accordions**: Grouped by Month (`August 2026 — 45 hrs`, `July 2026 — 62 hrs`) with collapsible sections.
      - **Month Quick-Jump Dropdown**: Jump directly to any month in 1 click.
      - **Jump-to-Date Picker**: Select any specific date (e.g. `15 Oct 2026`) to view exact sessions for that day instantly.
      - **Text Search & Subject Filters**: Instant search across chapter names, topics, and notes.
    - **Student Frictionless UX Redesign**: Replaced disruptive full-screen submit state with an inline toast notification (`Saved! Subject - Chapter (time)`), haptic feedback (`navigator.vibrate`), 1-tap visual Subject selection cards (Biology 🧬, Physics ⚡, Chemistry 🧪), quick duration chips, and seamless multi-session logging.
    - **All-Days Study Trend Graph & Interactive Analytics**: Added an interactive trend graph component powered by Recharts with flexible timeframes (`7 Days`, `30 Days`, `90 Days`, `All Time` for full NEET 2027 journey). Includes peak study day tracking, active day counts, daily study average metrics, and hover tooltips. Chart metrics container polished with native `glass` panels and unified warm amber palette tokens.
- [x] **Phase 18 (Visual Overhaul — Graphs, Charts & Diagrams) — 2026-08-11:**
  - **ConceptMap.tsx**: Full reskin with subject-aware vibrant palettes (Biology=Emerald/Cyan, Chemistry=Amber/Gold, Physics=Violet/Rose). Replaced monotone brown nodeColors with `SUBJECT_PALETTES` map. Added live search bar with node spotlight/dimming, subject filter pills (All/Bio/Chem/Phy), canvas legend, multi-ring glowing halos for confident & weak nodes, outer ring decorations. Node click now opens TopicInspector drawer.
  - **TopicInspector.tsx** [NEW]: Glassmorphism slide-over drawer showing topic details — chapter, subject badge, confidence status, key NCERT facts from `ncert_facts` table, connected topics list from `concept_edges`, and "Ask Jules" CTA button to jump to NCERT Chat.
  - **concept_map.py** (backend): Added `GET /api/v1/concept-map/topic-detail` endpoint returning topic metadata, key facts, connected topics, and confidence status.
  - **Dashboard.tsx**: AreaChart gradient changed from single amber to violet→cyan dual-tone. PieChart confidence palette upgraded to vibrant distinct colors (Emerald/Violet/Amber/Cyan/Slate). Progress ring SVG gradient updated to violet→cyan.
  - **DailyLog.tsx**: Trend AreaChart gradient changed from amber to violet→cyan. Tooltip accent color updated.
  - **InteractiveWidget.tsx**: Added premium "Interactive Visual" header bar with violet accent, animated gradient border during loading, shimmer loading skeleton, dark-mode iframe background (#08090c).
  - **DiagramWithHotspots.tsx**: Hotspot markers upgraded to 28px numbered circles with animated double-ripple rings. Detail panel redesigned with gradient-to-transparent overlay, numbered badge, and glassmorphism card with close button.
  - **ArtifactRenderer.tsx**: Iframe background changed from white to dark (#08090c). Added hover glow border effect (violet). Content area height increased to 550px.


