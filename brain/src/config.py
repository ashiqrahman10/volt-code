import os
import random
from dotenv import load_dotenv

# Load .env file from parent directory (brain/.env or brain/config.env)
# The server.py loads ../config.env, so we should try to match or rely on env vars being set.
load_dotenv("../config.env") 

class Settings:
    # Gateway (Simulated or URL)
    gateway_url = os.getenv("GATEWAY_URL", "http://localhost:8080")
    
    # AI Keys - multiple keys for load balancing to avoid rate limits
    apikeys = os.getenv("GROQ_API_KEYS", "").split(",")
    apikeys = [key.strip() for key in apikeys if key.strip()]

    if not apikeys:
        # Fallback or warning - for now we'll just log or leave empty, 
        # but the random.choice will fail if this is empty.
        # Ideally, we should have at least one key.
        # For development without keys, we might want to handle this gracefully in get_groq_api_key
        pass
    
    @staticmethod
    def get_groq_api_key() -> str:
        """Randomly select an API key to distribute load and avoid rate limits."""
        return random.choice(Settings.apikeys)
    groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    
    # Thresholds
    memory_threshold_percent = float(os.getenv("MEMORY_THRESHOLD", "80.0"))
    
settings = Settings()
