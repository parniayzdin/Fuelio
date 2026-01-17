"""
Credit Card Benefits Service - GCP Integration with Google Search

This service uses Google Generative AI with Google Search grounding to:
1. Fetch a list of popular credit cards with gas rewards from the web
2. Extract gas/fuel benefits for specific credit cards from the web

Everything is powered by GCP with real-time web search - just like news_analysis!
"""

import os
import json
from typing import Optional, List
from datetime import datetime

from google import genai
from google.genai.types import Tool, GoogleSearch, GenerateContentConfig


# Cache for credit card providers (refreshed on server restart)
_PROVIDERS_CACHE: Optional[list[str]] = None

# Default fallback providers (always available, even if GCP fails)
DEFAULT_PROVIDERS = [
    "Chase Freedom Flex",
    "Chase Freedom Unlimited",
    "Chase Sapphire Preferred",
    "Citi Custom Cash Card",
    "American Express Blue Cash Preferred",
    "Costco Anywhere Visa Card by Citi",
    "Bank of America Customized Cash Rewards",
    "Wells Fargo Autograph Card",
    "Discover it Cash Back",
    "Capital One SavorOne",
    "PNC Cash Rewards Visa",
    "Sam's Club Mastercard",
]

# Configure Vertex AI - uses your GCP paid account
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

# Fallback to API key for local dev
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")


def get_genai_client():
    """
    Get the appropriate genai client - Vertex AI (paid) or API Key (free tier).
    Vertex AI is preferred when GCP project is configured.
    """
    if GOOGLE_CLOUD_PROJECT:
        print(f"Using Vertex AI with project: {GOOGLE_CLOUD_PROJECT}")
        return genai.Client(
            vertexai=True,
            project=GOOGLE_CLOUD_PROJECT,
            location=GOOGLE_CLOUD_LOCATION
        )
    elif GOOGLE_API_KEY:
        print("Using Gemini API with API key")
        return genai.Client(api_key=GOOGLE_API_KEY)
    else:
        return None


def extract_sources_from_grounding(grounding_metadata) -> List[dict]:
    """Extract real source URLs from Gemini's grounding metadata."""
    sources = []
    
    if not grounding_metadata:
        return sources
    
    grounding_chunks = getattr(grounding_metadata, 'grounding_chunks', []) or []
    
    for chunk in grounding_chunks:
        web = getattr(chunk, 'web', None)
        if web:
            sources.append({
                "title": getattr(web, 'title', 'Credit Card Info') or 'Credit Card Info',
                "url": getattr(web, 'uri', '') or '',
            })
    
    return sources[:5]


