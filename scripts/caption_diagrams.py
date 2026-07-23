"""
scripts/caption_diagrams.py — Stage 2: Image extraction + Gemini Vision captioning.

Run AFTER ingest_batch_ncert.py (Stage 1) is fully complete.
This script is completely independent of Stage 1 — it does NOT touch neet_chunks.

Pipeline per PDF:
  1. Load PDF with PyMuPDF
  2. Extract all images larger than MIN_IMG_WIDTH x MIN_IMG_HEIGHT px
  3. Save images to output/ncert_images/<Subject>/<Chapter>/
  4. For each image, call Gemini Vision to generate a caption
  5. Link each image to the nearest preceding heading (page-based heuristic)
  6. Upsert into the `diagrams` table in Supabase

Idempotent: already-processed image paths are skipped (via unique constraint).
Run as a background process — does NOT block or affect the chat Q&A feature.
"""

import sys
import logging
import re
import time
import base64
from pathlib import Path

import fitz  # PyMuPDF

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import GEMINI_TEXT_MODEL
from src.embedder import _get_gemini, _get_supabase
from ingest_batch_ncert import parse_filename

# ── Groq Vision client (lazy singleton) ──────────────────────────────────────
_groq_client = None

def _get_groq():
    global _groq_client
    if _groq_client is None:
        import os
        from dotenv import load_dotenv
        from pathlib import Path as _Path
        load_dotenv(_Path(__file__).parent.parent / ".env")
        try:
            from groq import Groq
            _groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
        except ImportError:
            raise ImportError("groq package not installed. Run: pip install groq")
        except KeyError:
            raise EnvironmentError("GROQ_API_KEY not set in .env")
    return _groq_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Tunables ──────────────────────────────────────────────────────────────────
MIN_IMG_WIDTH  = 200  # px — skip decorative elements; capture real diagrams only
MIN_IMG_HEIGHT = 200
# Groq free tier: 30 RPM. Sleep between Vision calls to stay under limit.
VISION_SLEEP_S = 2.0   # 2s = max ~30 req/min
GROQ_VISION_MODEL = "llama-4-scout-17b-16e-instruct"


# ── Image extraction ─────────────────────────────────────────────────────────

def _extract_images_from_pdf(pdf_path: Path, subject: str, chapter: str) -> tuple[list[dict], int]:
    """
    Extract images from a PDF. Returns (images_list, skipped_trivial_count).

    Each image dict:
        path        – saved file path (str)
        page        – 0-indexed page number
        bytes       – raw PNG bytes
        mime_type   – "image/png"
    """
    doc = fitz.open(str(pdf_path))
    out_dir = Path("output") / "ncert_images" / subject / chapter.replace(" ", "_")
    out_dir.mkdir(parents=True, exist_ok=True)

    images: list[dict] = []
    skipped = 0

    for page_num in range(len(doc)):
        page = doc[page_num]
        for img_idx, img_info in enumerate(page.get_images(full=True)):
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
            except Exception as exc:
                logger.debug(f"  extract_image xref={xref} page={page_num}: {exc}")
                continue

            w, h = base_image["width"], base_image["height"]
            if w < MIN_IMG_WIDTH or h < MIN_IMG_HEIGHT:
                skipped += 1
                continue

            # Normalise to PNG for consistent Vision API input
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.n - pix.alpha >= 4:          # CMYK → RGB
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                img_bytes = pix.tobytes("png")
                pix = None
            except Exception:
                img_bytes = base_image["image"]     # fallback to native bytes

            img_filename = f"page{page_num:04d}_img{img_idx:03d}.png"
            img_path = out_dir / img_filename
            if not img_path.exists():
                img_path.write_bytes(img_bytes)

            images.append({
                "path": str(img_path),
                "page": page_num,
                "bytes": img_bytes,
                "mime_type": "image/png",
            })

    doc.close()
    return images, skipped


# ── Heading extraction (simple, no pymupdf4llm to avoid hangs) ────────────────

def _extract_headings_from_pdf(pdf_path: Path) -> list[dict]:
    """
    Pull headings from the PDF text using pure PyMuPDF (no pymupdf4llm).
    Heuristic: text blocks shorter than 80 chars that are all-caps or title-case.
    Returns [{'title': str, 'page': int}, ...]
    """
    doc = fitz.open(str(pdf_path))
    headings: list[dict] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        for block in page.get_text("blocks"):
            text = block[4].strip()
            if not text or "\n" in text:
                continue
            if len(text) < 5 or len(text) > 90:
                continue
            if text.isupper() or text.istitle():
                headings.append({"title": text, "page": page_num})

    doc.close()
    return headings


# ── Topic linking ─────────────────────────────────────────────────────────────

def _link_images_to_headings(images: list[dict], headings: list[dict]) -> list[dict]:
    """Assign each image the nearest preceding heading (by page number)."""
    for img in images:
        preceding = [h for h in headings if h["page"] <= img["page"]]
        img["linked_topic"] = preceding[-1]["title"] if preceding else "Introduction"
        img["confidence"]   = "high" if preceding else "low"
    return images


# ── Gemini Vision captioning ──────────────────────────────────────────────────

