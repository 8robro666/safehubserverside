import threading
import subprocess
import os

def start_api():
    port = os.getenv("PORT", "8000")
    subprocess.run([
        "uvicorn",
        "api:app",
        "--host",
        "0.0.0.0",
        "--port",
        port
    ])

threading.Thread(target=start_api, daemon=True).start()

import bot