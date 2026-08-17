import json
import re
import unicodedata

def clean_text(text):
    if not text:
        return text
    text = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', '[EMAIL REMOVED]', text)
    text = re.sub(r'http[s]?://\S+', '[URL REMOVED]', text)
    return text.strip()

def strip_accents(text):
    # Fellows write in French in Francophone host countries (e.g. "séjour"),
    # so we strip accents before keyword-matching to catch both spellings.
    return ''.join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))

# Organisation names are typed by hand into a Word form every cohort, so the
# same host organisation drifts across years: different capitalisation, with
# or without its acronym, and one extraction artefact (a trailing "*" on two
# 2025-26 reports). Left alone, every org-level stat on the dashboard (rate,
# visa-type consistency) silently double-counts these as
# separate organisations and understates how much evidence exists for each.
#
# This list is intentionally short. It only merges cases that are unambiguously
# the same organisation typed differently — never cases where the underlying
# real-world relationship is unclear.
#
#   - "Farming out of Poverty" vs "Farming Out of Poverty": pure capitalisation.
#   - "Lwala Community Alliance" vs "...(LCA)": full name vs. name+acronym.
#   - "Mpala Research Centre" vs "...& Wildlife Foundation": short vs. full name.
#
# What this deliberately does NOT merge: "Baylor International Pediatric AIDS
# Initiative (BIPAI)", "Baylor Eswatini", "Botswana-Baylor", and "Baylor
# (formerly BIPAI)" all look related, and so do "International Rescue
# Committee (IRC)" and "...(IRC) Kenya" / "...(IRC) Somalia". But PIAF runs
# country-specific Fellowship placements, so "Baylor Eswatini" and
# "Botswana-Baylor" may legitimately be distinct site programmes rather than
# typos of the same one — guessing wrong here would silently erase a real
# distinction. Those are left as-is and flagged for a human to confirm
# instead (see the frontend's dataQuality() organisation-naming check).
ORG_CANONICAL = {
    "farming out of poverty (foop)": "Farming Out of Poverty (FOOP)",
    "lwala community alliance (lca)": "Lwala Community Alliance",
    "mpala research centre & wildlife foundation": "Mpala Research Centre",
}


def normalize_organization(organization):
    if not organization:
        return organization
    cleaned = organization.strip().rstrip("*").strip()
    return ORG_CANONICAL.get(cleaned.lower(), cleaned)

def normalize_visa_type(visa_type):
    if not visa_type:
        return "Unknown"
    v = strip_accents(visa_type.lower().strip())

    # Order matters here: many raw answers are full sentences that mention
    # several visa-related words (e.g. "tourist visa ... applied for a
    # student pass"), so the more specific / earlier-mentioned category
    # should be checked first to avoid everything falling into a catch-all.
    if any(w in v for w in ["visa on arrival", "voa"]):
        return "Visa on Arrival"
    elif "business" in v:
        return "Business Visa"
    elif any(w in v for w in ["work permit", "work visa", "work exemption", "exemption", "employment permit", "employment visa", "class g"]):
        return "Work Permit"
    elif any(w in v for w in ["volunteer", "volunteering", "voluntary"]):
        return "Volunteer Visa"
    elif any(w in v for w in ["long stay", "long-stay", "long term visa", "long-term visa"]):
        return "Long-Stay Visa"
    elif any(w in v for w in ["tourist", "tourism", "visitor"]):
        return "Tourist Visa"
    elif any(w in v for w in ["student", "study"]):
        return "Student Visa"
    elif any(w in v for w in ["cerpac", "str visa", "residence", "residency", "resident permit", "resident visa"]):
        return "Residence Permit"
    elif any(w in v for w in ["carte", "sejour", "stay visa"]):
        return "Carte de Sejour"
    elif any(w in v for w in ["special pass"]):
        return "Special Pass"
    elif any(w in v for w in ["temporary employment"]):
        return "Temporary Employment Permit"
    elif any(w in v for w in ["category a", "category b"]):
        return "Work Permit"
    elif any(w in v for w in ["none", "n/a", "not required"]):
        return "No Visa Required"
    elif "internship pass" in v:
        return "Internship Pass"
    elif any(w in v for w in ["multi-entry", "multiple entry", "multiple-entry"]):
        return "Multi-Entry Visa"
    elif any(w in v for w in ["single-entry", "single entry"]):
        return "Single-Entry Visa"
    elif re.search(r'\beta\b', v):
        # Standalone "eTA" = Electronic Travel Authorization, a lightweight
        # entry authorization some countries use instead of a full visa.
        return "Electronic Travel Authorization (eTA)"
    elif re.fullmatch(r'[a-z]\d{1,2}', v.strip()):
        # Short alphanumeric codes like "H2" or "G1" are permit-class codes
        # used by some countries' immigration systems (e.g. Rwanda). These
        # are effectively work/residence permit classes, not truly unknown.
        return "Work Permit"
    else:
        return "Other / Unknown"

def normalize_who_paid(who_paid):
    if not who_paid:
        return "Unknown"
    w = who_paid.lower().strip()
    if any(word in w for word in ["organization", "org", "employer", "company", "school", "covered by"]):
        return "Organization"
    elif any(word in w for word in ["fellow", "myself", "i paid", "self", "out of pocket"]):
        return "Fellow"
    elif any(word in w for word in ["split", "both", "shared", "partial"]):
        return "Split"
    elif any(word in w for word in ["piaf", "princeton"]):
        return "PIAF"
    elif any(word in w for word in ["no cost", "free", "waived", "none", "n/a"]):
        return "No Cost"
    else:
        return "Unknown"

