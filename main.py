from fastapi import FastAPI
from supabase import create_client
import os
from dotenv import load_dotenv

app = FastAPI()
load_dotenv()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)
print("URL:", repr(url))
print("KEY length:", len(key))

@app.get("/hello")
def say_hello():
    return {"message": "Hello!"}

@app.get("/records")
def get_records(country: str = None):
    response = supabase.table("visa_records").select("*").execute()
    records = response.data
    
    if country:
        records = [r for r in records if r.get("country") == country]
    
    return records

@app.get("/stats/yearly")
def get_yearly_stats():
    response = supabase.table("visa_records").select("*").execute()
    records = response.data
    
    years_found = [r["year"] for r in records]
    unique_years = sorted(set(years_found))
    
    stats = []
    
    for year in unique_years:
        year_records = [r for r in records if r.get("year") == year]
        total = len(year_records)
        
        complications = [r for r in year_records if r.get("had_challenges") == "Yes"]
        complication_count = len(complications)
        
        known_outcomes = [r for r in year_records if r.get("had_challenges") in ["Yes", "No"]]
        known_total = len(known_outcomes)
        
        if known_total > 0:
            rate = round(complication_count / known_total * 100)
        else:
            rate = None
        
        stats.append({
            "year": year,
            "total_reports": total,
            "complication_rate": rate
        })
    
    return stats

@app.get("/organizations")
def get_organizations(country: str = None):
    response = supabase.table("visa_records").select("*").execute()
    records = response.data
    
    if country:
        records = [r for r in records if r.get("country") == country]
    
    return records