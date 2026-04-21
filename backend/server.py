from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import tempfile
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.gzip import GZipMiddleware

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:  # pragma: no cover - optional dependency
    AsyncIOMotorClient = None

try:
    from emergentintegrations.llm.chat import FileContentWithMimeType, LlmChat, UserMessage
except ImportError:  # pragma: no cover - optional dependency
    FileContentWithMimeType = None
    LlmChat = None
    UserMessage = None


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
AI_TIMEOUT_SECONDS = float(os.environ.get("AI_TIMEOUT_SECONDS", "4"))
CLAUDE_MODEL = ("anthropic", "claude-sonnet-4-5-20250929")

mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME")
mongo_client = AsyncIOMotorClient(mongo_url) if AsyncIOMotorClient and mongo_url and db_name else None
db = mongo_client[db_name] if mongo_client and db_name else None

memory_store: Dict[str, Any] = {
    "status_checks": [],
    "crop_recommendations": [],
    "disease_reports": [],
    "chat_messages": defaultdict(list),
}

app = FastAPI(title="Smart Crop Advisory API")
api_router = APIRouter(prefix="/api")


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class CropRecommendRequest(BaseModel):
    soil_type: str
    season: str
    region: str
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    ph: Optional[float] = None
    rainfall_mm: Optional[float] = None


class CropSuggestion(BaseModel):
    crop: str
    suitability: str
    yield_estimate: str
    water_requirement: str
    reason: str


class CropRecommendResponse(BaseModel):
    id: str
    recommendations: List[CropSuggestion]
    fertilizer_tips: List[str]
    general_advice: str


class DiseaseDetectRequest(BaseModel):
    image_base64: str
    crop_hint: Optional[str] = None


class DiseaseDetectResponse(BaseModel):
    id: str
    disease: str
    confidence: str
    severity: str
    symptoms: List[str]
    treatment: List[str]
    prevention: List[str]
    organic_remedy: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str


class MarketPrice(BaseModel):
    crop: str
    market: str
    state: str
    price_per_quintal: float
    unit: str = "INR/quintal"
    change_pct: float
    updated_at: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ai_enabled() -> bool:
    return bool(EMERGENT_LLM_KEY and LlmChat and UserMessage)


def extract_json(text: str) -> dict:
    if not text:
        return {}

    fenced_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    raw = fenced_match.group(1) if fenced_match else text
    if not fenced_match:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            raw = raw[start : end + 1]
    try:
        return json.loads(raw)
    except Exception as exc:  # pragma: no cover - logging branch
        logger.warning("Could not parse AI response as JSON: %s", exc)
        return {}


async def insert_document(collection: str, payload: dict) -> None:
    if db is not None:
        await db[collection].insert_one(payload)
        return

    if collection == "chat_messages":
        memory_store["chat_messages"][payload["session_id"]].append(payload)
        return

    memory_store[collection].append(payload)


async def list_documents(collection: str) -> List[dict]:
    if db is not None:
        return await db[collection].find({}, {"_id": 0}).to_list(1000)
    return list(memory_store[collection])


async def list_chat_messages(session_id: str) -> List[dict]:
    if db is not None:
        return (
            await db.chat_messages.find({"session_id": session_id}, {"_id": 0})
            .sort("timestamp", 1)
            .to_list(500)
        )
    return list(memory_store["chat_messages"][session_id])


async def claude_chat(session_id: str, system_message: str) -> Optional[Any]:
    if not ai_enabled():
        return None

    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model(*CLAUDE_MODEL)


