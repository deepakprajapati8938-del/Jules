import os
import base64
from dotenv import load_dotenv

load_dotenv("backend/.env")

from src.retriever import answer

try:
    with open("frontend/public/pwa-192x192.png", "rb") as f:
        img_data = base64.b64encode(f.read()).decode("utf-8")
except Exception as e:
    print(e)
    img_data = ""

print("Testing answer function with image...")
try:
    res = answer("Answer dude", attachment_data=img_data, attachment_mime_type="image/png")
    print(res)
    print("SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
    print("FAILED")
