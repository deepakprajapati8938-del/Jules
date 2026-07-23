import sys
import logging
import time
from pathlib import Path
import fitz

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.embedder import _get_gemini
from src.config import GEMINI_TEXT_MODEL

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def rename_ncert_pdfs():
    client = _get_gemini()
    ncert_dir = Path("data/ncert")
    
    # Prompt for NCERT
    prompt = """
    You are an expert at identifying NCERT textbook chapters. 
    I will give you the first page text of a PDF chapter and its current filename.
    Your job is to identify the Subject, Class (11 or 12), Chapter Number, and Chapter Name.
    Then, output exactly the new filename in this format:
    Class{{11|12}}_Ch{{NN}}_{{ChapterNameNoSpaces}}.pdf
    
    Examples:
    Class11_Ch01_TheLivingWorld.pdf
    Class12_Ch05_MolecularBasisOfInheritance.pdf
    
    Rules:
    1. Output ONLY the new filename. No extra text, no markdown blocks.
    2. Chapter number should be padded to 2 digits (01, 02). Note that Book 2 chapters might be numbered continuously (e.g. 08, 09) in the book even if it's the first chapter of Book 2. Use the actual chapter number from the text if present.
    3. If it's not a valid chapter (e.g. preliminary pages, answers, syllabus), output SKIP.
    
    Current Filename: {filename}
    First Page Text:
    {text}
    """
    
    for pdf_path in ncert_dir.rglob("*.pdf"):
        # Skip if already perfectly renamed
        if pdf_path.name.startswith("Class") and "UnknownChapter" not in pdf_path.name:
            continue
            
        try:
            doc = fitz.open(pdf_path)
            # Try to get enough text from the first 3 pages
            text = ""
            for i in range(min(3, len(doc))):
                text += doc[i].get_text() + "\n"
            doc.close()
                
            res = client.models.generate_content(
                model=GEMINI_TEXT_MODEL,
                contents=prompt.format(filename=pdf_path.name, text=text[:2000])
            )
            new_name = res.text.strip()
            
            if new_name == "SKIP":
                logger.warning(f"Skipping {pdf_path.name} (identified as non-chapter)")
                continue
                
            if new_name.endswith(".pdf"):
                new_path = pdf_path.with_name(new_name)
                pdf_path.rename(new_path)
                logger.info(f"Renamed: {pdf_path.name} -> {new_name}")
            else:
                logger.error(f"Failed to parse AI output for {pdf_path.name}: {new_name}")
                
            time.sleep(15) # rate limit protection
        except Exception as e:
            logger.error(f"Error on {pdf_path.name}: {e}")

def rename_pyq_pdfs():
    client = _get_gemini()
    pyq_dir = Path("data/pyq")
    
    prompt = """
    You are an expert at identifying NEET previous year question papers.
    I will give you the first page text of a PDF.
    Your job is to identify the Year and Subject (Physics, Chemistry, or Biology).
    Then, output exactly the new filename in this format:
    {{Year}}_{{Subject}}.pdf
    
    Examples:
    2023_Physics.pdf
    2021_Biology.pdf
    
    Rules:
    1. Output ONLY the new filename. No extra text.
    2. If you cannot determine the year or subject, output SKIP.
    
    First Page Text:
    {text}
    """
    
    for pdf_path in pyq_dir.rglob("*.pdf"):
        if "_" in pdf_path.stem and not pdf_path.stem.startswith("Paper_") and "UnknownSubject" not in pdf_path.name:
            # Already perfectly renamed
            continue
            
        try:
            doc = fitz.open(pdf_path)
            text = ""
            for i in range(min(3, len(doc))):
                text += doc[i].get_text() + "\n"
            doc.close()
                
            if not text.strip():
                # Might be a scanned PDF, let's just guess from filename date if possible, but let's send empty text and let AI try or fail.
                pass
                
            res = client.models.generate_content(
                model=GEMINI_TEXT_MODEL,
                contents=prompt.format(text=text[:2000])
            )
            new_name = res.text.strip()
            
            if new_name == "SKIP":
                logger.warning(f"Skipping {pdf_path.name} (could not determine)")
                continue
                
            if new_name.endswith(".pdf"):
                new_path = pdf_path.with_name(new_name)
                pdf_path.rename(new_path)
                logger.info(f"Renamed: {pdf_path.name} -> {new_name}")
            else:
                logger.error(f"Failed to parse AI output for {pdf_path.name}: {new_name}")
                
            time.sleep(2)
        except Exception as e:
            logger.error(f"Error on {pdf_path.name}: {e}")

if __name__ == "__main__":
    logger.info("Starting AI-powered file renaming...")
    rename_ncert_pdfs()
    rename_pyq_pdfs()
    logger.info("Renaming complete!")
