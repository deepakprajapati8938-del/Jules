"""
scripts/reingest_all_empty.py
Batch re-ingest all chapters that currently show 0 topics in the syllabus tracker.
Clears old chunks (including generic ChapterX rows) and re-ingests from the real PDFs.

Run: python scripts/reingest_all_empty.py
"""
import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pdf_to_markdown import pdf_to_markdown
from src.chunker import chunk_markdown
from src.embedder import embed_and_store, clear_chapter_chunks

logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(levelname)-8s  %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = Path("data/ncert")

# (relative_pdf_path, subject, chapter_override)
# chapter_override = EXACT name to store in DB (must normalize-match the roadmap name)
# For the syllabus tracker, roadmap chapter names are normalized via: re.sub(r'[^a-z0-9]', '', s.lower())
# So "Motion in a straight line" and "Motion In A Straight Line" are equivalent.

CHAPTERS = [
    # ── PHYSICS ──────────────────────────────────────────────────────────────────
    ("Physics/Class11_Ch01_UnitsAndMeasurements.pdf",              "Physics",   "Units and Measurements"),
    ("Physics/Class11_Ch02_MotionInAStraightLine.pdf",             "Physics",   "Motion in a straight line"),
    ("Physics/Class11_Ch03_MotionInAPlane.pdf",                    "Physics",   "Motion in a plane"),
    ("Physics/Class11_Ch04_LawsOfMotion.pdf",                      "Physics",   "Laws of motion"),
    ("Physics/Class11_Ch08_Gravitation.pdf",                       "Physics",   "Gravitation"),
    ("Physics/Class11_Ch09_MechanicalPropertiesOfSolids.pdf",      "Physics",   "Mechanical Properties of Solids"),
    ("Physics/Class11_Ch09_MechanicalPropertiesOfFluids.pdf",      "Physics",   "Mechanical Properties of Fluids"),
    ("Physics/Class11_Ch10_ThermalPropertiesOfMatter.pdf",         "Physics",   "Thermal Properties of matter"),
    ("Physics/Class11_Ch11_Thermodynamics.pdf",                    "Physics",   "Thermodynamics"),
    ("Physics/Class11_Ch12_KineticTheory.pdf",                     "Physics",   "Kinetic Theory"),
    ("Physics/Class11_Ch13_Oscillations.pdf",                      "Physics",   "Oscillations"),
    ("Physics/Class11_Ch14_Waves.pdf",                             "Physics",   "Waves"),
    ("Physics/Class12_Ch01_ElectricChargesAndFields.pdf",          "Physics",   "Electric Charges and Fields"),
    ("Physics/Class12_Ch02_ElectrostaticPotentialAndCapacitance.pdf", "Physics","Electrostatic Potential and Capacitance"),
    ("Physics/Class12_Ch03_CurrentElectricity.pdf",                "Physics",   "Current Electricity"),
    ("Physics/Class12_Ch04_MovingChargesAndMagnetism.pdf",         "Physics",   "Moving Charges and Magnetism"),
    ("Physics/Class12_Ch05_MagnetismAndMatter.pdf",                "Physics",   "Magnetism and Matter"),
    ("Physics/Class12_Ch07_AlternatingCurrent.pdf",                "Physics",   "Alternating Current"),
    ("Physics/Class12_Ch08_ElectromagneticWaves.pdf",              "Physics",   "Electromagnetic Waves"),
    ("Physics/Class12_Ch09_RayOpticsAndOpticalInstruments.pdf",    "Physics",   "Ray Optics and Optical Instruments"),
    ("Physics/Class12_Ch10_WaveOptics.pdf",                        "Physics",   "Wave Optics"),
    ("Physics/Class12_Ch11_DualNatureOfRadiationAndMatter.pdf",    "Physics",   "Dual Nature of Radiation and Matter"),
    ("Physics/Class12_Ch12_Atoms.pdf",                             "Physics",   "Atoms"),
    ("Physics/Class12_Ch13_Nuclei.pdf",                            "Physics",   "Nuclei"),

    # ── CHEMISTRY ────────────────────────────────────────────────────────────────
    ("Chemistry/Class11_Ch01_SomeBasicConceptsOfChemistry.pdf",    "Chemistry", "Some Basic Concept of Chemistry"),
    ("Chemistry/Class11_Ch03_ClassificationOfElementsAndPeriodicity.pdf", "Chemistry", "Classification of Elements and Periodicity in Properties"),
    ("Chemistry/Class11_Ch04_ChemicalBondingAndMolecularStructure.pdf",  "Chemistry", "Chemical Bonding and Molecular Structure"),
    # Thermodynamics PDF covers both planner chapters — ingest twice
    ("Chemistry/Class11_Ch05_Thermodynamics.pdf",                  "Chemistry", "Thermodynamics & Thermochemistry"),
    # Equilibrium PDF covers both Chemical & Ionic Equilibrium — ingest twice
    ("Chemistry/Class11_Ch06_Equilibrium.pdf",                     "Chemistry", "Chemical Equilibrium"),
    ("Chemistry/Class11_Ch06_Equilibrium.pdf",                     "Chemistry", "Ionic Equilibrium"),
    ("Chemistry/Class12_Ch01_Solutions.pdf",                       "Chemistry", "Solutions"),
    ("Chemistry/Class12_Ch03_ChemicalKinetics.pdf",                "Chemistry", "Chemical Kinetics"),
    ("Chemistry/Class12_Ch04_TheDAndFBlockElements.pdf",           "Chemistry", "The d- and f- block Elements"),
    ("Chemistry/Class12_Ch05_CoordinationCompounds.pdf",           "Chemistry", "Coordination Compound"),
    ("Chemistry/Class12_Ch06_HaloalkanesAndHaloarenes.pdf",        "Chemistry", "Haloalkanes and Haloarenes"),
    ("Chemistry/Class12_Ch07_AlcoholsPhenolsAndEthers.pdf",        "Chemistry", "Alcohols, Ethers and Phenols"),
    ("Chemistry/Class12_Ch08_AldehydesKetonesAndCarboxylicAcids.pdf", "Chemistry", "Aldehydes, Ketones and Carboxylic Acids"),
    ("Chemistry/Class12_Ch09_Amines.pdf",                          "Chemistry", "Amines"),

    # ── BIOLOGY ──────────────────────────────────────────────────────────────────
    ("Biology/Class12_Ch14_Ecosystem.pdf",                         "Biology",   "Ecosystem"),
]


