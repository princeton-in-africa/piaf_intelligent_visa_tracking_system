# PiAF Intelligent Visa Tracking System

A visa case tracking and analytics platform built for **Princeton in Africa (PiAF)**, designed to give staff a single dashboard for both quantitative and qualitative visa insights across fellows, countries, and host organizations
**Live app:** Frontend on Vercel · Backend on Render. 

---

## Overview

Historically, visa-related information for PiAF fellows was scattered across individual reports, making it hard for staff to spot patterns (e.g., which countries or host organizations have the most complex visa processes) without manually re-reading source documents. This project centralizes that information into:

- A structured, queryable database of anonymized visa cases
- An extraction pipeline that turns raw fellow reports into structured data
- A dashboard that surfaces both **quantitative** trends (counts, timelines, filters by country/org) and **qualitative** context (the "why" behind a case) in one place, so staff don't have to leave the dashboard to go dig through underlying reports

The system covers both **historical/alumni cases** and a lighter-weight **current fellows** view focused specifically on visa status (not general fellowship progress).

## Features

- **Insights dashboard** — quantitative visa statistics with filtering/ranging by **country** and **host organization**
- **Qualitative context via RAG** — retrieval-augmented generation surfaces relevant qualitative detail from case reports directly in the dashboard, instead of requiring staff to open the original document
- **Privacy by design** — no fellow names are stored anywhere in the system; cases are tracked by case ID
- **Two-tier data model** — alumni/historical cases vs. current fellows (current fellows tab is visa-specific, updated as new quarterly reports come in)
- **Resilient extraction pipeline** — parses fellow reports (PDF) into structured records with label-based parsing, fallback matching for wording drift across report formats, and per-file error isolation so one bad file doesn't break a batch import

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Python, FastAPI |
| Database | PostgreSQL (hosted on Supabase) |
| Retrieval / qualitative search | RAG pipeline |
| Report parsing | pdfplumber, label-based + fallback regex/text matching |
| Anonymization | Custom script (`anonymize.py`) |
| Frontend | (deployed on Vercel) |
| Backend hosting | Render |
| Frontend hosting | Vercel |

## Architecture

```
Fellow Reports (PDF)
        │
        ▼
 extraction pipeline (pdfplumber + label-based parsing
 with fallback matching for wording drift)
        │
        ▼
   anonymize.py  ──►  strips/excludes personally identifying
        │              info before anything touches the DB
        ▼
 PostgreSQL (Supabase)
        │
        ▼
   FastAPI backend  ──►  RAG layer for qualitative retrieval
        │                (Render)
        ▼
   Frontend dashboard (Vercel)
   - Quantitative view: counts, filters by country/org
   - Qualitative view: RAG-surfaced context per case
   - Current Fellows tab: visa status only, refreshed
     roughly every 3 months alongside fellow reporting
     cadence
```

**Data lifecycle:** Current fellows submit reports on a quarterly cadence into a dedicated folder; once a fellow transitions to alumni status, their files move into the general historical folder that feeds the main dashboard.

## Project Structure

> Adjust this to match your actual folder layout — this reflects the general shape of the system.

```
.
├── backend/
│   ├── app/                 # FastAPI application
│   ├── pipeline/
│   │   ├── extract.py       # pdfplumber-based extraction
│   │   └── anonymize.py     # PII stripping / case ID assignment
│   ├── rag/                 # RAG indexing + retrieval logic
│   └── requirements.txt
├── frontend/
│   ├── src/
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ (for the frontend)
- A Supabase project (PostgreSQL)
- API keys/credentials for whichever RAG/embedding provider the pipeline uses

### Environment Variables

Create a `.env` file in the backend directory with values along these lines (rename/adjust to match your actual config):

```
DATABASE_URL=postgresql://<user>:<password>@<supabase-host>:5432/postgres
SUPABASE_URL=
SUPABASE_KEY=
CORS_ORIGINS=https://<your-vercel-frontend-url>
```

> Note: an earlier CORS misconfiguration between the Render backend and Vercel frontend caused deployment issues, double-check `CORS_ORIGINS` matches your deployed frontend URL exactly.

### Installation

```bash
# clone the repo
git clone https://github.com/princeton-in-africa/<repo-name>.git
cd <repo-name>

# backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# frontend
cd ../frontend
npm install
```

### Running Locally

```bash
# backend
uvicorn app.main:app --reload

# frontend
npm run dev
```

### Running the Extraction Pipeline

```bash
python pipeline/extract.py --input ./reports --output ./staging
python pipeline/anonymize.py --input ./staging
```

## Deployment

- **Backend:** deployed on [Render](https://render.com) under the PIAF intern account (moved off Railway to avoid an ongoing hosting cost)
- **Frontend:** deployed on [Vercel](https://vercel.com), also under the PIAF intern account
- **Database:** Supabase (PostgreSQL)
- **Repo ownership:** hosted under the `princeton-in-africa` GitHub organization and made public (required for Vercel's free Hobby tier, which doesn't support private org repos)

Deploying under the PIAF intern account for both Render and Vercel avoided the need to transfer ownership from a personal account.

## Data Privacy

This system was built with privacy as a first-class constraint:

- **No fellow names are stored** anywhere in the database
- Cases are identified by **case ID** only
- Anonymization happens at ingestion time (`anonymize.py`), before data reaches the database


## Acknowledgments

Built during a Princeton in Africa (PiAF) Programs internship, summer 2026, with guidance from PiAF supervisors and the wider team throughout the project.


