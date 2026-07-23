# Backend Resume Guide & Status (Paused due to API Quota)

**Date Paused:** July 21, 2026
**Reason for Pause:** Gemini API Free Tier Limit Exhausted (1000 embeddings/day/key limit hit on both keys).
**Next Available Window:** Quota resets tomorrow (July 22) around 12:30 PM IST.

---

## 1. What is 100% DONE
- **NCERT Text Ingestion:** 42 chapters (Biology, Chemistry, Physics) extracted, chunked, and embedded.
- **PYQ Ingestion:** 12 question papers (2023, 2025, 2026) OCR'd, chunked per question, mapped to chapters, and embedded.
- **Syllabus Exclusions:** 5 Biology chapters automatically flagged as `syllabus_excluded=true`.
- **Database Total:** 1,858 chunks safely stored in Supabase `neet_chunks`.
- **Code Fixes:** Both API keys are now active in a round-robin rotation (`src.embedder`) to double future throughput.

---

## 2. What is PENDING (Start here tomorrow)

When you return tomorrow after the API limit resets, run these exact steps in order:

### Step 1: Test the RAG Retrieval
Verify that the text chunks and embeddings are returning correct answers.
```bash
python query.py "What is the role of mRNA in protein synthesis?"
```
*(If this works without a 429 Error, your quota is restored!)*

### Step 2: Run Diagram Captioning (Stage 2)
The text is in the DB, but the diagrams (images) still need to be extracted and sent to Gemini Vision to generate captions.
```bash
python scripts/caption_diagrams.py
```
- **Note:** This is a background/async task. It will take 3–5 hours because Gemini Vision on the free tier only allows ~15 requests per minute. Just let it run in a terminal and ignore it. 
- It saves directly to the `diagrams` table.

---

## 3. Moving to Frontend (Phase 4)
While the backend is paused or running diagram extraction, the backend API is ready. We can safely start building the **Jules PWA Chat UI**.
The frontend will connect directly to the Supabase Database and Gemini API.
