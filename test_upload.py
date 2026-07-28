import requests
import json
import base64

try:
    with open("frontend/public/pwa-192x192.png", "rb") as f:
        img_data = base64.b64encode(f.read()).decode("utf-8")
except Exception as e:
    print(e)
    img_data = ""

payload = {
    "question": "Answer dude",
    "attachment_data": img_data,
    "attachment_mime_type": "image/png"
}

print("Testing chat API...")
res = requests.post("http://127.0.0.1:8000/api/v1/chat", json=payload)
print(res.status_code)
print(res.text)
