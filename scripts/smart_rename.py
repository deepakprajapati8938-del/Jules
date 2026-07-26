import os
import sys
from pathlib import Path
import fitz  # PyMuPDF
import json

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.llm_wrapper import call_llm

CHAPTER_KEYS = {
    "Physics": [
        "Class11_Ch01_UnitsAndMeasurements", "Class11_Ch02_MotionInAStraightLine", "Class11_Ch03_MotionInAPlane", "Class11_Ch04_LawsOfMotion", "Class11_Ch05_WorkEnergyAndPower", "Class11_Ch06_SystemOfParticlesAndRotationalMotion", "Class11_Ch07_Gravitation", "Class11_Ch08_MechanicalPropertiesOfSolids", "Class11_Ch09_MechanicalPropertiesOfFluids", "Class11_Ch10_ThermalPropertiesOfMatter", "Class11_Ch11_Thermodynamics", "Class11_Ch12_KineticTheory", "Class11_Ch13_Oscillations", "Class11_Ch14_Waves",
        "Class12_Ch01_ElectricChargesAndFields", "Class12_Ch02_ElectrostaticPotentialAndCapacitance", "Class12_Ch03_CurrentElectricity", "Class12_Ch04_MovingChargesAndMagnetism", "Class12_Ch05_MagnetismAndMatter", "Class12_Ch06_ElectromagneticInduction", "Class12_Ch07_AlternatingCurrent", "Class12_Ch08_ElectromagneticWaves", "Class12_Ch09_RayOpticsAndOpticalInstruments", "Class12_Ch10_WaveOptics", "Class12_Ch11_DualNatureOfRadiationAndMatter", "Class12_Ch12_Atoms", "Class12_Ch13_Nuclei", "Class12_Ch14_SemiconductorElectronics"
    ],
    "Chemistry": [
        "Class11_Ch01_SomeBasicConceptsOfChemistry", "Class11_Ch02_StructureOfAtom", "Class11_Ch03_ClassificationOfElementsAndPeriodicity", "Class11_Ch04_ChemicalBondingAndMolecularStructure", "Class11_Ch05_Thermodynamics", "Class11_Ch06_Equilibrium", "Class11_Ch07_RedoxReactions", "Class11_Ch08_OrganicChemistrySomeBasicPrinciples", "Class11_Ch09_Hydrocarbons",
        "Class12_Ch01_Solutions", "Class12_Ch02_Electrochemistry", "Class12_Ch03_ChemicalKinetics", "Class12_Ch04_TheDAndFBlockElements", "Class12_Ch05_CoordinationCompounds", "Class12_Ch06_HaloalkanesAndHaloarenes", "Class12_Ch07_AlcoholsPhenolsAndEthers", "Class12_Ch08_AldehydesKetonesAndCarboxylicAcids", "Class12_Ch09_Amines", "Class12_Ch10_Biomolecules"
    ]
}

def extract_text(pdf_path):
    doc = fitz.open(pdf_path)
    text = ""
    for i in range(min(2, len(doc))):
        text += doc[i].get_text() + "\n"
    return text

def get_real_name(text, subject):
    prompt = f"""
You are an expert at identifying NCERT chapters from their text.
Identify the correct chapter from the provided PDF text.
The subject is {subject}.

Here are the possible chapter keys:
{json.dumps(CHAPTER_KEYS[subject], indent=2)}

Rules:
- Read the chapter title, unit number, or contents from the text carefully.
- Return ONLY the EXACT string of the matching chapter key. 
- Do not output anything else. 
- If the text looks like an index, answers, or syllabus (not a main chapter), reply with "IGNORE".
"""
    try:
        resp = call_llm(system_prompt=prompt, user_prompt=f"TEXT:\n\n{text[:3000]}", model_name="llama-3.1-8b-instant")
        return resp.strip().replace("`", "").replace('"', '').strip()
    except Exception as e:
        print(f"LLM Error: {e}")
        return None

def smart_rename():
    base_dir = Path("data/ncert")
    for subject in ["Physics", "Chemistry"]:
        subj_dir = base_dir / subject
        if not subj_dir.exists():
            continue
            
        print(f"\n--- Processing {subject} ---")
        for pdf_path in list(subj_dir.glob("*.pdf")):
            if "IGNORE" in pdf_path.name or "a1" in pdf_path.name or "an" in pdf_path.name or "ps" in pdf_path.name:
                continue
            
            # Print without newline to show progress
            print(f"Reading {pdf_path.name}... ", end="", flush=True)
            text = extract_text(pdf_path)
            if not text.strip():
                print("Skipped (Empty PDF)")
                continue
            
            new_key = get_real_name(text, subject)
            if new_key and new_key != "IGNORE" and new_key in CHAPTER_KEYS[subject]:
                new_name = new_key + ".pdf"
                new_path = pdf_path.with_name(new_name)
                if new_path != pdf_path:
                    try:
                        if new_path.exists():
                            new_path.unlink() # remove if exists
                        pdf_path.rename(new_path)
                        print(f"Renamed -> {new_name}")
                    except Exception as e:
                        print(f"Error renaming: {e}")
                else:
                    print(f"Already correctly named -> {new_name}")
            else:
                print(f"Skipped (Response: {new_key})")

if __name__ == "__main__":
    smart_rename()
