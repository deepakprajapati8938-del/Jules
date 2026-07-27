"""
scripts/rename_to_standard.py
Renames all Physics and Chemistry PDFs to standard format:
  Class{11|12}_Ch{NN}_{ChapterNameNoSpaces}.pdf
so that ingest_batch_ncert.py can parse them correctly.

Run with:  python scripts/rename_to_standard.py
Use --dry-run to preview without actually renaming.
"""
import sys
import re
from pathlib import Path

# ── Physics mapping ───────────────────────────────────────────────────────────
# Format: current_stem (lowercase, no spaces) -> (class, ch_num, standard_name)
PHYSICS_MAP = {
    # Class 11
    "unitsandmeasurements":                     (11,  1, "UnitsAndMeasurements"),
    "motionina straightline":                   (11,  2, "MotionInAStraightLine"),
    "motioninAStraightline":                    (11,  2, "MotionInAStraightLine"),
    "motininastraightline":                     (11,  2, "MotionInAStraightLine"),
    "motionastraightline":                      (11,  2, "MotionInAStraightLine"),
    "motioninaStraightLine":                    (11,  2, "MotionInAStraightLine"),
    "motionina straigntline":                   (11,  2, "MotionInAStraightLine"),
    "motionaplane":                             (11,  3, "MotionInAPlane"),
    "motininaplane":                            (11,  3, "MotionInAPlane"),
    "lawsofmotion":                             (11,  4, "LawsOfMotion"),
    "workenergyandpower":                       (11,  5, "WorkEnergyAndPower"),
    "centreofmassandsystemofparticles":         (11,  6, "CentreOfMassAndSystemOfParticles"),
    "rotationalmotion":                         (11,  7, "RotationalMotion"),
    "gravitation":                              (11,  8, "Gravitation"),
    "mchanicalpropertiesofsolids":              (11,  9, "MechanicalPropertiesOfSolids"),
    "mechanicalpropertiesofsolids":             (11,  9, "MechanicalPropertiesOfSolids"),
    # Class 11 Ch09-14 already correctly named as Class11_Ch09_... etc — handled below
    # Class 12
    "currentelectricity":                       (12,  3, "CurrentElectricity"),
    "magnetismandmatter":                       (12,  5, "MagnetismAndMatter"),
    "magnetism and matter":                     (12,  5, "MagnetismAndMatter"),
    "electromagneticwaves":                     (12,  8, "ElectromagneticWaves"),
    "electromagnetic waves":                    (12,  8, "ElectromagneticWaves"),
    "rayopticsandopticalinstruments":           (12,  9, "RayOpticsAndOpticalInstruments"),
    "ray optics":                               (12,  9, "RayOpticsAndOpticalInstruments"),
    "ray optics and optical instruments":       (12,  9, "RayOpticsAndOpticalInstruments"),
    "waveoptics":                               (12, 10, "WaveOptics"),
    "wave optics":                              (12, 10, "WaveOptics"),
    "dualnatureofradiationandmatter":           (12, 11, "DualNatureOfRadiationAndMatter"),
    "dual nature of radiation and matter":      (12, 11, "DualNatureOfRadiationAndMatter"),
    "dual nature":                              (12, 11, "DualNatureOfRadiationAndMatter"),
    "nuclei":                                   (12, 13, "Nuclei"),
    # Class 11 — plain name files
    "motionina plane":                          (11,  3, "MotionInAPlane"),
    "motionaplane":                             (11,  3, "MotionInAPlane"),
    "motininaplane":                            (11,  3, "MotionInAPlane"),
    "centre of mass, rotational motion":        (11,  6, "CentreOfMassAndRotationalMotion"),
    "centre of mass rotational motion":         (11,  6, "CentreOfMassAndRotationalMotion"),
    "work energy & power":                      (11,  5, "WorkEnergyAndPower"),
    "work energy and power":                    (11,  5, "WorkEnergyAndPower"),
    "workenergyandpower":                       (11,  5, "WorkEnergyAndPower"),
}

