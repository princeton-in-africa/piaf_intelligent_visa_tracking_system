import json
from collections import defaultdict

print("=== PIAF VISA INTELLIGENCE ANALYSIS ===\n")

with open("visa_clean.json", "r") as f:
    records = json.load(f)

print(f"Total records analyzed: {len(records)}")

countries = [r["country"] for r in records if r.get("country")]
print(f"Countries covered: {len(set(countries))}")
print(f"Years covered: {sorted(set(r['year'] for r in records if r.get('year')))}\n")

# ── COMPLICATION RATE BY COUNTRY ──────────────────────────
print("--- COMPLICATION RATE BY COUNTRY ---")
by_country = defaultdict(list)
for r in records:
    if r.get("country"):
        by_country[r["country"]].append(r)

for country in sorted(by_country.keys()):
    country_records = by_country[country]
    total = len(country_records)
    complications = sum(1 for r in country_records if r.get("had_challenges") in ["Yes", "Minor"])
    known = sum(1 for r in country_records if r.get("had_challenges") in ["Yes", "Minor", "No"])
    rate = round(complications / known * 100) if known > 0 else 0
    flag = " ⚠️  HIGH RISK" if rate >= 60 else (" ✓ LOW RISK" if rate <= 20 else "")
    print(f"  {country}: {rate}% complication rate ({total} reports){flag}")

# ── VISA TYPES BY COUNTRY ─────────────────────────────────
print("\n--- VISA TYPES USED BY COUNTRY ---")
for country in sorted(by_country.keys()):
    visa_types = [r["visa_type"] for r in by_country[country] if r.get("visa_type")]
    unique = set(visa_types)
    inconsistent = " ⚠️  INCONSISTENT" if len(unique) > 1 else ""
    print(f"  {country}: {', '.join(sorted(unique))}{inconsistent}")

# ── WHO PAYS ──────────────────────────────────────────────
print("\n--- WHO COVERS VISA COSTS ---")
payers = [r["who_paid"] for r in records if r.get("who_paid")]
for payer in sorted(set(payers)):
    count = payers.count(payer)
    pct = round(count / len(payers) * 100)
    print(f"  {payer}: {count} fellows ({pct}%)")

# ── BEFORE OR AFTER ARRIVAL ───────────────────────────────
print("\n--- VISA OBTAINED BEFORE OR AFTER ARRIVAL ---")
timing = [r["before_or_after_arrival"] for r in records if r.get("before_or_after_arrival")]
for t in sorted(set(timing)):
    count = timing.count(t)
    pct = round(count / len(timing) * 100)
    print(f"  {t}: {count} fellows ({pct}%)")

# ── ADVICE FROM PAST FELLOWS ──────────────────────────────
print("\n--- ADVICE FROM PAST FELLOWS ---")
for r in records:
    if r.get("advice_for_future_fellows") and r.get("country"):
        print(f"  [{r['country']}] {r['advice_for_future_fellows']}")

# ── KEY FINDINGS ──────────────────────────────────────────
print("\n--- KEY FINDINGS FOR PIAF ---")

high_risk = [c for c in by_country if
    sum(1 for r in by_country[c] if r.get("had_challenges") in ["Yes", "Minor"]) /
    max(sum(1 for r in by_country[c] if r.get("had_challenges") in ["Yes", "Minor", "No"]), 1)
    >= 0.6]

if high_risk:
    print(f"  1. HIGH RISK countries: {', '.join(sorted(high_risk))}")
    print(f"     These countries need extra visa support before placement.")

after_arrival = sum(1 for r in records if r.get("before_or_after_arrival") == "After Arrival")
pct_after = round(after_arrival / len(records) * 100)
print(f"  2. {pct_after}% of fellows arrived without proper visa documentation.")
print(f"     Fellows working on tourist visas face legal risk from day one.")

inconsistent_countries = [c for c in by_country
    if len(set(r["visa_type"] for r in by_country[c] if r.get("visa_type"))) > 1]
if inconsistent_countries:
    print(f"  3. INCONSISTENT visa types in: {', '.join(sorted(inconsistent_countries))}")
    print(f"     Fellows at same organizations receiving different visa types.")

fellow_paid = sum(1 for r in records if r.get("who_paid") == "Fellow")
if fellow_paid > 0:
    print(f"  4. {fellow_paid} fellow(s) paid visa costs themselves.")
    print(f"     Organizations should be contractually required to cover all costs.")

print("\nAnalysis complete. Ready to build the dashboard.")
print("Next step: set up Supabase and load your data.")