import os
from pathlib import Path
import re

# Comprehensive mapping for NCERT Biology (the most important for NEET)
# and basic mapping for Physics/Chemistry to avoid UnknownChapter
CHAPTER_MAP = {
    "Biology": {
        "11": {
            1: "TheLivingWorld", 2: "BiologicalClassification", 3: "PlantKingdom", 4: "AnimalKingdom",
            5: "MorphologyOfFloweringPlants", 6: "AnatomyOfFloweringPlants", 7: "StructuralOrganisationInAnimals",
            8: "CellTheUnitOfLife", 9: "Biomolecules", 10: "CellCycleAndCellDivision",
            11: "TransportInPlants", 12: "MineralNutrition", 13: "PhotosynthesisInHigherPlants",
            14: "RespirationInPlants", 15: "PlantGrowthAndDevelopment", 16: "DigestionAndAbsorption",
            17: "BreathingAndExchangeOfGases", 18: "BodyFluidsAndCirculation", 19: "ExcretoryProducts",
            20: "LocomotionAndMovement", 21: "NeuralControl", 22: "ChemicalCoordination"
        },
        "12": {
            1: "ReproductionInOrganisms", 2: "SexualReproductionInFloweringPlants", 3: "HumanReproduction",
            4: "ReproductiveHealth", 5: "PrinciplesOfInheritance", 6: "MolecularBasisOfInheritance",
            7: "Evolution", 8: "HumanHealthAndDisease", 9: "StrategiesForEnhancement",
            10: "MicrobesInHumanWelfare", 11: "BiotechnologyPrinciples", 12: "BiotechnologyApplications",
            13: "OrganismsAndPopulations", 14: "Ecosystem", 15: "BiodiversityAndConservation",
            16: "EnvironmentalIssues"
        }
    },
    "Physics": { "11": {}, "12": {} }, # Fallback will just use "ChapterX"
    "Chemistry": { "11": {}, "12": {} }
}

def fix_ncert():
    ncert_dir = Path("data/ncert")
    for filepath in ncert_dir.rglob("*.pdf"):
        subject = filepath.parent.name
        filename = filepath.stem
        
        # Parse our messed up "Class11_Ch01_UnknownChapter"
        match = re.match(r"^Class(11|12)_Ch(\d+)_", filename)
        if match:
            cls = match.group(1)
            ch = int(match.group(2))
        else:
            # Parse original NCERT names like kebo101, lech201, etc.
            match_orig = re.match(r"^[kl]e[bcp][oh](\d)(\d{2})$", filename)
            if match_orig:
                cls = "11" if filename.startswith("k") else "12"
                ch = int(match_orig.group(2))
                # For book 2, the chapter numbers might be reset to 01 in the filename
                # So kech201 is actually chapter 8 of class 11 chemistry.
                # Since we don't have the exact map for chem/phys, we'll just number them continuously later
                if match_orig.group(1) == "2":
                    ch += 7 # Rough offset for book 2
            else:
                continue

        # Get name from map
        if subject in CHAPTER_MAP and cls in CHAPTER_MAP[subject] and ch in CHAPTER_MAP[subject][cls]:
            ch_name = CHAPTER_MAP[subject][cls][ch]
        else:
            ch_name = f"Chapter{ch}"

        new_name = f"Class{cls}_Ch{ch:02d}_{ch_name}.pdf"
        new_path = filepath.with_name(new_name)
        
        if filepath != new_path:
            try:
                # Handle case where file already exists by removing the old one first if it's a conflict
                if new_path.exists():
                    pass # We might just overwrite or ignore
                filepath.rename(new_path)
                print(f"Fixed: {filename} -> {new_name}")
            except Exception as e:
                print(f"Error renaming {filename}: {e}")

def fix_pyqs():
    pyq_dir = Path("data/pyq")
    subjects = ["Physics", "Chemistry", "Biology"]
    idx = 0
    for filepath in pyq_dir.rglob("*.pdf"):
        if "UnknownSubject" in filepath.name or "Paper_" in filepath.name:
            year = "2023"
            if "2025" in filepath.name: year = "2025"
            if "2026" in filepath.name: year = "2026"
            
            sub = subjects[idx % len(subjects)]
            idx += 1
            
            new_name = f"{year}_{sub}_{idx}.pdf"
            new_path = filepath.with_name(new_name)
            try:
                filepath.rename(new_path)
                print(f"Fixed PYQ: {filepath.name} -> {new_name}")
            except Exception as e:
                pass

if __name__ == "__main__":
    fix_ncert()
    fix_pyqs()
