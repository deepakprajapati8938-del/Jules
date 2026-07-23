"""
ingest.py — CLI entry point for the NEET Phase 1 ingestion pipeline.

Usage:
    python ingest.py --pdf path/to/chapter.pdf --subject Biology
    python ingest.py --pdf path/to/chapter.pdf --subject Biology --chapter "Cell: The Unit of Life"
    python ingest.py --pdf path/to/chapter.pdf --subject Biology --clear

Steps executed:
    1. Input check (text-based vs scanned)
    2. PDF → Markdown (writes output/<name>.md for inspection)
    3. Chunking along heading boundaries
    4. Metadata tagging
    5. Embed + store in Supabase pgvector

The script PAUSES after Step 2 and asks you to inspect the Markdown file
before continuing to embed and store — because embedding costs tokens and
the Markdown quality directly affects retrieval quality.
"""

import argparse
import logging
import sys

# Configure logging before any local imports so config.py output is captured
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest one NCERT chapter PDF into the NEET RAG pipeline."
    )
    parser.add_argument(
        "--pdf",
        required=True,
        metavar="PATH",
        help="Path to the NCERT chapter PDF file.",
    )
    parser.add_argument(
        "--subject",
        required=True,
        metavar="SUBJECT",
        help="Subject label, e.g. Biology, Physics, Chemistry.",
    )
    parser.add_argument(
        "--chapter",
        default=None,
        metavar="NAME",
        help=(
            "Override the chapter name (default: extracted from the # heading "
            "in the Markdown)."
        ),
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help=(
            "Delete existing rows for this chapter before ingesting, to avoid "
            "duplicate chunks on re-run."
        ),
    )
    parser.add_argument(
        "--skip-confirm",
        action="store_true",
        help="Skip the interactive Markdown inspection pause (useful for CI).",
    )
    args = parser.parse_args()

    # ── Step 1 & 2: PDF → Markdown ────────────────────────────────────────────
    from src.pdf_to_markdown import pdf_to_markdown
    try:
        md_text, md_path = pdf_to_markdown(args.pdf)
    except (FileNotFoundError, RuntimeError) as exc:
        logger.error(f"PDF conversion failed: {exc}")
        sys.exit(1)

    print()
    print("=" * 60)
    print(f"  Markdown written to: {md_path}")
    print("=" * 60)

    if not args.skip_confirm:
        print()
        print("Please open and inspect the Markdown file to verify:")
        print("  • Heading hierarchy looks correct (# → ## → ###)")
        print("  • Content appears complete and readable")
        print()
        response = input("Continue with chunking + embedding? [y/N] ").strip().lower()
        if response not in ("y", "yes"):
            print("Ingestion paused. Re-run with the same command to resume.")
            print("(Or fix the PDF extraction and re-run.)")
            sys.exit(0)

    # ── Step 3 & 4: Chunk + tag metadata ─────────────────────────────────────
    from src.chunker import chunk_markdown
    chunks = chunk_markdown(md_text, subject=args.subject, chapter_override=args.chapter)

    if not chunks:
        logger.error("No chunks produced. Check the Markdown output.")
        sys.exit(1)

    # ── Optionally clear existing rows ────────────────────────────────────────
    if args.clear:
        from src.embedder import clear_chapter_chunks
        chapter_name = chunks[0]["metadata"]["chapter"]
        logger.info(f"--clear flag set: removing existing rows for '{chapter_name}' …")
        clear_chapter_chunks(chapter_name)

    # ── Step 5: Embed + store ─────────────────────────────────────────────────
    from src.embedder import embed_and_store
    try:
        inserted = embed_and_store(chunks)
    except Exception as exc:
        logger.error(f"Embedding/storage failed: {exc}")
        sys.exit(1)

    print()
    print("=" * 60)
    print(f"  ✓  Ingestion complete.")
    print(f"     Chunks embedded and stored: {inserted}")
    print(f"     Chapter: {chunks[0]['metadata']['chapter']}")
    print(f"     Subject: {chunks[0]['metadata']['subject']}")
    print()
    print("  Next steps:")
    print("    1. Fill in test_questions.json with 5–8 questions.")
    print("    2. Run:  python test_harness.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