def normalize_before_after(before_after):
    if not before_after:
        return "Unknown"
    b = before_after.lower().strip()
    if "before" in b:
        return "Before Arrival"
    elif "after" in b:
        return "After Arrival"
    elif "both" in b or "during" in b:
        return "During Fellowship"
    else:
        return "Unknown"

def normalize_challenges(had_challenges):
    if not had_challenges:
        return "Unknown"
    h = had_challenges.lower().strip()
    if h in ["no", "no.", "none", "n/a", "nope"]:
        return "No"
    elif "yes" in h:
        return "Yes"
    elif any(w in h for w in ["somewhat", "minor", "slight"]):
        return "Minor"
    else:
        return "Unknown"

def content_fingerprint(record):
    """
    Build a signature from the substance of a report, ignoring the filename.

    Two different files can be the same report submitted twice (for example a
    file re-downloaded as "report (1).pdf"). Those inflate every count and
    every complication rate, so we need to notice them. We deliberately do NOT
    delete anything, because a genuine pair of Fellows at the same organization could
    legitimately give similar answers, so this is a flag for a human to judge,
    not an automatic deletion.
    """
    parts = [
        (record.get("country") or "").strip().lower(),
        (record.get("organization") or "").strip().lower(),
        (record.get("visa_type_raw") or "").strip().lower(),
        (record.get("challenge_details") or "").strip().lower(),
        (record.get("advice_for_future_fellows") or "").strip().lower(),
    ]
    signature = "||".join(parts)

    # A record with almost nothing filled in would otherwise match every other
    # sparse record, so only fingerprint records that carry real content.
    if len(signature.replace("|", "").strip()) < 40:
        return None

    return signature


def flag_duplicates(records):
    """
    Mark records whose content is identical to an earlier record.
    Adds two fields to every record so the dashboard can be explicit about it.
    """
    seen = {}
    for record in records:
        fingerprint = content_fingerprint(record)
        if fingerprint is not None and fingerprint in seen:
            record["is_suspected_duplicate"] = True
            record["duplicate_of"] = seen[fingerprint]
        else:
            record["is_suspected_duplicate"] = False
            record["duplicate_of"] = None
            if fingerprint is not None:
                seen[fingerprint] = record.get("file")
    return records


def anonymize_record(record):
    return {
        "file": record.get("file"),
        "year": record.get("year", "Unknown"),
        "report_type": record.get("report_type", "Unknown"),
        "country": record.get("country"),
        "organization": normalize_organization(record.get("organization")),
        "visa_type": normalize_visa_type(record.get("visa_type")),
        "visa_type_raw": clean_text(record.get("visa_type")),
        "obtained_where": clean_text(record.get("how_obtained")),
        "before_or_after_arrival": normalize_before_after(record.get("before_or_after_arrival")),
        "who_paid": normalize_who_paid(record.get("who_paid")),
        "had_challenges": normalize_challenges(record.get("had_challenges")),
        "challenge_details": clean_text(record.get("challenge_details")),
        "advice_for_future_fellows": clean_text(record.get("advice_for_future_fellows")),
    }

# MAIN

print("=== ANONYMIZING AND NORMALIZING VISA DATA ===\n")

with open("visa_raw.json", "r") as f:
    raw_records = json.load(f)

print(f"Loaded {len(raw_records)} raw records")

clean_records = [anonymize_record(r) for r in raw_records]
clean_records = flag_duplicates(clean_records)

with open("visa_clean.json", "w") as f:
    json.dump(clean_records, f, indent=2)

print(f"Clean records saved to visa_clean.json\n")

duplicates = [r for r in clean_records if r["is_suspected_duplicate"]]
if duplicates:
    print("=== SUSPECTED DUPLICATE REPORTS ===")
    print("These files have identical content to an earlier report.")
    print("Nothing was deleted. Review them and remove the extra PDF if the")
    print("pair really is one report submitted twice.\n")
    for r in duplicates:
        print(f"  {r['file']}")
        print(f"    matches -> {r['duplicate_of']}\n")

print("=== NORMALIZED SUMMARY ===")

print("\nVisa types (normalized):")
visa_types = [r["visa_type"] for r in clean_records if r["visa_type"]]
for vtype in sorted(set(visa_types)):
    print(f"  {vtype}: {visa_types.count(vtype)}")

print("\nWho paid:")
payers = [r["who_paid"] for r in clean_records if r["who_paid"]]
for payer in sorted(set(payers)):
    print(f"  {payer}: {payers.count(payer)}")

print("\nBefore or after arrival:")
timing = [r["before_or_after_arrival"] for r in clean_records if r["before_or_after_arrival"]]
for t in sorted(set(timing)):
    print(f"  {t}: {timing.count(t)}")

print("\nChallenge breakdown:")
challenges = [r["had_challenges"] for r in clean_records if r["had_challenges"]]
for c in sorted(set(challenges)):
    print(f"  {c}: {challenges.count(c)}")

yes = challenges.count("Yes") + challenges.count("Minor")
no = challenges.count("No")
if yes + no > 0:
    rate = round(yes / (yes + no) * 100)
    print(f"\nOverall complication rate: {rate}%")

print("\nNext step: run python3 analyze.py")