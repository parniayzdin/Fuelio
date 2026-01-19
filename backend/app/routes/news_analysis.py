"""
News Analysis API - RAG-based price predictions using Vertex AI Gemini with Search Grounding
"""
import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from datetime import datetime
from google import genai
from google.genai.types import Tool, GoogleSearch, GenerateContentConfig

router = APIRouter(prefix="/news", tags=["news"])

GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

class NewsSource(BaseModel):
    title: str
    url: str
    date: str
    snippet: str
    publisher: str

class NewsAnalysisResponse(BaseModel):
    prediction: str
    confidence: float
    summary: str
    reasoning: str
    sources: List[NewsSource]
    last_updated: str

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
                "title": getattr(web, 'title', 'News Article') or 'News Article',
                "url": getattr(web, 'uri', '') or '',
                "date": datetime.now().strftime("%Y-%m-%d"),
                "snippet": "",
                "publisher": extract_publisher(getattr(web, 'uri', ''))
            })
    
    supports = getattr(grounding_metadata, 'grounding_supports', []) or []
    for support in supports:
        segment = getattr(support, 'segment', None)
        if segment:
            text = getattr(segment, 'text', '')
            for source in sources:
                if not source['snippet'] and text:
                    source['snippet'] = text[:200] + '...' if len(text) > 200 else text
                    break
    
    return sources[:5]

def extract_publisher(url: str) -> str:
    """Extract publisher name from URL."""
    if not url:
        return "News Source"
    
    publishers = {
        'reuters.com': 'Reuters',
        'bloomberg.com': 'Bloomberg',
        'cbc.ca': 'CBC News',
        'gasbuddy.com': 'GasBuddy',
        'cnn.com': 'CNN',
        'cnbc.com': 'CNBC',
        'bbc.com': 'BBC',
        'theglobeandmail.com': 'Globe and Mail',
        'toronto.com': 'Toronto.com',
        'cp24.com': 'CP24',
        'globalnews.ca': 'Global News',
        'energynow.ca': 'Energy Now',
        'oilprice.com': 'OilPrice',
    }
    
    for domain, name in publishers.items():
        if domain in url.lower():
            return name
    
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return parsed.netloc.replace('www.', '').split('.')[0].capitalize()
    except:
        return "News Source"

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
        raise HTTPException(
            status_code=500,
            detail="Neither GOOGLE_CLOUD_PROJECT nor GOOGLE_API_KEY configured"
        )

async def analyze_with_gemini_search(region: str) -> dict:
    """Use Gemini with Google Search grounding to analyze real news."""
    
    client = get_genai_client()
    
    google_search_tool = Tool(google_search=GoogleSearch())
    
    prompt = f"""Search for the latest news about oil prices, gas prices, and fuel costs in Canada, 
particularly affecting {region}, Ontario. 

Based on the current news you find, analyze and predict the fuel price trend for {region} for the next 7 days.

Provide your response in this exact JSON format (no markdown, just pure JSON):
{{
    "prediction": "rising" or "falling" or "stable",
    "confidence": 0.0 to 1.0,
    "summary": "Brief 1-2 sentence summary of your prediction based on actual news",
    "reasoning": "2-3 sentences explaining the specific news factors affecting {region} fuel prices"
}}

Base your analysis on the actual news articles you find through your search."""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=GenerateContentConfig(
                tools=[google_search_tool],
                response_modalities=["TEXT"],
            )
        )
        
        sources = []
        if response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            grounding_metadata = getattr(candidate, 'grounding_metadata', None)
            sources = extract_sources_from_grounding(grounding_metadata)
        
        response_text = response.text.strip()
        
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            response_text = response_text.strip()
        
        if response_text.startswith("json"):
            response_text = response_text[4:].strip()
        
        result = json.loads(response_text)
        
        result["prediction"] = result.get("prediction", "stable").lower()
        if result["prediction"] not in ["rising", "falling", "stable"]:
            result["prediction"] = "stable"
        
        result["confidence"] = min(max(float(result.get("confidence", 0.5)), 0.0), 1.0)
        result["sources"] = sources
        
        return result
        
    except json.JSONDecodeError as e:
        return {
            "prediction": "stable",
            "confidence": 0.5,
            "summary": "Market conditions appear stable based on current news.",
            "reasoning": f"Analysis for {region}: Unable to parse detailed response. General market indicators suggest stable prices.",
            "sources": []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

@router.get("/analysis", response_model=NewsAnalysisResponse)
async def get_news_analysis(region: str = "toronto"):
    """
    Get AI-powered price prediction based on REAL news via Google Search.
    
    Uses Vertex AI Gemini with Google Search grounding to find and analyze actual
    current news articles about oil and gas prices.
    
    Requires either:
    - GOOGLE_CLOUD_PROJECT env var (for Vertex AI - paid GCP account)
    - GOOGLE_API_KEY env var (for free tier)
    """
    region_names = {
        "toronto": "Toronto",
        "ottawa": "Ottawa", 
        "hamilton": "Hamilton",
        "london": "London",
        "kitchener": "Kitchener-Waterloo",
        "thunder-bay": "Thunder Bay",
        "sudbury": "Sudbury"
    }
    
    region_name = region_names.get(region, "Ontario")
    
    result = await analyze_with_gemini_search(region_name)
    
    return NewsAnalysisResponse(
        prediction=result["prediction"],
        confidence=result["confidence"],
        summary=result["summary"],
        reasoning=result["reasoning"],
        sources=[NewsSource(**s) for s in result.get("sources", [])],
        last_updated=datetime.now().isoformat()
    )
