"""
Phase 3 Diagram Extraction, Captioning, and Linking.
Extracts images from NCERT PDFs, captions them with Gemini Vision, links to headings,
and stores in the 'diagrams' table in Supabase.
"""

import sys
import logging
import re
import time
from pathlib import Path

import fitz  # PyMuPDF
import pymupdf4llm

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import _get_supabase, GEMINI_TEXT_MODEL
from src.embedder import _get_gemini
from ingest_batch_ncert import parse_filename

logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(levelname)-8s  %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger(__name__)

# Minimum size for an image to be considered a diagram (in pixels)
MIN_IMG_WIDTH = 50
MIN_IMG_HEIGHT = 50

def extract_images_from_pdf(pdf_path: Path, subject: str, chapter: str):
    """
    Extracts images from PDF. Returns a list of image dicts:
    [{'path': Path, 'page': int, 'rect': tuple, 'index': int}, ...]
    """
    doc = fitz.open(str(pdf_path))
    out_dir = Path("output") / "ncert_images" / subject / chapter
    out_dir.mkdir(parents=True, exist_ok=True)
    
    extracted_images = []
    skipped_trivial = 0
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # get_images() returns a list of items like (xref, smask, width, height, bpc, colorspace, alt. colorspace, name, filter, referencer)
        images = page.get_images(full=True)
        
        for img_idx, img_info in enumerate(images):
            xref = img_info[0]
            
            # Extract image bytes
            try:
                base_image = doc.extract_image(xref)
            except Exception as e:
                logger.warning(f"Could not extract image xref {xref} on page {page_num}: {e}")
                continue
                
            image_bytes = base_image["image"]
            ext = base_image["ext"]
            width = base_image["width"]
            height = base_image["height"]
            
            # Trivial filter
            if width < MIN_IMG_WIDTH or height < MIN_IMG_HEIGHT:
                skipped_trivial += 1
                continue
                
            # Prefer PNG if the native extraction wasn't PNG, but if it fails fallback to original
            # fitz.Pixmap can convert to png safely.
            try:
                pix = fitz.Pixmap(doc, xref)
                # If colorspace is not gray or rgb, convert it
                if pix.n - pix.alpha >= 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                image_bytes = pix.tobytes("png")
                ext = "png"
                pix = None
            except Exception as e:
                # Fallback to original bytes and extension
                logger.debug(f"PNG conversion failed, falling back to {ext}: {e}")
            
            img_filename = f"page{page_num}_img{img_idx}.{ext}"
            img_path = out_dir / img_filename
            
            if not img_path.exists():
                img_path.write_bytes(image_bytes)
            
            # Get bounding box. get_image_rects returns a list of rects, we take the first
            rects = page.get_image_rects(xref)
            rect = rects[0] if rects else None
            
            extracted_images.append({
                "path": str(img_path),
                "page": page_num,
                "rect": (rect.x0, rect.y0, rect.x1, rect.y1) if rect else (0,0,0,0),
                "index": img_idx,
                "bytes": image_bytes,
                "mime_type": "image/png" if ext == "png" else f"image/{ext}"
            })
            
    return extracted_images, skipped_trivial