async def get_credit_card_benefits(provider: str) -> dict:
    """
    Use Google Generative AI with Search Grounding to extract gas/fuel benefits.
    
    This uses real-time web search to find the latest benefits for the credit card.
    
    Args:
        provider: Name of the credit card provider (e.g., "Chase Sapphire Preferred")
    
    Returns:
        Dictionary with benefits data and sources
    """
    client = get_genai_client()
    
    if not client:
        return {
            "error": "GCP_NOT_CONFIGURED",
            "message": "Neither GOOGLE_CLOUD_PROJECT nor GOOGLE_API_KEY configured"
        }
    
    # Create Google Search tool for grounding
    google_search_tool = Tool(google_search=GoogleSearch())
    
    prompt = f"""Search the web for the current gas and fuel-related benefits of the {provider} credit card.

Look for:
- Gas station cashback percentages
- Annual spending caps
- Partner gas station brands
- Special promotions or bonus categories

Based on the actual information you find online, provide your response in this exact JSON format (no markdown, just pure JSON):
{{
    "gas_cashback_percent": <percentage as decimal like 3.0 for 3%, or null if not found>,
    "gas_cashback_cap": <annual cap in dollars like 1500.00, or null if unlimited/not found>,
    "special_promotions": [<array of current promotions you found, empty array if none>],
    "partner_stations": [<array of partner gas station brands you found, empty array if none>],
    "notes": "<any additional important notes about gas/fuel benefits from your search, or null>"
}}

Important:
- Only include gas and fuel-related benefits
- Use null for fields where you couldn't find information
- Be specific about what you found from actual web sources
- Return ONLY valid JSON, no other text"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=GenerateContentConfig(
                tools=[google_search_tool],
                response_modalities=["TEXT"],
            )
        )
        
        # Extract sources from grounding metadata
        sources = []
        if response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            grounding_metadata = getattr(candidate, 'grounding_metadata', None)
            sources = extract_sources_from_grounding(grounding_metadata)
        
        # Parse the response text
        response_text = response.text.strip()
        
        # Clean up response if it has markdown code blocks
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            response_text = response_text.strip()
        
        if response_text.startswith("json"):
            response_text = response_text[4:].strip()
        
        benefits_data = json.loads(response_text)
        
        # Add sources to notes if available
        if sources and benefits_data.get("notes") is None:
            source_names = [s.get("title", "web source") for s in sources[:2]]
            benefits_data["notes"] = f"Data sourced from: {', '.join(source_names)}"
        
        return benefits_data
        
    except json.JSONDecodeError as e:
        return {
            "gas_cashback_percent": None,
            "gas_cashback_cap": None,
            "special_promotions": [],
            "partner_stations": [],
            "notes": f"Could not parse benefits for {provider}. Please try refreshing."
        }
    except Exception as e:
        error_msg = str(e)
        
        if "403" in error_msg and "leaked" in error_msg.lower():
            return {
                "error": "API_KEY_LEAKED",
                "message": "The Google API key has been reported as leaked. Please create a new API key in GCP Console.",
                "provider": provider
            }
        
        return {
            "error": "FETCH_FAILED",
            "message": f"Failed to fetch benefits for {provider}: {error_msg}",
            "provider": provider
        }


async def get_supported_providers() -> list[str]:
    """
    Get list of popular credit cards with gas/fuel rewards using Google Search.
    
    Uses Google Search grounding to find the latest popular gas rewards cards.
    Results are cached in memory (cleared on server restart).
    Falls back to DEFAULT_PROVIDERS if GCP is unavailable.
    
    Returns:
        List of credit card provider names
    """
    global _PROVIDERS_CACHE
    
    # Return cached results if available
    if _PROVIDERS_CACHE is not None:
        return _PROVIDERS_CACHE
    
    client = get_genai_client()
    
    # If no client, return default providers immediately
    if not client:
        _PROVIDERS_CACHE = DEFAULT_PROVIDERS.copy()
        return _PROVIDERS_CACHE
    
    # Try to fetch from GCP with Google Search
    try:
        google_search_tool = Tool(google_search=GoogleSearch())
        
        prompt = """Search the web for the best credit cards for gas and fuel rewards in 2025-2026.

Find the top 15-20 most popular credit cards in the United States that offer cashback or rewards at gas stations.

Return ONLY a JSON array of the full credit card names you found (no markdown, just pure JSON):
["Card Name 1", "Card Name 2", ...]

Important:
- Include the full official card names (e.g., "Chase Freedom Flex" not just "Chase")
- Focus on cards that actually have gas/fuel benefits according to your search
- Include both premium and everyday cards
- Return ONLY the JSON array, no other text"""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=GenerateContentConfig(
                tools=[google_search_tool],
                response_modalities=["TEXT"],
            )
        )
        
        response_text = response.text.strip()
        
        # Clean up response if it has markdown code blocks
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            response_text = response_text.strip()
        
        if response_text.startswith("json"):
            response_text = response_text[4:].strip()
        
        providers = json.loads(response_text)
        
        if isinstance(providers, list) and len(providers) > 0:
            _PROVIDERS_CACHE = providers
            return providers
        else:
            raise ValueError("Invalid response format")
            
    except Exception as e:
        print(f"Failed to fetch credit card providers from GCP: {e}")
        # Return default list on any error
        _PROVIDERS_CACHE = DEFAULT_PROVIDERS.copy()
        return _PROVIDERS_CACHE
