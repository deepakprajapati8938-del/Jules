"""
src/pdf_to_markdown.py — Steps 1 & 2 of the NEET RAG pipeline.

Responsibilities:
  1. Input check: detect whether the PDF is text-based or scanned.
  2. Convert PDF to Markdown (preserving heading hierarchy) using pymupdf4llm.
  3. Write the .md file to disk for visual inspection.
  4. Log the detection result and output path.
"""

import logging
import re
from pathlib import Path

import pymupdf          # PyMuPDF — installed as part of pymupdf4llm
import pymupdf4llm

from src.config import OUTPUT_DIR, SCANNED_PAGE_CHAR_THRESHOLD

logger = logging.getLogger(__name__)


# ── Public API ────────────────────────────────────────────────────────────────

def pdf_to_markdown(pdf_path: str | Path, subject: str = None, chapter_name: str = None) -> tuple[str, Path]:
    """
    Convert a PDF chapter to Markdown and write it to OUTPUT_DIR.

    Args:
        pdf_path: Absolute or relative path to the NCERT chapter PDF.

    Returns:
        (markdown_text, output_md_path) — the Markdown string and the path
        where it was written.

    Raises:
        FileNotFoundError: if pdf_path does not exist.
        RuntimeError: if text extraction produces no usable content.
    """
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    logger.info("─" * 60)
    logger.info(f"[Step 1] Input check: {pdf_path.name}")

    # ── 1. Detect text-based vs scanned ──────────────────────────────────────
    pdf_type, scanned_page_count, total_pages = _detect_pdf_type(pdf_path)
    if pdf_type == "scanned":
        logger.warning(
            f"  ⚠  Scanned PDF detected "
            f"({scanned_page_count}/{total_pages} pages below char threshold). "
            f"pymupdf4llm will apply per-region OCR automatically."
        )
    else:
        logger.info(
            f"  ✓  Text-based PDF ({total_pages} pages). "
            f"Direct text extraction will be used."
        )

    # ── 2a. Fast text extraction (text-based PDFs) ────────────────────────────
    logger.info("[Step 2] Fast text extraction …")
    doc = pymupdf.open(str(pdf_path))
    md_lines = []

    for page in doc:
        blocks = page.get_text("blocks")
        for b in blocks:
            text = b[4].strip()
            if not text:
                continue
            # Heuristic heading detection: short, no newlines, all-caps or title-case
            if len(text) < 60 and "\n" not in text and (text.isupper() or text.istitle()):
                md_lines.append(f"\n## {text}\n")
            else:
                md_lines.append(text + "\n")

    doc.close()
    md_text = "\n".join(md_lines)

    # ── 2b. OCR fallback for scanned PDFs ─────────────────────────────────────
    if not md_text or len(md_text.strip()) < 100:
        if pdf_type == "scanned":
            logger.info("[Step 2b] Scanned PDF — running Tesseract OCR via PyMuPDF …")
            try:
                doc = pymupdf.open(str(pdf_path))
                ocr_lines = []
                for page_num, page in enumerate(doc):
                    try:
                        tp = page.get_textpage_ocr(language="eng", dpi=200, full=False)
                        text = page.get_text(textpage=tp).strip()
                        if text:
                            ocr_lines.append(f"\n## Page {page_num + 1}\n")
                            ocr_lines.append(text + "\n")
                    except Exception as ocr_exc:
                        logger.debug(f"  OCR failed page {page_num}: {ocr_exc}")
                doc.close()
                md_text = "\n".join(ocr_lines)
                logger.info(f"  OCR complete — {len(md_text):,} chars extracted.")
            except Exception as exc:
                logger.error(f"  OCR pass failed: {exc}")

        if not md_text or len(md_text.strip()) < 100:
            raise RuntimeError(
                "PDF → Markdown conversion produced near-empty output. "
                "The PDF may be fully image-locked and require a dedicated OCR pass."
            )

    # ── 3. Write .md file to disk ─────────────────────────────────────────────
    if subject and chapter_name:
        out_dir = OUTPUT_DIR / "ncert_md" / subject
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{chapter_name.replace(' ', '_')}.md"
    else:
        out_path = OUTPUT_DIR / f"{_sanitize_filename(pdf_path.stem)}.md"

    out_path.write_text(md_text, encoding="utf-8")

    logger.info(f"  ✓  Markdown written to: {out_path}")
    logger.info(
        f"     {len(md_text):,} characters  |  "
        f"~{len(md_text.splitlines()):,} lines"
    )

    return md_text, out_path


# ── Helpers ───────────────────────────────────────────────────────────────────

def _detect_pdf_type(
    pdf_path: Path,
) -> tuple[str, int, int]:
    """
    Open the PDF with PyMuPDF and count how many pages have fewer than
    SCANNED_PAGE_CHAR_THRESHOLD characters of extractable text.

    Returns:
        (pdf_type, scanned_page_count, total_pages)
        where pdf_type is "text" or "scanned".
    """
    doc = pymupdf.open(str(pdf_path))
    total_pages = len(doc)
    scanned_count = 0

    for page in doc:
        text = page.get_text().strip()
        if len(text) < SCANNED_PAGE_CHAR_THRESHOLD:
            scanned_count += 1

    doc.close()

    # Treat as scanned if more than half the pages are below the threshold
    pdf_type = "scanned" if scanned_count > total_pages / 2 else "text"
    return pdf_type, scanned_count, total_pages


def _sanitize_filename(name: str) -> str:
    """Replace characters that are invalid in filenames with underscores."""
    return re.sub(r'[\\/*?:"<>|]', "_", name)
