from fastapi import FastAPI
from pydantic import BaseModel
import json
import os
import datetime

app = FastAPI(title="Safe Hub API")

KEYS_FILE = "keys.json"


def load_keys():
    if not os.path.exists(KEYS_FILE):
        with open(KEYS_FILE, "w") as f:
            json.dump({}, f)
        return {}

    with open(KEYS_FILE, "r") as f:
        return json.load(f)


def save_keys(keys):
    with open(KEYS_FILE, "w") as f:
        json.dump(keys, f, indent=4)


class KeyRequest(BaseModel):
    key: str


@app.get("/")
def home():
    return {
        "status": "online",
        "service": "Safe Hub Key API"
    }


@app.post("/verify")
def verify_key(request: KeyRequest):
    keys = load_keys()

    if request.key not in keys:
        return {
            "valid": False,
            "reason": "Invalid key"
        }

    data = keys[request.key]

    if not data.get("active", False):
        return {
            "valid": False,
            "reason": "Key revoked"
        }

    expiry = datetime.datetime.fromisoformat(data["expires_at"])

    if expiry < datetime.datetime.now():
        return {
            "valid": False,
            "reason": "Key expired"
        }

    if data["uses"] >= data["max_uses"]:
        return {
            "valid": False,
            "reason": "Maximum uses reached"
        }

    data["uses"] += 1
    save_keys(keys)

    return {
        "valid": True,
        "expires": data["expires_at"],
        "uses": data["uses"],
        "max_uses": data["max_uses"]
    }


@app.post("/check")
def check_key(request: KeyRequest):
    keys = load_keys()

    if request.key not in keys:
        return {"exists": False}

    data = keys[request.key]

    expiry = datetime.datetime.fromisoformat(data["expires_at"])

    return {
        "exists": True,
        "active": data["active"],
        "expired": expiry < datetime.datetime.now(),
        "uses": data["uses"],
        "max_uses": data["max_uses"]
    }