CROP_LIBRARY = [
    {
        "crop": "Wheat",
        "soils": {"loamy", "alluvial", "clay"},
        "seasons": {"rabi", "winter"},
        "regions": {"punjab", "haryana", "uttar pradesh", "madhya pradesh", "rajasthan"},
        "rainfall": (350, 900),
        "ph": (6.0, 7.5),
        "yield_estimate": "38-52 q/ha",
        "water_requirement": "Moderate",
    },
    {
        "crop": "Rice",
        "soils": {"clay", "loamy", "alluvial"},
        "seasons": {"kharif", "monsoon"},
        "regions": {"punjab", "west bengal", "tamil nadu", "andhra pradesh", "karnataka"},
        "rainfall": (900, 1800),
        "ph": (5.0, 7.0),
        "yield_estimate": "45-65 q/ha",
        "water_requirement": "High",
    },
    {
        "crop": "Maize",
        "soils": {"loamy", "sandy", "black"},
        "seasons": {"kharif", "zaid", "summer"},
        "regions": {"karnataka", "bihar", "madhya pradesh", "uttar pradesh", "rajasthan"},
        "rainfall": (500, 900),
        "ph": (5.5, 7.5),
        "yield_estimate": "35-50 q/ha",
        "water_requirement": "Moderate",
    },
    {
        "crop": "Cotton",
        "soils": {"black", "alluvial", "red"},
        "seasons": {"kharif", "monsoon"},
        "regions": {"gujarat", "maharashtra", "madhya pradesh", "punjab"},
        "rainfall": (500, 1000),
        "ph": (5.8, 8.0),
        "yield_estimate": "18-28 q/ha",
        "water_requirement": "Moderate",
    },
    {
        "crop": "Soybean",
        "soils": {"black", "loamy"},
        "seasons": {"kharif", "monsoon"},
        "regions": {"madhya pradesh", "maharashtra", "rajasthan"},
        "rainfall": (600, 1000),
        "ph": (6.0, 7.5),
        "yield_estimate": "18-30 q/ha",
        "water_requirement": "Moderate",
    },
    {
        "crop": "Mustard",
        "soils": {"loamy", "alluvial", "sandy"},
        "seasons": {"rabi", "winter"},
        "regions": {"rajasthan", "haryana", "uttar pradesh", "madhya pradesh"},
        "rainfall": (200, 500),
        "ph": (6.0, 8.0),
        "yield_estimate": "12-20 q/ha",
        "water_requirement": "Low",
    },
]


DISEASE_LIBRARY = {
    "tomato": {
        "disease": "Early blight",
        "confidence": "Medium",
        "severity": "Moderate",
        "symptoms": [
            "Brown concentric rings on older leaves",
            "Yellowing around spots and gradual leaf drying",
        ],
        "treatment": [
            "Remove heavily infected leaves from the field",
            "Improve spacing and air circulation to reduce humidity",
            "Use a suitable fungicide as per local agronomy guidance",
        ],
        "prevention": [
            "Avoid overhead irrigation late in the day",
            "Rotate with non-solanaceous crops",
        ],
        "organic_remedy": "Spray neem-based formulation and maintain field sanitation.",
    },
    "rice": {
        "disease": "Leaf blast",
        "confidence": "Medium",
        "severity": "Moderate",
        "symptoms": [
            "Spindle-shaped lesions with gray center",
            "Leaf tips drying in patches",
        ],
        "treatment": [
            "Avoid excess nitrogen in top dressing",
            "Use a recommended fungicide if spread is increasing",
            "Keep water management stable during active infection",
        ],
        "prevention": [
            "Use resistant varieties where available",
            "Split nitrogen applications instead of one heavy dose",
        ],
        "organic_remedy": "Use compost tea or biofungicide approved for blast suppression.",
    },
    "wheat": {
        "disease": "Leaf rust",
        "confidence": "Medium",
        "severity": "Mild",
        "symptoms": [
            "Orange-brown powdery pustules on leaves",
            "Reduced green leaf area and premature drying",
        ],
        "treatment": [
            "Monitor spread across upper canopy leaves",
            "Apply a suitable fungicide if infection reaches economic threshold",
        ],
        "prevention": [
            "Prefer rust-tolerant varieties",
            "Avoid late sowing where rust pressure is common",
        ],
        "organic_remedy": "Seaweed extract can support plant recovery, but sanitation remains essential.",
    },
    "default": {
        "disease": "Possible fungal leaf spot",
        "confidence": "Low",
        "severity": "Mild",
        "symptoms": [
            "Visible spotting or discoloration on the leaf surface",
            "Localized tissue damage near affected patches",
        ],
        "treatment": [
            "Separate affected plants if practical",
            "Avoid wetting leaves during irrigation",
            "Consult a local agri expert before using a chemical treatment",
        ],
        "prevention": [
            "Use clean tools and remove infected debris",
            "Maintain balanced nutrition and airflow around plants",
        ],
        "organic_remedy": "Use neem oil or a copper-based organic spray if suitable for the crop.",
    },
}