# ── Chemistry mapping ─────────────────────────────────────────────────────────
CHEMISTRY_MAP = {
    # Class 11
    "some basic concepts of chemistry":        (11,  1, "SomeBasicConceptsOfChemistry"),
    "somebasicconceptsofchemistry":            (11,  1, "SomeBasicConceptsOfChemistry"),
    "structure of atom":                       (11,  2, "StructureOfAtom"),
    "structureofatom":                         (11,  2, "StructureOfAtom"),
    "classification of elements and periodicity in properties": (11, 3, "ClassificationOfElementsAndPeriodicity"),
    "classificationofelementsandperiodicityinproperties":       (11, 3, "ClassificationOfElementsAndPeriodicity"),
    "chemical bonding and molecular structure": (11, 4, "ChemicalBondingAndMolecularStructure"),
    "chemicalbondingandmolecularstructure":    (11,  4, "ChemicalBondingAndMolecularStructure"),
    "thermodynamics":                          (11,  5, "Thermodynamics"),
    "equilibrium":                             (11,  6, "Equilibrium"),
    "redox reactions":                         (11,  7, "RedoxReactions"),
    "redoxreactions":                          (11,  7, "RedoxReactions"),
    "organic chemistry - some basic principles and techniques": (11, 8, "OrganicChemistrySomeBasicPrinciples"),
    "organic chemistry – some basic principles and techniques": (11, 8, "OrganicChemistrySomeBasicPrinciples"),
    "organicchemistry sombasicprinciplesandtechniques":         (11, 8, "OrganicChemistrySomeBasicPrinciples"),
    "hydrocarbons":                            (11,  9, "Hydrocarbons"),
    # Class 12
    "solutions":                               (12,  1, "Solutions"),
    "electrochemistry":                        (12,  2, "Electrochemistry"),
    "chemical kinetics":                       (12,  3, "ChemicalKinetics"),
    "chemicalkinetics":                        (12,  3, "ChemicalKinetics"),
    "the d - and f -block elements the d- and fblock elements": (12, 4, "TheDAndFBlockElements"),
    "the d- and f-block elements":             (12,  4, "TheDAndFBlockElements"),
    "thed-andf-blockelementsthed-andfblockelements":            (12, 4, "TheDAndFBlockElements"),
    "coordination compounds":                  (12,  5, "CoordinationCompounds"),
    "coordinationcompounds":                   (12,  5, "CoordinationCompounds"),
    "haloalkanes and haloarenes":              (12,  6, "HaloalkanesAndHaloarenes"),
    "haloalkanesandhaloarenes":               (12,  6, "HaloalkanesAndHaloarenes"),
    "alcohols, phenols phenols and ethers":   (12,  7, "AlcoholsPhenolsAndEthers"),
    "alcoholsphenolsandethers":               (12,  7, "AlcoholsPhenolsAndEthers"),
    "aldehydes, ketones and carboxylic acids": (12, 8, "AldehydesKetonesAndCarboxylicAcids"),
    "aldehydesketonesandcarboxylicacids":      (12,  8, "AldehydesKetonesAndCarboxylicAcids"),
    "amines":                                  (12,  9, "Amines"),
    "biomolecules":                            (12, 10, "Biomolecules"),
}

# Files to skip entirely (appendix/answer/reference material)
# NOTE: Be specific — avoid words that appear in real chapter names
SKIP_KEYWORDS = ["answer to ", "appendix", "answers to some", "answer to some",
                 "definitions of the si", "atomic number and molar",
                 "selected problems"]


def normalize(stem: str) -> str:
    """Lowercase + strip spaces for fuzzy matching."""
    return stem.lower().strip()


def lookup(stem: str, mapping: dict):
    """Try exact match, then stripped-of-spaces match."""
    key = normalize(stem)
    if key in mapping:
        return mapping[key]
    key_nospace = re.sub(r'\s+', '', key)
    for k, v in mapping.items():
        if re.sub(r'\s+', '', k) == key_nospace:
            return v
    return None


def should_skip(stem: str) -> bool:
    low = stem.lower()
    return any(kw in low for kw in SKIP_KEYWORDS)


def already_standard(stem: str) -> bool:
    return bool(re.match(r"^Class(11|12)_Ch\d+_.+$", stem))


def process_subject(folder: Path, mapping: dict, dry_run: bool):
    subject = folder.name
    renamed = skipped = already = unknown = 0

    for pdf in sorted(folder.glob("*.pdf")):
        stem = pdf.stem

        if should_skip(stem):
            print(f"  [SKIP-JUNK]  {pdf.name}")
            skipped += 1
            continue

        if already_standard(stem):
            print(f"  [OK]         {pdf.name}")
            already += 1
            continue

        result = lookup(stem, mapping)
        if result is None:
            print(f"  [UNKNOWN]    {pdf.name}  <- add to map manually")
            unknown += 1
            continue

        cls, ch, ch_name = result
        new_name = f"Class{cls:02d}_Ch{ch:02d}_{ch_name}.pdf"
        new_path = pdf.parent / new_name

        if new_path.exists() and new_path != pdf:
            print(f"  [CONFLICT]   {pdf.name} → {new_name} (target exists, skipping)")
            skipped += 1
            continue

        print(f"  [RENAME]     {pdf.name}")
        print(f"               -> {new_name}")
        if not dry_run:
            pdf.rename(new_path)
        renamed += 1

    print(f"\n  {subject}: {renamed} renamed, {already} already OK, {skipped} skipped, {unknown} unknown\n")
    return unknown


def main():
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("=== DRY RUN — no files will be changed ===\n")

    root = Path(__file__).parent.parent / "data" / "ncert"

    total_unknown = 0
    for subject, mapping in [("Physics", PHYSICS_MAP), ("Chemistry", CHEMISTRY_MAP)]:
        folder = root / subject
        if not folder.exists():
            print(f"[WARN] {folder} not found, skipping.")
            continue
        print(f"{'='*60}")
        print(f"  {subject}")
        print(f"{'='*60}")
        total_unknown += process_subject(folder, mapping, dry_run)

    if total_unknown:
        print(f"\nWARN: {total_unknown} files could not be mapped -- add them to the script's map manually.")
    else:
        print("\nDONE: All files handled! You can now run:  python ingest_batch_ncert.py")


if __name__ == "__main__":
    main()
