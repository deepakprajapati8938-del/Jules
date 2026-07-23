"""
test_harness.py — Step 7 of the NEET RAG pipeline.

Runs a batch of test questions from test_questions.json, prints a structured
report for each, and summarises pass/fail counts at the end.

Usage:
    python test_harness.py
    python test_harness.py --questions path/to/other_questions.json
    python test_harness.py --top-k 3 --threshold 0.3

test_questions.json format:
    [
      {
        "question": "...",
        "expect_fallback": false,   // true = expect out-of-scope fallback
        "notes": "optional comment"
      },
      ...
    ]

Output per question:
    - Question text
    - Retrieved chunks (topic + similarity + snippet)
    - Final answer
    - PASS / FAIL: whether fallback_applied matches expect_fallback
    - Summary table at the end
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

logging.basicConfig(
    level=logging.WARNING,
    format="%(levelname)s  %(message)s",
)

_DEFAULT_QUESTIONS_FILE = Path(__file__).parent / "test_questions.json"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the test harness against the ingested NCERT chapter."
    )
    parser.add_argument(
        "--questions",
        default=str(_DEFAULT_QUESTIONS_FILE),
        metavar="PATH",
        help="Path to JSON file with test questions (default: test_questions.json).",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=None,
        metavar="K",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        metavar="T",
    )
    args = parser.parse_args()

    # ── Load questions ─────────────────────────────────────────────────────────
    questions_path = Path(args.questions)
    if not questions_path.exists():
        print(f"ERROR: Questions file not found: {questions_path}")
        print("Create test_questions.json with your test questions and re-run.")
        sys.exit(1)

    with open(questions_path, encoding="utf-8") as f:
        questions = json.load(f)

    if not questions:
        print("No questions found in the file.")
        sys.exit(0)

    from src.config import DEFAULT_TOP_K, DEFAULT_SIMILARITY_THRESHOLD
    from src.retriever import answer, FALLBACK_TAG

    top_k = args.top_k if args.top_k is not None else DEFAULT_TOP_K
    threshold = args.threshold if args.threshold is not None else DEFAULT_SIMILARITY_THRESHOLD

    # ── Run each question ──────────────────────────────────────────────────────
    results = []
    total = len(questions)

    print()
    print("=" * 70)
    print(f"  NEET Phase 1 — Test Harness  ({total} questions)")
    print(f"  top_k={top_k}  threshold={threshold}")
    print("=" * 70)

    for idx, q_entry in enumerate(questions, 1):
        question = q_entry.get("question", "").strip()
        expect_fallback = bool(q_entry.get("expect_fallback", False))
        notes = q_entry.get("notes", "")

        if not question:
            print(f"\n[Q{idx}] SKIPPED (empty question)")
            continue

        print(f"\n{'─' * 70}")
        print(f"[Q{idx}/{total}] {question}")
        if notes:
            print(f"  Notes: {notes}")
        print(f"  Expect fallback: {'YES' if expect_fallback else 'NO'}")

        try:
            result = answer(question, top_k=top_k, threshold=threshold)
        except Exception as exc:
            print(f"  ERROR: {exc}")
            results.append({
                "question": question,
                "expect_fallback": expect_fallback,
                "actual_fallback": None,
                "passed": False,
                "error": str(exc),
            })
            continue

        # ── Print retrieved chunks ─────────────────────────────────────────────
        print(f"\n  Retrieved chunks ({len(result.chunks)}):")
        if result.chunks:
            for i, chunk in enumerate(result.chunks, 1):
                topic = chunk.metadata.get("topic", "—")
                snippet = chunk.content[:150].replace("\n", " ")
                print(
                    f"    [{i}] sim={chunk.similarity:.3f} | {topic}"
                )
                print(f"         {snippet}{'…' if len(chunk.content) > 150 else ''}")
        else:
            print("    (none above threshold)")

        # ── Print answer ───────────────────────────────────────────────────────
        print("\n  Answer:")
        # Indent the answer for readability in the report
        for line in result.answer.strip().splitlines():
            print(f"    {line}")

        # ── Evaluate pass/fail ─────────────────────────────────────────────────
        actual_fallback = result.fallback_applied
        passed = (actual_fallback == expect_fallback)
        verdict = "✓ PASS" if passed else "✗ FAIL"

        print()
        print(
            f"  Fallback applied: {'YES' if actual_fallback else 'NO'}  |  "
            f"Expected: {'YES' if expect_fallback else 'NO'}  |  {verdict}"
        )

        results.append({
            "question": question,
            "expect_fallback": expect_fallback,
            "actual_fallback": actual_fallback,
            "passed": passed,
            "error": None,
        })

        # Small delay between questions to stay within rate limits
        if idx < total:
            time.sleep(1.5)

    # ── Summary table ─────────────────────────────────────────────────────────
    passed_count = sum(1 for r in results if r.get("passed"))
    failed_count = len(results) - passed_count

    print(f"\n{'=' * 70}")
    print(f"  SUMMARY:  {passed_count} PASSED  |  {failed_count} FAILED  |  {len(results)} total")
    print(f"{'=' * 70}")
    print()
    print(f"  {'#':<4} {'Pass?':<8} {'Fallback?':<12} {'Question (truncated)'}")
    print(f"  {'─'*4} {'─'*8} {'─'*12} {'─'*40}")
    for i, r in enumerate(results, 1):
        status = "✓" if r["passed"] else "✗"
        fb = "YES" if r["actual_fallback"] else ("ERR" if r["actual_fallback"] is None else "NO")
        q_short = r["question"][:48] + ("…" if len(r["question"]) > 48 else "")
        print(f"  {i:<4} {status:<8} {fb:<12} {q_short}")
    print()

    if failed_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
