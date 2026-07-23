"""
query.py — CLI entry point for asking a single question against the RAG pipeline.

Usage:
    python query.py "What is the function of mitochondria?"
    python query.py "What is the function of mitochondria?" --top-k 3
    python query.py "What is the function of mitochondria?" --threshold 0.3

Output:
    - Retrieved chunks (topic, similarity score, content snippet)
    - Final answer
    - Whether the fallback tag was applied
"""

import argparse
import logging
import sys

# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError for box-drawing chars)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

logging.basicConfig(
    level=logging.WARNING,   # quiet in query mode — just show the results
    format="%(levelname)s  %(message)s",
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ask a question against the ingested NCERT chapter."
    )
    parser.add_argument(
        "question",
        help="The question to ask.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=None,
        metavar="K",
        help="Number of chunks to retrieve (default from config).",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        metavar="T",
        help="Minimum similarity threshold 0–1 (default from config).",
    )
    args = parser.parse_args()

    from src.config import DEFAULT_TOP_K, DEFAULT_SIMILARITY_THRESHOLD
    from src.retriever import answer, FALLBACK_TAG

    top_k = args.top_k if args.top_k is not None else DEFAULT_TOP_K
    threshold = args.threshold if args.threshold is not None else DEFAULT_SIMILARITY_THRESHOLD

    print()
    print("=" * 70)
    print(f"  QUESTION: {args.question}")
    print("=" * 70)

    try:
        result = answer(args.question, top_k=top_k, threshold=threshold)
    except Exception as exc:
        print(f"\nERROR: {exc}")
        sys.exit(1)

    # ── Print retrieved chunks ─────────────────────────────────────────────────
    print(f"\n── Retrieved chunks ({len(result.chunks)}) ──")
    if result.chunks:
        for i, chunk in enumerate(result.chunks, 1):
            topic = chunk.metadata.get("topic", "—")
            chapter = chunk.metadata.get("chapter", "—")
            snippet = chunk.content[:200].replace("\n", " ")
            print(
                f"\n  [{i}] similarity={chunk.similarity:.3f} | "
                f"chapter: {chapter} | topic: {topic}"
            )
            print(f"      {snippet}{'…' if len(chunk.content) > 200 else ''}")
    else:
        print("  (No chunks retrieved above the similarity threshold)")

    # ── Print answer ──────────────────────────────────────────────────────────
    print("\n── Answer ──")
    print()
    print(result.answer)

    # ── Print fallback status ─────────────────────────────────────────────────
    print()
    if result.fallback_applied:
        print(f"  ⚠  FALLBACK APPLIED — answer drawn from general knowledge.")
        print(f"     Tag: {FALLBACK_TAG}")
    else:
        print("  ✓  Answer grounded in NCERT context (no fallback tag).")
    print("=" * 70)


if __name__ == "__main__":
    main()
