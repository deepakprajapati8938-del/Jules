"""
scripts/reingest_with_ai_topics.py

For chapters whose PDFs have no proper heading structure, this script:
1. Extracts full text from the PDF
2. Calls Gemini to identify the real NCERT section headings
3. Uses those headings to segment the text and re-ingest with proper topics

Run: python scripts/reingest_with_ai_topics.py
"""
import sys
import json
import logging
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pdf_to_markdown import pdf_to_markdown
from src.embedder import embed_and_store, clear_chapter_chunks
from src.llm_wrapper import call_llm
from src.config import GEMINI_TEXT_MODEL

logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(levelname)-8s  %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = Path("data/ncert")

# Chapters where the PDF has no usable heading structure.
# (pdf_path_relative, subject, chapter_name_for_db)
CHAPTERS = [
    # Chemistry Class 11
    ("Chemistry/Class11_Ch01_SomeBasicConceptsOfChemistry.pdf", "Chemistry", "Some Basic Concept of Chemistry"),
    ("Chemistry/Class11_Ch05_Thermodynamics.pdf",               "Chemistry", "Thermodynamics & Thermochemistry"),
    # Equilibrium PDF covers two planner chapters — do both
    ("Chemistry/Class11_Ch06_Equilibrium.pdf",                  "Chemistry", "Chemical Equilibrium"),
    ("Chemistry/Class11_Ch06_Equilibrium.pdf",                  "Chemistry", "Ionic Equilibrium"),
    # Chemistry Class 12
    ("Chemistry/Class12_Ch01_Solutions.pdf",                    "Chemistry", "Solutions"),
    ("Chemistry/Class12_Ch03_ChemicalKinetics.pdf",             "Chemistry", "Chemical Kinetics"),
    ("Chemistry/Class12_Ch04_TheDAndFBlockElements.pdf",        "Chemistry", "The d- and f- block Elements"),
    ("Chemistry/Class12_Ch05_CoordinationCompounds.pdf",        "Chemistry", "Coordination Compound"),
    ("Chemistry/Class12_Ch06_HaloalkanesAndHaloarenes.pdf",     "Chemistry", "Haloalkanes and Haloarenes"),
    ("Chemistry/Class12_Ch07_AlcoholsPhenolsAndEthers.pdf",     "Chemistry", "Alcohols, Ethers and Phenols"),
    ("Chemistry/Class12_Ch08_AldehydesKetonesAndCarboxylicAcids.pdf", "Chemistry", "Aldehydes, Ketones and Carboxylic Acids"),
    ("Chemistry/Class12_Ch09_Amines.pdf",                       "Chemistry", "Amines"),
    # Physics chapters that likely also have no headings
    ("Physics/Class11_Ch01_UnitsAndMeasurements.pdf",           "Physics",   "Units and Measurements"),
    ("Physics/Class11_Ch02_MotionInAStraightLine.pdf",          "Physics",   "Motion in a straight line"),
    ("Physics/Class11_Ch03_MotionInAPlane.pdf",                 "Physics",   "Motion in a plane"),
    ("Physics/Class11_Ch04_LawsOfMotion.pdf",                   "Physics",   "Laws of motion"),
    ("Physics/Class11_Ch08_Gravitation.pdf",                    "Physics",   "Gravitation"),
    ("Physics/Class11_Ch09_MechanicalPropertiesOfSolids.pdf",   "Physics",   "Mechanical Properties of Solids"),
    ("Physics/Class11_Ch09_MechanicalPropertiesOfFluids.pdf",   "Physics",   "Mechanical Properties of Fluids"),
    ("Physics/Class11_Ch10_ThermalPropertiesOfMatter.pdf",      "Physics",   "Thermal Properties of matter"),
    ("Physics/Class11_Ch11_Thermodynamics.pdf",                 "Physics",   "Thermodynamics"),
    ("Physics/Class11_Ch12_KineticTheory.pdf",                  "Physics",   "Kinetic Theory"),
    ("Physics/Class11_Ch13_Oscillations.pdf",                   "Physics",   "Oscillations"),
    ("Physics/Class11_Ch14_Waves.pdf",                          "Physics",   "Waves"),
    ("Physics/Class12_Ch01_ElectricChargesAndFields.pdf",       "Physics",   "Electric Charges and Fields"),
    ("Physics/Class12_Ch02_ElectrostaticPotentialAndCapacitance.pdf", "Physics", "Electrostatic Potential and Capacitance"),
    ("Physics/Class12_Ch03_CurrentElectricity.pdf",             "Physics",   "Current Electricity"),
    ("Physics/Class12_Ch04_MovingChargesAndMagnetism.pdf",      "Physics",   "Moving Charges and Magnetism"),
    ("Physics/Class12_Ch05_MagnetismAndMatter.pdf",             "Physics",   "Magnetism and Matter"),
    ("Physics/Class12_Ch07_AlternatingCurrent.pdf",             "Physics",   "Alternating Current"),
    ("Physics/Class12_Ch08_ElectromagneticWaves.pdf",           "Physics",   "Electromagnetic Waves"),
    ("Physics/Class12_Ch09_RayOpticsAndOpticalInstruments.pdf", "Physics",   "Ray Optics and Optical Instruments"),
    ("Physics/Class12_Ch10_WaveOptics.pdf",                     "Physics",   "Wave Optics"),
    ("Physics/Class12_Ch11_DualNatureOfRadiationAndMatter.pdf", "Physics",   "Dual Nature of Radiation and Matter"),
    ("Physics/Class12_Ch12_Atoms.pdf",                          "Physics",   "Atoms"),
    ("Physics/Class12_Ch13_Nuclei.pdf",                         "Physics",   "Nuclei"),
    # Biology
    ("Biology/Class12_Ch14_Ecosystem.pdf",                      "Biology",   "Ecosystem"),
]