def _caption_image(img_bytes: bytes, subject: str, chapter: str) -> str:
    """
    Returns a 1-3 sentence caption using Groq Vision (llama-4-scout),
    or "NOT_A_DIAGRAM" if the image is decorative / unreadable.
    """
    import base64
    client = _get_groq()
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    prompt = (
        f"This is an image from an NCERT {subject} textbook, chapter '{chapter}'. "
        "Describe what this diagram/figure shows in 1-3 concise sentences suitable "
        "as a caption for a student. "
        "If the image is purely decorative, a watermark, a border, or unreadable, "
        "respond with exactly: NOT_A_DIAGRAM"
    )

    for attempt in range(5):
        try:
            response = client.chat.completions.create(
                model=GROQ_VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{b64}"},
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
                max_tokens=256,
            )
            return response.choices[0].message.content.strip()
        except Exception as exc:
            msg = str(exc)
            if "429" in msg or "rate" in msg.lower() or "limit" in msg.lower():
                delay = VISION_SLEEP_S * (2 ** attempt)
                logger.warning(f"  Rate limited — waiting {delay:.0f}s (attempt {attempt+1}/5)")
                time.sleep(delay)
            else:
                logger.error(f"  Groq Vision error: {exc}")
                return "NOT_A_DIAGRAM"

    logger.error("  Max retries exceeded for Groq Vision call.")
    return "NOT_A_DIAGRAM"


# ── Per-PDF processing ────────────────────────────────────────────────────────

def _process_pdf(pdf_path: Path, sb) -> dict:
    """Process one PDF end-to-end. Returns a result summary dict."""
    subject, chapter = parse_filename(pdf_path)
    if not subject or not chapter:
        return {"file": pdf_path.name, "status": "SKIPPED", "reason": "Invalid filename"}

    logger.info("=" * 60)
    logger.info(f"  {chapter}  ({subject})")
    logger.info("=" * 60)

    # Step 1: Extract images
    images, skipped = _extract_images_from_pdf(pdf_path, subject, chapter)
    logger.info(f"  Images extracted: {len(images)}  |  Trivial skipped: {skipped}")

    if not images:
        return {"file": pdf_path.name, "status": "NO_IMAGES", "reason": "No non-trivial images"}

    # Step 2: Extract headings for linking
    headings = _extract_headings_from_pdf(pdf_path)
    logger.info(f"  Headings found: {len(headings)}")

    # Step 3: Link images to headings
    images = _link_images_to_headings(images, headings)

    # Step 4: Caption + store
    inserted = skipped_dup = discarded = 0

    for i, img in enumerate(images, 1):
        logger.info(f"  [{i}/{len(images)}] Captioning {Path(img['path']).name} …")

        caption = _caption_image(img["bytes"], subject, chapter)

        if caption == "NOT_A_DIAGRAM":
            discarded += 1
            logger.info("    → Discarded (NOT_A_DIAGRAM)")
        else:
            logger.info(f"    → Caption: {caption[:80]}{'…' if len(caption) > 80 else ''}")
            row = {
                "image_path":   img["path"],
                "caption":      caption,
                "subject":      subject,
                "chapter":      chapter,
                "linked_topic": img["linked_topic"],
                "confidence":   img["confidence"],
                "page_number":  img["page"],
            }
            try:
                sb.table("diagrams").insert(row).execute()
                inserted += 1
            except Exception as exc:
                # Unique constraint violation = already in DB
                if "duplicate" in str(exc).lower() or "unique" in str(exc).lower():
                    skipped_dup += 1
                    logger.debug(f"    Already in DB — skipping.")
                else:
                    logger.error(f"    DB insert failed: {exc}")

        time.sleep(VISION_SLEEP_S)

    logger.info(
        f"  Done: {inserted} inserted | {discarded} discarded | {skipped_dup} already in DB"
    )
    return {
        "file":     pdf_path.name,
        "status":   "SUCCESS",
        "inserted": inserted,
        "discarded":discarded,
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    data_dir = Path("data/ncert")
    if not data_dir.exists():
        logger.error(f"Directory not found: {data_dir}")
        sys.exit(1)

    pdf_files = sorted(data_dir.rglob("*.pdf"))
    if not pdf_files:
        logger.warning(f"No PDFs found under {data_dir}")
        sys.exit(0)

    logger.info(f"Found {len(pdf_files)} PDFs to process for image captioning.")
    logger.info("NOTE: This is Stage 2 — runs independently of text ingestion.")
    logger.info("      The chat Q&A (Stage 1) is NOT affected by this process.")
    logger.info("")

    sb = _get_supabase()
    results = []

    for pdf_path in pdf_files:
        try:
            result = _process_pdf(pdf_path, sb)
        except Exception as exc:
            logger.error(f"Unexpected error on {pdf_path.name}: {exc}", exc_info=True)
            result = {"file": pdf_path.name, "status": "ERROR", "reason": str(exc)}
        results.append(result)

    # ── Summary ───────────────────────────────────────────────────────────────
    logger.info("")
    logger.info("=" * 70)
    logger.info("DIAGRAM CAPTIONING SUMMARY")
    logger.info("=" * 70)
    logger.info(f"{'File':<45} {'Status':<12} {'Inserted':>8}")
    logger.info("-" * 70)
    for r in results:
        ins = r.get("inserted", 0)
        reason = r.get("reason", "")
        status = r["status"]
        logger.info(f"{r['file']:<45} {status:<12} {ins:>8}  {reason}")
    logger.info("=" * 70)

    total_ins = sum(r.get("inserted", 0) for r in results)
    logger.info(f"Total diagrams inserted across all chapters: {total_ins}")


if __name__ == "__main__":
    main()
