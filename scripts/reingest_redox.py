"""
scripts/reingest_redox.py
Force re-ingest Class11_Ch07_RedoxReactions.pdf with NCERT's actual
topic structure injected manually, since the PDF lacks proper headings.

Run once: python scripts/reingest_redox.py
"""
import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pdf_to_markdown import pdf_to_markdown
from src.embedder import embed_and_store, clear_chapter_chunks

logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(levelname)-8s  %(message)s')
logger = logging.getLogger(__name__)

PDF_PATH = Path("data/ncert/Chemistry/Class11_Ch07_RedoxReactions.pdf")
CHAPTER_NAME = "Redox Reactions"
SUBJECT = "Chemistry"

# Official NCERT Class 11 Chapter 7 topic structure
NCERT_TOPICS = [
    "Classical Idea of Redox Reactions",
    "Redox Reactions in Terms of Electron Transfer",
    "Oxidation Number",
    "Types of Redox Reactions",
    "Balancing of Redox Reactions",
    "Redox Reactions as the Basis for Titrations",
    "Limitations of Concept of Oxidation Number",
    "Redox Reactions and Electrode Processes",
]

def split_text_into_topic_chunks(full_text: str, topics: list[str]) -> list[dict]:
    """
    Splits the full PDF text across the NCERT topics by searching for
    keyword matches. Falls back to equal-length splits if no keyword found.
    """
    text_lower = full_text.lower()
    positions = []

    for topic in topics:
        # Search for keyword from topic name in the text
        keywords = [w for w in topic.lower().split() if len(w) > 4]
        pos = -1
        for kw in keywords:
            idx = text_lower.find(kw)
            if idx != -1:
                pos = idx
                break
        positions.append(pos)

    # Build slices: from each found position to the next
    chunks = []
    found = [(i, p) for i, p in enumerate(positions) if p != -1]
    
    if not found:
        # Fallback: equal split
        chunk_size = len(full_text) // len(topics)
        for i, topic in enumerate(topics):
            content = full_text[i * chunk_size: (i + 1) * chunk_size].strip()
            if content:
                chunks.append({"content": content, "metadata": {
                    "source_type": "NCERT", "subject": SUBJECT,
                    "chapter": CHAPTER_NAME, "topic": topic, "year": None
                }})
        return chunks

    # Use found positions to carve out slices
    for idx, (i, start) in enumerate(found):
        end = found[idx + 1][1] if idx + 1 < len(found) else len(full_text)
        content = full_text[start:end].strip()
        if len(content) > 100:
            chunks.append({"content": content, "metadata": {
                "source_type": "NCERT", "subject": SUBJECT,
                "chapter": CHAPTER_NAME, "topic": topics[i], "year": None
            }})

    return chunks


def main():
    if not PDF_PATH.exists():
        logger.error(f"PDF not found: {PDF_PATH}")
        sys.exit(1)

    logger.info(f"Converting {PDF_PATH} to markdown …")
    md_text, _ = pdf_to_markdown(str(PDF_PATH))
    logger.info(f"  Got {len(md_text)} chars of text")

    logger.info("Splitting into NCERT topic chunks …")
    chunks = split_text_into_topic_chunks(md_text, NCERT_TOPICS)
    logger.info(f"  Produced {len(chunks)} chunks:")
    for c in chunks:
        logger.info(f"    [{c['metadata']['topic']}] — {len(c['content'])} chars")

    logger.info(f"Clearing old Redox Reactions chunks from DB …")
    clear_chapter_chunks(CHAPTER_NAME)

    logger.info("Embedding and storing new chunks …")
    embed_and_store(chunks)
    logger.info("Done! Redox Reactions re-ingested with proper topics.")


if __name__ == "__main__":
    main()
