# NEET Prep — Phase 3 Build Spec: Diagram Extraction, Captioning & Linking

**Audience note: written in maximum explicit detail on purpose, because the
coding agent executing this runs on a Gemini model, which needs concrete,
step-by-step instructions rather than high-level intent. Do not skip steps.
Do not infer requirements not stated here — if something is ambiguous, stop
and ask rather than guessing.**

**Prerequisite: Phase 2 must already be complete and validated — all NCERT
chapters ingested into `neet_chunks`, `syllabus_config` seeded, PYQs
ingested and cross-checked. Do not start Phase 3 until Phase 2 is
explicitly confirmed done by the human reviewer.**

---

## Goal of Phase 3
For every NCERT chapter PDF already processed in Phase 2, extract every
diagram/image, generate a caption for each one via Gemini Vision, link
each diagram to the correct heading/topic in that chapter's content, and
store everything so that later (in a future UI phase) a diagram can be
displayed alongside the chat answer it's relevant to.

Do NOT build: any UI, chat rendering, or display logic. This phase is
purely: extract → caption → link → store. Displaying the images in chat
is a later phase.

---

## Part A: Extract images from PDFs

### A1. Input
- Use the same set of NCERT chapter PDFs already ingested in Phase 2
  (paths under `data/ncert/{Subject}/`). Do not re-process PYQ PDFs in
  this phase — diagrams are an NCERT-only concern for now.

### A2. Extraction tool
- Use PyMuPDF (the `fitz` library) to extract embedded images from each
  PDF, page by page.
- For each extracted image, record:
  - `source_chapter`: same chapter name used in Phase 2 (must match
    `neet_chunks.metadata->>'chapter'` exactly, for later linking)
  - `subject`: same subject used in Phase 2
  - `page_number`: the PDF page number the image was found on
  - `position_on_page`: bounding box coordinates (x0, y0, x1, y1) as
    returned by PyMuPDF — needed later for the linking heuristic
  - `image_index_on_page`: if a page has multiple images, number them
    in the order PyMuPDF returns them (0, 1, 2, ...) so multi-diagram
    pages can be disambiguated later

### A3. Save extracted images to disk
- Save each image file to:
  `output/ncert_images/{subject}/{chapter}/page{NN}_img{index}.png`
  (use whatever original format PyMuPDF gives you if not PNG-convertible
  cleanly — but PNG is preferred for consistency; convert if easy, else
  log the format used).
- Do not overwrite existing images if this script is re-run — check if
  the file already exists at that path and skip re-extraction for that
  specific image (log it as "already extracted, skipped").

### A4. Skip trivial images
- Skip images that are clearly not diagrams: things like page borders,
  tiny icons, decorative dividers, or logos. A reasonable heuristic:
  skip images below a minimum size threshold (e.g. width or height under
  50px) — log how many were skipped this way per chapter so I can sanity
  check the threshold isn't too aggressive or too lax.

### A5. Logging
- Print a summary at the end: chapter name, number of images extracted,
  number skipped as trivial, and any per-file errors (corrupt image
  data, extraction failure, etc. — log and continue, don't crash the
  batch on one bad image).

---

## Part B: Caption each image via Gemini Vision

### B1. For each extracted image (from Part A)
- Send the image to Gemini Vision (the current vision-capable Gemini
  model — check what's current, don't hardcode a deprecated model
  name).
- Prompt Gemini with something like: "This is a diagram from an NCERT
  {subject} textbook, chapter '{chapter}'. Describe what this diagram
  shows in 1-3 sentences, suitable as a caption for a student studying
  this chapter. If the image is not a meaningful diagram (e.g. a
  decorative element, a blank page fragment, or unreadable), respond
  with exactly: NOT_A_DIAGRAM"
- If the response is `NOT_A_DIAGRAM`, discard this image (do not store
  it further) and log it as filtered-out. This is a second-pass filter
  beyond the size heuristic in A4 — some genuinely large images may
  still not be meaningful diagrams (e.g. a full-page textbook cover
  scan).
- Otherwise, store the caption text alongside the image record.

### B2. Rate limiting
- This will make one Gemini Vision API call per image, which for ~79
  chapters could be a large number of calls. Add retry-with-backoff on
  rate-limit errors (429s), and process images with a small delay
  between calls if you hit rate limits repeatedly — do not hammer the
  API in a tight loop with no backoff.
- Log progress periodically (e.g. every 20 images captioned) so I can
  see the batch is progressing, not stuck.

---

## Part C: Link each diagram to its heading/topic

### C1. Linking heuristic (page + position based)
- For each captioned image (from Part B), determine which heading/topic
  in that chapter's Markdown (from Phase 1/2's `.md` output) it belongs
  under, using this heuristic:
  1. Find which page the image is on (`page_number` from Part A).
  2. Find the heading in the chapter's Markdown that appears closest
     before that page/position — i.e. the last heading encountered
     before this image's position in the original PDF reading order.
  3. If a page has multiple images (`image_index_on_page` > 0) and
     multiple headings could plausibly apply, use `position_on_page`
     (top-to-bottom order matches heading-to-image order on that page,
     in most cases) to disambiguate.

### C2. Confidence flagging
- This heuristic is expected to be roughly 90% accurate per the
  original brief — it is not perfect, especially on pages with multiple
  diagrams and multiple headings close together.
- For any page with more than one image AND more than one heading
  candidate nearby, mark this link as `confidence: "low"` rather than
  guessing silently. For single-image, single-nearby-heading pages,
  mark as `confidence: "high"`.
- Log a separate summary list of all `low` confidence links (chapter,
  page, image file path, candidate headings considered) for manual
  review later. Do not skip these — still store your best-guess link,
  just flag it.

### C3. Storage
- Add a new table (or extend an existing one — your call, but tell me
  which you did): store per-image records with:
  - `image_path` (path to the saved file from Part A)
  - `caption` (from Part B)
  - `subject`, `chapter` (must match `neet_chunks` values exactly)
  - `linked_topic` (the heading/topic this image was linked to)
  - `confidence` ("high" or "low")
  - `page_number`
- This table does NOT need to be joined into `neet_chunks` directly in
  this phase — a future retrieval-update phase will handle showing
  images alongside chat answers. For now, just get the data correctly
  extracted, captioned, linked, and stored.

---

## Explicitly NOT in scope for Phase 3
- Displaying images in any chat UI (that's a later phase)
- Modifying the retrieval function to surface images with answers
- Manual review UI for low-confidence links (for now, just produce the
  log list — I will review it manually by reading the log, no tool
  needed yet)
- Re-processing PYQ PDFs for diagrams

## Definition of done for Phase 3
- All chapter PDFs processed for image extraction, with a summary log
  (per chapter: images extracted, skipped-as-trivial, discarded-as-
  not-a-diagram).
- All retained images captioned via Gemini Vision.
- All captioned images linked to a topic/heading, with confidence
  flagged, and a separate low-confidence review list produced.
- I review the low-confidence list and a random sample of high-
  confidence links before we move to any phase that displays these in
  a UI.

## Things to stop and ask me about (do not guess on these)
1. If PyMuPDF can't cleanly convert an image to PNG, ask before choosing
   a fallback format.
2. If the size threshold for "trivial image" filtering seems to be
   discarding real diagrams (you'll notice this if a chapter you'd
   expect to have several diagrams shows zero extracted) — flag it
   rather than silently proceeding with a threshold that might be
   wrong for this content.