def ingest_chapter(pdf_rel: str, subject: str, chapter_override: str) -> bool:
    pdf_path = DATA_DIR / pdf_rel
    if not pdf_path.exists():
        logger.warning(f"  SKIP (PDF not found): {pdf_path}")
        return False

    logger.info(f"\n{'='*60}")
    logger.info(f"  [{subject}] {chapter_override}")
    logger.info(f"  PDF: {pdf_path.name}")

    try:
        md_text, _ = pdf_to_markdown(str(pdf_path))
        chunks = chunk_markdown(md_text, subject=subject, chapter_override=chapter_override)

        if not chunks:
            logger.warning(f"  No chunks produced — skipping.")
            return False

        logger.info(f"  Clearing old chunks for '{chapter_override}' …")
        clear_chapter_chunks(chapter_override)

        logger.info(f"  Embedding {len(chunks)} chunks …")
        embed_and_store(chunks)
        logger.info(f"  ✓ Done: {len(chunks)} chunks stored.")
        return True

    except Exception as e:
        logger.error(f"  ERROR: {e}")
        return False


def main():
    total = len(CHAPTERS)
    success = 0
    failed = []

    for i, (pdf_rel, subject, chapter_override) in enumerate(CHAPTERS, 1):
        logger.info(f"\n[{i}/{total}] Processing …")
        ok = ingest_chapter(pdf_rel, subject, chapter_override)
        if ok:
            success += 1
        else:
            failed.append(chapter_override)

    logger.info(f"\n{'='*60}")
    logger.info(f"DONE: {success}/{total} chapters ingested successfully.")
    if failed:
        logger.info(f"Failed/skipped: {failed}")


if __name__ == "__main__":
    main()