def caption_image(image_bytes, mime_type, subject, chapter):
    """
    Calls Gemini Vision to generate a caption.
    Implements rate limit backoff.
    """
    client = _get_gemini()
    prompt = f"This is a diagram from an NCERT {subject} textbook, chapter '{chapter}'. Describe what this diagram shows in 1-3 sentences, suitable as a caption for a student studying this chapter. If the image is not a meaningful diagram (e.g. a decorative element, a blank page fragment, or unreadable), respond with exactly: NOT_A_DIAGRAM"
    
    max_retries = 5
    base_delay = 5
    
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=GEMINI_TEXT_MODEL, # gemini-2.5-flash is multimodal
                contents=[
                    {"mime_type": mime_type, "data": image_bytes},
                    prompt
                ]
            )
            return response.text.strip()
        except Exception as e:
            if "429" in str(e) or "Quota" in str(e):
                delay = base_delay * (2 ** attempt)
                logger.warning(f"Rate limited. Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                logger.error(f"Gemini Vision failed: {e}")
                return "NOT_A_DIAGRAM"
                
    logger.error("Max retries exceeded for Vision API.")
    return "NOT_A_DIAGRAM"

def extract_headings_from_pdf(pdf_path: Path):
    """
    Uses pymupdf4llm page_chunks to find which headings occur on which pages.
    Returns a list of headings: [{'title': str, 'page': int}, ...]
    """
    try:
        page_chunks = pymupdf4llm.to_markdown(str(pdf_path), page_chunks=True)
    except Exception as e:
        logger.error(f"Failed to generate page chunks: {e}")
        return []
        
    headings = []
    # Regex to find headings (e.g., "## 5.1 DNA", "### Topic")
    heading_re = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
    
    for page_dict in page_chunks:
        # metadata contains 'page' (1-indexed usually, but let's check)
        # However, page_chunks are strictly ordered. We'll rely on the list index.
        p_idx = page_dict.get("metadata", {}).get("page", 1) - 1 # 0-indexed
        
        text = page_dict.get("text", "")
        for match in heading_re.finditer(text):
            title = match.group(2).strip()
            # Simplistic vertical position estimate: index of match in text
            pos = match.start() 
            headings.append({
                "title": title,
                "page": p_idx,
                "text_pos": pos
            })
            
    return headings

def link_images_to_headings(images, headings):
    """
    Links each image to the closest preceding heading.
    """
    for img in images:
        img_page = img["page"]
        
        # Candidates on or before this page
        valid_headings = [h for h in headings if h["page"] <= img_page]
        
        if not valid_headings:
            img["linked_topic"] = "Introduction"
            img["confidence"] = "low"
            img["candidates"] = []
            continue
            
        # The most recent heading overall (last in the valid list)
        best_heading = valid_headings[-1]["title"]
        
        # Check if this page has multiple headings and multiple images
        headings_on_this_page = [h for h in headings if h["page"] == img_page]
        images_on_this_page = [i for i in images if i["page"] == img_page]
        
        if len(headings_on_this_page) > 1 and len(images_on_this_page) > 1:
            img["confidence"] = "low"
            img["candidates"] = [h["title"] for h in headings_on_this_page]
            # Advanced heuristic: we could sort by Y-coordinate vs text position,
            # but for now, we just pick the last heading on this page before the image index,
            # or simply the last valid heading overall and mark as low confidence.
        else:
            img["confidence"] = "high"
            img["candidates"] = []
            
        img["linked_topic"] = best_heading
        
    return images

def main():
    data_dir = Path("data/ncert")
    if not data_dir.exists():
        logger.error(f"Directory {data_dir} does not exist.")
        sys.exit(1)
        
    pdf_files = list(data_dir.rglob("*.pdf"))
    if not pdf_files:
        logger.warning(f"No PDFs found in {data_dir}")
        sys.exit(0)
        
    client = _get_supabase()
    all_low_confidence = []
    
    for pdf_path in pdf_files:
        subject, chapter = parse_filename(pdf_path)
        if not subject or not chapter:
            continue
            
        logger.info(f"--- Processing Diagrams for: {chapter} ({subject}) ---")
        
        # 1. Extract Images
        extracted_images, skipped_t = extract_images_from_pdf(pdf_path, subject, chapter)
        logger.info(f"Extracted {len(extracted_images)} potential diagrams. Skipped {skipped_t} trivial images.")
        
        if not extracted_images:
            continue
            
        # 2. Extract Headings for Linking
        headings = extract_headings_from_pdf(pdf_path)
        
        # 3. Captioning & Filtering
        valid_diagrams = []
        discarded = 0
        
        for i, img in enumerate(extracted_images):
            # Print progress
            if i > 0 and i % 20 == 0:
                logger.info(f"Captioned {i}/{len(extracted_images)} images...")
                
            caption = caption_image(img["bytes"], img["mime_type"], subject, chapter)
            
            if caption == "NOT_A_DIAGRAM":
                discarded += 1
            else:
                img["caption"] = caption
                valid_diagrams.append(img)
                
            # Sleep slightly to avoid spamming the free tier API too fast (15 RPM limit means 1 every 4 sec)
            time.sleep(3)
            
        logger.info(f"Kept {len(valid_diagrams)} diagrams. Discarded {discarded} as NOT_A_DIAGRAM.")
        
        if not valid_diagrams:
            continue
            
        # 4. Linking
        valid_diagrams = link_images_to_headings(valid_diagrams, headings)
        
        # 5. Storage
        inserted = 0
        for img in valid_diagrams:
            if img["confidence"] == "low":
                all_low_confidence.append({
                    "chapter": chapter,
                    "page": img["page"],
                    "path": img["path"],
                    "linked_topic": img["linked_topic"],
                    "candidates": img["candidates"]
                })
                
            row = {
                "image_path": img["path"],
                "caption": img["caption"],
                "subject": subject,
                "chapter": chapter,
                "linked_topic": img["linked_topic"],
                "confidence": img["confidence"],
                "page_number": img["page"]
            }
            
            try:
                # Insert safely. Constraint unique_image_path handles reruns.
                # However, postgrest-py doesn't have an ON CONFLICT DO NOTHING natively in insert() without upsert.
                # Since we don't have ID, we'll try/except.
                client.table("diagrams").insert(row).execute()
                inserted += 1
            except Exception as e:
                # Likely a unique constraint violation if rerun
                pass 
                
        logger.info(f"Stored {inserted} new diagrams in DB for {chapter}.")

    # Summary
    if all_low_confidence:
        logger.info("=" * 60)
        logger.warning(f"LOW CONFIDENCE LINKS REVIEW LIST ({len(all_low_confidence)})")
        logger.info("=" * 60)
        for lc in all_low_confidence:
            logger.warning(f"Chapter: {lc['chapter']} | Page: {lc['page']} | Path: {lc['path']}")
            logger.warning(f"  Best Guess: {lc['linked_topic']}")
            logger.warning(f"  Candidates: {lc['candidates']}")
            logger.warning("-" * 30)

if __name__ == "__main__":
    main()