DEFAULT_MARKET = [
    {"crop": "Wheat", "market": "Ludhiana", "state": "Punjab", "price_per_quintal": 2350, "change_pct": 1.2},
    {"crop": "Rice (Basmati)", "market": "Karnal", "state": "Haryana", "price_per_quintal": 4120, "change_pct": -0.8},
    {"crop": "Maize", "market": "Davangere", "state": "Karnataka", "price_per_quintal": 2080, "change_pct": 2.5},
    {"crop": "Cotton", "market": "Rajkot", "state": "Gujarat", "price_per_quintal": 7250, "change_pct": 0.4},
    {"crop": "Soybean", "market": "Indore", "state": "Madhya Pradesh", "price_per_quintal": 4680, "change_pct": -1.5},
    {"crop": "Sugarcane", "market": "Muzaffarnagar", "state": "Uttar Pradesh", "price_per_quintal": 360, "change_pct": 0.2},
    {"crop": "Onion", "market": "Lasalgaon", "state": "Maharashtra", "price_per_quintal": 1850, "change_pct": 5.8},
    {"crop": "Tomato", "market": "Kolar", "state": "Karnataka", "price_per_quintal": 2200, "change_pct": -3.2},
    {"crop": "Potato", "market": "Agra", "state": "Uttar Pradesh", "price_per_quintal": 1280, "change_pct": 1.1},
    {"crop": "Mustard", "market": "Alwar", "state": "Rajasthan", "price_per_quintal": 5420, "change_pct": 0.9},
]


def suitability_from_score(score: int) -> str:
    if score >= 4:
        return "High"
    if score >= 2:
        return "Medium"
    return "Low"


def build_reason(entry: dict, req: CropRecommendRequest, score: int) -> str:
    parts = []
    if req.soil_type.lower() in entry["soils"]:
        parts.append(f"{entry['crop']} works well in {req.soil_type.lower()} soil")
    if any(token in req.season.lower() for token in entry["seasons"]):
        parts.append(f"the current season aligns with {entry['crop']}")
    if req.region.lower() in entry["regions"]:
        parts.append(f"{req.region} is a proven growing region")
    if req.rainfall_mm is not None and entry["rainfall"][0] <= req.rainfall_mm <= entry["rainfall"][1]:
        parts.append("rainfall is within a healthy range")
    if req.ph is not None and entry["ph"][0] <= req.ph <= entry["ph"][1]:
        parts.append("soil pH is suitable")
    if not parts:
        parts.append("it can adapt reasonably well with balanced nutrient and water management")
    return f"{'; '.join(parts[:3])}. Suitability score: {score}/5."


def heuristic_recommendations(req: CropRecommendRequest) -> CropRecommendResponse:
    season = req.season.lower()
    region = req.region.lower()
    soil = req.soil_type.lower()
    scored: List[CropSuggestion] = []

    for entry in CROP_LIBRARY:
        score = 0
        if soil in entry["soils"]:
            score += 1
        if any(token in season for token in entry["seasons"]):
            score += 1
        if region in entry["regions"]:
            score += 1
        if req.rainfall_mm is not None and entry["rainfall"][0] <= req.rainfall_mm <= entry["rainfall"][1]:
            score += 1
        if req.ph is not None and entry["ph"][0] <= req.ph <= entry["ph"][1]:
            score += 1

        scored.append(
            CropSuggestion(
                crop=entry["crop"],
                suitability=suitability_from_score(score),
                yield_estimate=entry["yield_estimate"],
                water_requirement=entry["water_requirement"],
                reason=build_reason(entry, req, score),
            )
        )

    scored.sort(key=lambda item: {"High": 3, "Medium": 2, "Low": 1}[item.suitability], reverse=True)
    fertilizer_tips = [
        "Prefer split nitrogen applications instead of a single heavy dose.",
        "Add well-decomposed organic matter before sowing to improve soil structure.",
        "Test soil again before the next crop cycle if pH or nutrient balance is uncertain.",
    ]
    if req.nitrogen is not None and req.nitrogen < 40:
        fertilizer_tips.insert(0, "Nitrogen looks on the lower side; plan a balanced top-dress after establishment.")
    if req.ph is not None and req.ph < 6:
        fertilizer_tips.append("Low pH can limit nutrient uptake; consider liming based on a local soil test.")

    advice = (
        f"For {req.region} during {req.season}, prioritize varieties with local disease tolerance and "
        "match irrigation to recent weather instead of using a fixed schedule."
    )
    return CropRecommendResponse(
        id=str(uuid.uuid4()),
        recommendations=scored[:4],
        fertilizer_tips=fertilizer_tips[:4],
        general_advice=advice,
    )