MAX_CONTEXT_CHARS = 8000  # Send first N chars to LLM for heading extraction


def extract_topics_with_llm(text: str, chapter_name: str, subject: str) -> list[str]:
    """Use Gemini to extract the real NCERT section headings from this chapter."""
    context = text[:MAX_CONTEXT_CHARS]
    prompt = f"""You are an NCERT textbook expert. Below is the beginning of an NCERT {subject} chapter titled "{chapter_name}".

Extract the main section/topic headings of this chapter as they appear in the NCERT book. Return ONLY a JSON array of strings — the topic names, in order. Each topic should be a concise, human-readable section title (like "Solubility" or "Ohm's Law" or "Le Chatelier's Principle"). Do NOT include chapter title, exercises, summary, or sub-sub-sections.

Chapter text (first portion):
---
{context}
---

Return ONLY valid JSON like: ["Topic 1", "Topic 2", "Topic 3"]"""

    try:
        response = call_llm(
            system_prompt="You are an NCERT curriculum expert. Return only valid JSON arrays.",
            user_prompt=prompt,
            model_name=GEMINI_TEXT_MODEL
        )
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"```[a-z]*\n?", "", cleaned).replace("```", "").strip()
        topics = json.loads(cleaned)
        if isinstance(topics, list) and len(topics) > 0:
            return [str(t).strip() for t in topics if str(t).strip()]
    except Exception as e:
        logger.error(f"  LLM topic extraction failed: {e}")
    return []


def split_by_topics(text: str, topics: list[str]) -> list[dict]:
    """
    Split text into chunks by searching for topic keywords.
    Falls back to equal splits if keywords not found.
    """
    text_lower = text.lower()
    positions = []

    for topic in topics:
        # Search for key words from topic name in order
        keywords = sorted([w for w in topic.lower().split() if len(w) > 4], key=len, reverse=True)
        pos = -1
        for kw in keywords:
            idx = text_lower.find(kw)
            if idx != -1:
                pos = idx
                break
        positions.append(pos)

    # Filter out -1 (not found) positions and deduplicate
    found = [(topic, pos) for topic, pos in zip(topics, positions) if pos != -1]
    # Sort by position in text
    found.sort(key=lambda x: x[1])
    # Remove duplicates (same position range)
    deduped = []
    for item in found:
        if not deduped or item[1] - deduped[-1][1] > 200:
            deduped.append(item)
    found = deduped

    if not found:
        # Fallback: equal splits, one chunk per topic
        chunk_size = max(len(text) // len(topics), 500)
        return [
            {"content": text[i * chunk_size:(i + 1) * chunk_size].strip(), "topic": topic}
            for i, topic in enumerate(topics)
            if text[i * chunk_size:(i + 1) * chunk_size].strip()
        ]

    chunks = []
    for idx, (topic, start) in enumerate(found):
        end = found[idx + 1][1] if idx + 1 < len(found) else len(text)
        content = text[start:end].strip()
        if len(content) > 100:
            chunks.append({"content": content, "topic": topic})

    return chunks


def ingest_chapter(pdf_rel: str, subject: str, chapter_name: str) -> bool:
    pdf_path = DATA_DIR / pdf_rel
    if not pdf_path.exists():
        logger.warning(f"  SKIP (not found): {pdf_path}")
        return False

    logger.info(f"\n{'='*60}")
    logger.info(f"  [{subject}] {chapter_name}")

    try:
        md_text, _ = pdf_to_markdown(str(pdf_path))
    except Exception as e:
        logger.error(f"  PDF extraction failed: {e}")
        return False

    logger.info(f"  Asking Gemini for topic headings …")
    topics = extract_topics_with_llm(md_text, chapter_name, subject)

    if not topics:
        logger.warning(f"  No topics returned from LLM — skipping.")
        return False

    logger.info(f"  Got {len(topics)} topics: {topics}")
    segments = split_by_topics(md_text, topics)

    if not segments:
        logger.warning(f"  No segments produced — skipping.")
        return False

    # Build chunk dicts
    chunks = [
        {
            "content": seg["content"],
            "metadata": {
                "source_type": "NCERT",
                "subject": subject,
                "chapter": chapter_name,
                "topic": seg["topic"],
                "year": None,
            }
        }
        for seg in segments
    ]

    logger.info(f"  Clearing old chunks …")
    clear_chapter_chunks(chapter_name)

    logger.info(f"  Embedding {len(chunks)} chunks …")
    embed_and_store(chunks)
    logger.info(f"  ✓ Done.")
    return True


def main():
    total = len(CHAPTERS)
    success = 0
    failed = []

    for i, (pdf_rel, subject, chapter_name) in enumerate(CHAPTERS, 1):
        logger.info(f"\n[{i}/{total}]")
        ok = ingest_chapter(pdf_rel, subject, chapter_name)
        if ok:
            success += 1
        else:
            failed.append(chapter_name)

    logger.info(f"\n{'='*60}")
    logger.info(f"DONE: {success}/{total} ingested.")
    if failed:
        logger.warning(f"Failed: {failed}")


if __name__ == "__main__":
    main()
