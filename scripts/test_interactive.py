import os
import sys

# Setup paths
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.retriever import _is_interactive_category, _generate_answer

question = "Can you show me a velocity-time graph for a particle moving with constant acceleration?"

print("Classifying question...")
is_interactive = _is_interactive_category(question)
print(f"is_interactive: {is_interactive}")

if is_interactive:
    print("Generating answer with interactive prompt...")
    raw_answer = _generate_answer(
        question=question,
        chunks=[],
        is_interactive=True
    )
    print("RAW ANSWER:")
    print(raw_answer)
else:
    print("Question was not classified as interactive.")