async def ai_crop_recommendations(req: CropRecommendRequest) -> Optional[CropRecommendResponse]:
    system = (
        "You are an expert agronomist advising Indian farmers. "
        "Respond only with JSON using the schema "
        '{"recommendations":[{"crop":str,"suitability":"High|Medium|Low","yield_estimate":str,'
        '"water_requirement":str,"reason":str}],"fertilizer_tips":[str],"general_advice":str}. '
        "Return 3 to 5 recommendations."
    )
    chat = await claude_chat(f"crop-{uuid.uuid4()}", system)
    if chat is None:
        return None

    user_text = (
        f"Soil type: {req.soil_type}\n"
        f"Season: {req.season}\n"
        f"Region: {req.region}\n"
        f"N: {req.nitrogen}, P: {req.phosphorus}, K: {req.potassium}, "
        f"pH: {req.ph}, Rainfall(mm): {req.rainfall_mm}\n"
        "Recommend the best crops."
    )
    try:
        text = await asyncio.wait_for(
            chat.send_message(UserMessage(text=user_text)),
            timeout=AI_TIMEOUT_SECONDS,
        )
    except Exception as exc:  # pragma: no cover - upstream failure
        logger.warning("Falling back from AI crop recommendation: %s", exc)
        return None

    data = extract_json(text)
    recommendations = data.get("recommendations") or []
    if not recommendations:
        return None

    return CropRecommendResponse(
        id=str(uuid.uuid4()),
        recommendations=[CropSuggestion(**item) for item in recommendations[:5]],
        fertilizer_tips=data.get("fertilizer_tips", []),
        general_advice=data.get("general_advice", ""),
    )


async def ai_disease_detection(req: DiseaseDetectRequest, file_path: str, mime_type: str) -> Optional[DiseaseDetectResponse]:
    if not (ai_enabled() and FileContentWithMimeType):
        return None

    system = (
        "You are a plant pathologist. Reply only in JSON with schema "
        '{"disease":str,"confidence":"High|Medium|Low","severity":"Mild|Moderate|Severe",'
        '"symptoms":[str],"treatment":[str],"prevention":[str],"organic_remedy":str}. '
        'If the plant looks healthy, set disease to "Healthy".'
    )
    chat = await claude_chat(f"disease-{uuid.uuid4()}", system)
    if chat is None:
        return None

    user_text = "Analyze this plant image for disease."
    if req.crop_hint:
        user_text += f" The crop appears to be: {req.crop_hint}."

    try:
        file_content = FileContentWithMimeType(file_path=file_path, mime_type=mime_type)
        text = await asyncio.wait_for(
            chat.send_message(UserMessage(text=user_text, file_contents=[file_content])),
            timeout=AI_TIMEOUT_SECONDS,
        )
    except Exception as exc:  # pragma: no cover - upstream failure
        logger.warning("Falling back from AI disease detection: %s", exc)
        return None

    data = extract_json(text)
    if not data.get("disease"):
        return None

    return DiseaseDetectResponse(
        id=str(uuid.uuid4()),
        disease=data.get("disease", "Unknown"),
        confidence=data.get("confidence", "Medium"),
        severity=data.get("severity", "Moderate"),
        symptoms=data.get("symptoms", []),
        treatment=data.get("treatment", []),
        prevention=data.get("prevention", []),
        organic_remedy=data.get("organic_remedy"),
    )


def heuristic_disease_detection(req: DiseaseDetectRequest) -> DiseaseDetectResponse:
    key = (req.crop_hint or "").strip().lower()
    match = DISEASE_LIBRARY.get(key, DISEASE_LIBRARY["default"])
    return DiseaseDetectResponse(id=str(uuid.uuid4()), **match)


