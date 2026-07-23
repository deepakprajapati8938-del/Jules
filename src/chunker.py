"""
src/chunker.py — Steps 3 & 4 of the NEET RAG pipeline.

Responsibilities:
  3. Chunk Markdown along heading boundaries (topic / subtopic level).
  4. Tag every chunk with required metadata.

Chunking strategy:
  - Split on ## and ### headings (topic/subtopic level).
  - The chapter-level # heading is captured as chapter name.
  - Very small chunks (< MIN_CHUNK_CHARS) are merged upward.
  - Very large chunks (> MAX_CHUNK_CHARS) are split at paragraph boundaries.

Metadata schema per chunk:
  {
    "source_type": "NCERT",
    "subject":     str,     # e.g. "Biology"
    "chapter":     str,     # e.g. "Cell: The Unit of Life"
    "topic":       str,     # derived from heading hierarchy
    "year":        null
  }
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ── Tuning knobs ──────────────────────────────────────────────────────────────
MIN_CHUNK_CHARS = 150    # merge chunks shorter than this into the previous one
MAX_CHUNK_CHARS = 2500   # split chunks larger than this at paragraph breaks


# ── Public API ────────────────────────────────────────────────────────────────

def chunk_markdown(
    md_text: str,
    subject: str,
    chapter_override: str | None = None,
) -> list[dict[str, Any]]:
    """
    Split a Markdown document into chunks along heading boundaries and
    attach metadata to each chunk.

    Args:
        md_text:          Full Markdown text from pdf_to_markdown.
        subject:          Subject label (e.g. "Biology", "Physics").
        chapter_override: If given, overrides the chapter name extracted
                          from the # heading.

    Returns:
        List of dicts:  [{"content": str, "metadata": dict}, ...]
    """
    logger.info("[Step 3] Chunking Markdown along heading boundaries …")

    # ── Extract chapter name from # heading ───────────────────────────────────
    chapter_name = chapter_override or _extract_chapter_name(md_text)
    logger.info(f"  Chapter detected: '{chapter_name}'")

    # ── Split into raw sections at ## / ### headings ──────────────────────────
    raw_sections = _split_on_headings(md_text)
    logger.info(f"  Raw sections after split: {len(raw_sections)}")

    # ── Merge tiny sections upward ────────────────────────────────────────────
    merged = _merge_small_chunks(raw_sections)
    logger.info(f"  Sections after merging small chunks: {len(merged)}")

    # ── Split oversized sections at paragraph breaks ──────────────────────────
    final_sections: list[dict[str, str]] = []
    for section in merged:
        if len(section["content"]) > MAX_CHUNK_CHARS:
            final_sections.extend(_split_large_chunk(section))
        else:
            final_sections.append(section)
    logger.info(f"  Final chunk count: {len(final_sections)}")

    # ── Attach metadata ───────────────────────────────────────────────────────
    chunks: list[dict[str, Any]] = []
    for section in final_sections:
        content = section["content"].strip()
        if not content:
            continue
        chunks.append({
            "content": content,
            "metadata": {
                "source_type": "NCERT",
                "subject":     subject,
                "chapter":     chapter_name,
                "topic":       section["heading"],
                "year":        None,
            },
        })

    logger.info(f"  ✓  {len(chunks)} chunks ready for embedding.")
    return chunks


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_chapter_name(md_text: str) -> str:
    """
    Return the chapter name from the Markdown.

    Uses the first heading found anywhere in the document (regardless of level),
    since NCERT PDFs start with the chapter heading (often rendered as ## by
    pymupdf4llm) before any other headings like # EXERCISES.

    The caller can always pass chapter_override to bypass auto-detection.
    """
    heading_pattern = re.compile(r"^#{1,6}\s+(.+)$", re.MULTILINE)
    match = heading_pattern.search(md_text)
    if match:
        return match.group(1).strip()
    return "Unknown Chapter"


def _split_on_headings(md_text: str) -> list[dict[str, str]]:
    """
    Split Markdown into sections wherever a ## or ### heading appears.
    Each section dict has keys 'heading' and 'content'.

    The preamble before the first ## heading is kept as a section with the
    chapter name as its heading.
    """
    # Pattern: lines that start with ## or ### (topic / subtopic level)
    heading_pattern = re.compile(r"^(#{2,3})\s+(.+)$", re.MULTILINE)

    sections: list[dict[str, str]] = []
    last_end = 0
    current_heading = _extract_chapter_name(md_text)

    for match in heading_pattern.finditer(md_text):
        # Flush the content before this heading
        content = md_text[last_end:match.start()].strip()
        if content:
            sections.append({"heading": current_heading, "content": content})

        current_heading = match.group(2).strip()
        last_end = match.end()

    # Flush remaining content after the last heading
    tail = md_text[last_end:].strip()
    if tail:
        sections.append({"heading": current_heading, "content": tail})

    return sections


def _merge_small_chunks(
    sections: list[dict[str, str]],
) -> list[dict[str, str]]:
    """
    Merge any section shorter than MIN_CHUNK_CHARS into the previous section.
    This avoids tiny single-sentence chunks that carry little retrieval signal.
    """
    if not sections:
        return sections

    merged: list[dict[str, str]] = [sections[0]]
    for section in sections[1:]:
        if len(section["content"]) < MIN_CHUNK_CHARS:
            # Append content to the previous chunk
            merged[-1]["content"] += "\n\n" + section["content"]
            # Keep the earlier section's heading (or compose both)
            merged[-1]["heading"] = (
                merged[-1]["heading"] + " / " + section["heading"]
            )
        else:
            merged.append(section)
    return merged


def _split_large_chunk(section: dict[str, str]) -> list[dict[str, str]]:
    """
    Split a section that exceeds MAX_CHUNK_CHARS at double-newline paragraph
    boundaries, producing sub-chunks each under MAX_CHUNK_CHARS.
    """
    paragraphs = re.split(r"\n{2,}", section["content"])
    sub_chunks: list[dict[str, str]] = []
    current_parts: list[str] = []
    current_len = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if current_len + len(para) > MAX_CHUNK_CHARS and current_parts:
            sub_chunks.append({
                "heading": section["heading"],
                "content": "\n\n".join(current_parts),
            })
            current_parts = []
            current_len = 0
        current_parts.append(para)
        current_len += len(para)

    if current_parts:
        sub_chunks.append({
            "heading": section["heading"],
            "content": "\n\n".join(current_parts),
        })

    return sub_chunks if sub_chunks else [section]
