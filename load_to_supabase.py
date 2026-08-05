import json
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Connected to Supabase!")

with open("visa_clean.json", "r") as f:
    clean_records = json.load(f)

print(f"Loaded {len(clean_records)} records from visa_clean.json")

# ── DUPLICATE PREVENTION ───────────────────────────────────
# Pull every "file" value already sitting in the database, then only
# insert records whose file isn't in that set. This lets you re-run the
# whole pipeline (extract -> anonymize -> load) any time you add new
# reports, without ever double-counting a report that's already in.

try:
    existing = supabase.table("visa_records").select("file").execute()
except Exception as e:
    print("\nERROR: could not read the 'file' column from visa_records.")
    print("This usually means your Supabase table doesn't have a 'file' column yet.")
    print("Fix: in Supabase, open Table Editor -> visa_records -> Add column")
    print("     name: file   type: text")
    print(f"\n(Original error: {e})")
    raise SystemExit(1)

existing_files = set(r["file"] for r in existing.data if r.get("file"))

already_in_db = [r for r in clean_records if r.get("file") in existing_files]
new_records = [r for r in clean_records if r.get("file") not in existing_files]

print(f"Already in database: {len(already_in_db)}")
print(f"New records to insert: {len(new_records)}")

# ── LOCAL-ONLY QUALITY FLAGS ───────────────────────────────
# anonymize.py adds "is_suspected_duplicate" and "duplicate_of" so you get a
# duplicate warning in the terminal. Those columns don't exist in Supabase and
# adding them would force a schema change, so we strip them before inserting.
# The dashboard re-detects duplicates on its own using the same rule, so
# nothing is lost by leaving them out of the database.

LOCAL_ONLY_FIELDS = ("is_suspected_duplicate", "duplicate_of")


def for_database(record):
    return {k: v for k, v in record.items() if k not in LOCAL_ONLY_FIELDS}


inserted = 0

if not new_records:
    print("Nothing to insert. The database is already up to date.")
else:
    batch_size = 20
    for i in range(0, len(new_records), batch_size):
        batch = [for_database(r) for r in new_records[i:i + batch_size]]
        supabase.table("visa_records").insert(batch).execute()
        inserted += len(batch)
        print(f"Inserted {inserted} of {len(new_records)} new records...")

    print(f"\nDone. {inserted} new records added to the database.")

print(f"\nSummary: {len(already_in_db)} already existed, "
      f"{len(new_records)} were new, {inserted} inserted.")

flagged = [r for r in clean_records if r.get("is_suspected_duplicate")]
if flagged:
    print(f"\nHeads up: {len(flagged)} report(s) look like duplicates of another "
          f"report. They were still loaded. Run anonymize.py to see which ones.")