def rule_based_chat_reply(message: str) -> str:
    lower = message.lower()
    if any(term in lower for term in ("water", "irrigation", "drip")):
        return (
            "Check soil moisture before irrigating, water early in the morning, and avoid shallow daily watering. "
            "Deep irrigation at crop-specific intervals is usually better."
        )
    if any(term in lower for term in ("fertilizer", "npk", "urea")):
        return (
            "Use fertilizer in split doses, avoid applying urea on dry soil, and combine chemical inputs with compost "
            "or well-rotted FYM when possible."
        )
    if any(term in lower for term in ("disease", "pest", "leaf", "spot")):
        return (
            "Start with field sanitation, remove severely affected leaves, and confirm the crop and symptoms before "
            "choosing a spray. Uploading a leaf image usually helps narrow the diagnosis."
        )
    if any(term in lower for term in ("weather", "rain", "forecast")):
        return (
            "Use the weather advisory page to time irrigation and spraying. If rain is likely within 24 hours, "
            "delay foliar sprays when possible."
        )
    return (
        "Tell me your crop, region, season, and the main issue you are seeing. I can help with crop choice, "
        "fertilizer planning, irrigation, pests, or weather-related decisions."
    )


async def ai_chat_reply(session_id: str, message: str) -> Optional[str]:
    system = (
        "You are KrishiMitra, a friendly multilingual AI assistant for farmers. "
        "Answer questions about crops, soil, pests, fertilizers, weather, irrigation, and government schemes. "
        "Keep answers practical, concise, and encouraging."
    )
    chat = await claude_chat(session_id, system)
    if chat is None:
        return None

    try:
        return await asyncio.wait_for(
            chat.send_message(UserMessage(text=message)),
            timeout=AI_TIMEOUT_SECONDS,
        )
    except Exception as exc:  # pragma: no cover - upstream failure
        logger.warning("Falling back from AI chat: %s", exc)
        return None


@api_router.get("/")
async def root() -> dict:
    return {
        "message": "Smart Crop Advisory API is running",
        "database_mode": "mongodb" if db is not None else "memory",
        "ai_mode": "enabled" if ai_enabled() else "mock",
    }


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(payload: StatusCheckCreate) -> StatusCheck:
    status = StatusCheck(**payload.model_dump())
    doc = status.model_dump()
    doc["timestamp"] = status.timestamp.isoformat()
    await insert_document("status_checks", doc)
    return status


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks() -> List[StatusCheck]:
    rows = await list_documents("status_checks")
    parsed_rows = []
    for row in rows:
        current = dict(row)
        if isinstance(current.get("timestamp"), str):
            current["timestamp"] = datetime.fromisoformat(current["timestamp"])
        parsed_rows.append(StatusCheck(**current))
    return parsed_rows


@api_router.post("/crop/recommend", response_model=CropRecommendResponse)
async def crop_recommend(req: CropRecommendRequest) -> CropRecommendResponse:
    response = await ai_crop_recommendations(req)
    if response is None:
        response = heuristic_recommendations(req)

    doc = response.model_dump()
    doc["request"] = req.model_dump()
    doc["created_at"] = now_iso()
    await insert_document("crop_recommendations", doc)
    return response


@api_router.post("/disease/detect", response_model=DiseaseDetectResponse)
async def disease_detect(req: DiseaseDetectRequest) -> DiseaseDetectResponse:
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 required")

    image_data = req.image_base64.split(",", 1)[1] if req.image_base64.startswith("data:") else req.image_base64
    try:
        raw = base64.b64decode(image_data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image") from exc

    mime_type = "image/jpeg"
    suffix = ".jpg"
    if raw[:8].startswith(b"\x89PNG"):
        mime_type, suffix = "image/png", ".png"
    elif raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        mime_type, suffix = "image/webp", ".webp"

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_file.write(raw)
    temp_file.close()

    try:
        response = await ai_disease_detection(req, temp_file.name, mime_type)
    finally:
        try:
            os.unlink(temp_file.name)
        except OSError:
            logger.debug("Temporary image cleanup skipped for %s", temp_file.name)

    if response is None:
        response = heuristic_disease_detection(req)

    doc = response.model_dump()
    doc["created_at"] = now_iso()
    await insert_document("disease_reports", doc)
    return response


@api_router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest) -> ChatResponse:
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message required")

    user_message = {
        "session_id": req.session_id,
        "role": "user",
        "content": req.message.strip(),
        "timestamp": now_iso(),
    }
    await insert_document("chat_messages", user_message)

    reply = await ai_chat_reply(req.session_id, req.message.strip())
    if reply is None:
        reply = rule_based_chat_reply(req.message)

    assistant_message = {
        "session_id": req.session_id,
        "role": "assistant",
        "content": reply,
        "timestamp": now_iso(),
    }
    await insert_document("chat_messages", assistant_message)
    return ChatResponse(session_id=req.session_id, reply=reply)


@api_router.get("/chat/{session_id}", response_model=List[ChatMessage])
async def chat_history(session_id: str) -> List[ChatMessage]:
    rows = (await list_chat_messages(session_id))[-40:]
    return [ChatMessage(role=row["role"], content=row["content"], timestamp=row["timestamp"]) for row in rows]


@api_router.get("/weather")
async def get_weather(region: str = "Punjab") -> dict:
    seed = sum(ord(char) for char in region.lower())
    temperature = 22 + (seed % 15)
    humidity = 45 + (seed % 40)
    conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Thunderstorm"]
    current_condition = conditions[seed % len(conditions)]
    forecast = []
    weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for index in range(5):
        forecast.append(
            {
                "day": weekdays[(seed + index) % len(weekdays)],
                "high": temperature + (index % 3),
                "low": temperature - 6 - (index % 2),
                "condition": conditions[(seed + index) % len(conditions)],
                "rain_chance": (seed * (index + 1)) % 90,
            }
        )

    alerts = []
    if current_condition in {"Thunderstorm", "Light Rain"}:
        alerts.append(
            {
                "type": "Rain Alert",
                "severity": "Moderate",
                "message": f"Expected rainfall in {region} over the next 24 hours. Delay pesticide spraying if possible.",
            }
        )
    if temperature > 33:
        alerts.append(
            {
                "type": "Heatwave",
                "severity": "High",
                "message": "High temperature detected. Increase irrigation frequency and avoid midday spray operations.",
            }
        )

    return {
        "region": region,
        "current": {
            "temperature_c": temperature,
            "humidity": humidity,
            "condition": current_condition,
            "wind_kph": 8 + (seed % 15),
        },
        "forecast": forecast,
        "alerts": alerts,
        "updated_at": now_iso(),
    }


@api_router.get("/market/prices", response_model=List[MarketPrice])
async def market_prices() -> List[MarketPrice]:
    timestamp = now_iso()
    return [MarketPrice(updated_at=timestamp, **row) for row in DEFAULT_MARKET]


@api_router.get("/fertilizer/recommend")
async def fertilizer_recommend(crop: str, soil: str = "loamy") -> dict:
    lookup = {
        "wheat": {"N": 120, "P": 60, "K": 40, "organic": "Farmyard manure 10 t/ha"},
        "rice": {"N": 100, "P": 50, "K": 50, "organic": "Green manure before sowing"},
        "maize": {"N": 150, "P": 75, "K": 40, "organic": "Compost 8 t/ha"},
        "cotton": {"N": 120, "P": 60, "K": 60, "organic": "Vermicompost 5 t/ha"},
        "tomato": {"N": 100, "P": 80, "K": 100, "organic": "Cow dung compost 20 t/ha"},
        "potato": {"N": 180, "P": 80, "K": 100, "organic": "FYM 25 t/ha"},
        "soybean": {"N": 20, "P": 60, "K": 40, "organic": "Rhizobium inoculation with compost"},
    }
    match = lookup.get(crop.strip().lower(), {"N": 100, "P": 50, "K": 50, "organic": "Balanced compost 10 t/ha"})
    return {
        "crop": crop,
        "soil": soil,
        "npk_kg_per_ha": {"N": match["N"], "P": match["P"], "K": match["K"]},
        "organic_option": match["organic"],
        "application_stages": [
            "Basal dose at sowing with the full phosphorus and potassium requirement.",
            "First top-dress 3 to 4 weeks after sowing for nitrogen.",
            "Second top-dress near flowering if the crop still shows active nutrient demand.",
        ],
    }


app.include_router(api_router)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    if mongo_client is not None:
        mongo_client.close()
