import pdfplumber  
import json        
import os          
import re

def extract_text(filepath):
    """
    Open a PDF file and return all the text as one big string.
    We combine all pages because some answers span across pages.
    """
    
    text = ""  
    
    with pdfplumber.open(filepath) as pdf:
        
        for page in pdf.pages:
            
            page_text = page.extract_text()
            
            if page_text:
               
                
                text += page_text + "\n"
                
    return text

# EXTRACT ONE FIELD 

def extract_field(text, start_phrase, end_phrase, max_length=500):
    """
    Find the answer to one specific question in the report text.
    
    How it works:
    - Find where the question starts
    - Find where the next question starts  
    - Everything in between is the answer
    
    Inputs:
    - text: the full report text (from extract_text above)
    - start_phrase: the question we are looking for
    - end_phrase: the next question after it (tells us where answer ends)
    - max_length: if we can not find the next question, 
    only take this many characters (stops us grabbing too much)
    """
    
    start_index = text.lower().find(start_phrase.lower())
    
    
    if start_index == -1:
        return None
    
    
    start_index += len(start_phrase)
    end_index = text.lower().find(end_phrase.lower(), start_index)
    
    if end_index == -1:
        answer = text[start_index:start_index + max_length]
    else:
        answer = text[start_index:end_index]
    
    
    return strip_question_label(answer)
   


#CLEAN UP EXTRACTION ARTIFACTS 

LABEL_AT_END = re.compile(r"\s*\b[a-zA-Z]\s*\)\s*$")
LABEL_AT_START = re.compile(r"^\s*\b[a-zA-Z]\s*\)\s*")


def strip_question_label(answer):
    """
    Remove a stray question-numbering label such as "g)" from an answer,
    then return the cleaned text (or None if nothing meaningful is left).
    """
    if answer is None:
        return None

    cleaned = answer.strip()
    cleaned = LABEL_AT_END.sub("", cleaned)
    cleaned = LABEL_AT_START.sub("", cleaned)
    cleaned = cleaned.strip()

    return cleaned if cleaned else None

NON_ANSWERS = {
    "?", "??", "-", "--", ".", "..", "n/a", "na", "n.a.",
    "none", "none.", "nothing", "no comment", "no comments",
}


def clean_narrative(answer):
    """
    Extra cleaning for the two long free-text fields (challenge_details and
    advice_for_future_fellows).

    Unlike the short fields, a placeholder like "?" here is noise: it would be
    rendered in the dashboard as if the Fellow had written real guidance.
    Short yes/no fields must NOT go through this function. "No" is a valid
    answer to "are you having challenges", but would look like a non-answer.
    """
    cleaned = strip_question_label(answer)
    if cleaned is None:
        return None

    if cleaned.strip().lower().rstrip(".") in NON_ANSWERS:
        return None

    return cleaned


# FUNCTION 3: FIND THE YEAR 

def extract_year(text, filename):
    """
    Try to find which year this report is from.
    We need this for trend analysis later, comparing 2021 vs 2024.
    
    We check two places:
    1. The filename (many files have the year in the name)
    2. The fellowship start date inside the report
    """
    
    year_match = re.search(r'20\d{2}', filename)
   
    if year_match:
        return year_match.group()
    
    start_date = extract_field(text, "Fellowship Start Date\n", "Anticipated")
   
    
    if start_date:
        year_match = re.search(r'20\d{2}', start_date)
        if year_match:
            return year_match.group()
    
    return "Unknown"
   


# FUNCTION 4: FIND THE REPORT TYPE 

def extract_report_type(text):
    """
    Figure out if this is a 3-month, 6-month, or 9-month report.
    PIAF requires fellows to submit reports at 3, 6, and 9 months.
    Knowing which one helps us understand where in the year this was.
    """
    
    text_lower = text.lower()
   
    
    if "9-month" in text_lower or "9 month" in text_lower:
        return "9-month"
    elif "6-month" in text_lower or "6 month" in text_lower:
        return "6-month"
    elif "3-month" in text_lower or "3 month" in text_lower:
        return "3-month"
    return "Unknown"


# FUNCTION 5: PROCESS ONE COMPLETE REPORT

def process_report(filepath):
    """
    Extract ALL visa fields from one report.
    Calls all the functions above and packages everything 
    into one dictionary (like one row in a spreadsheet).
    
    A dictionary stores data as key-value pairs:
    {"country": "Kenya", "visa_type": "Work Permit"}
    Think of keys as column names and values as the cell content.
    """
    
    filename = os.path.basename(filepath)
    
    print(f"  Processing: {filename}")
    
    
    text = extract_text(filepath)
    visa_type = (
        extract_field(text, 
            "What kind of visa/ permit do you have or applied for?", 
            "How did you obtain") 
        or
        extract_field(text, 
            "What kind of visa/permit do you have", 
            "How did you obtain")
    )
    
    how_obtained = (
        extract_field(text, 
            "How did you obtain (or are obtaining) your visa or permit?", 
            "Did you apply for and receive") 
        or
        extract_field(text, 
            "How did you obtain (or are obtaining) your visa", 
            "Did you apply for")
    )
    
    before_after = (
        extract_field(text, 
            "to your host country or after arriving?", 
            "What costs were associated") 
        or
        extract_field(text, 
            "before going to your host country or after arriving", 
            "What costs were associated")
    )
    
    who_paid = (
        extract_field(text, 
            "Did you pay the visa / permit costs or were they covered by your organization?", 
            "Are you still having challenges") 
        or
        extract_field(text, 
            "Did you pay the visa/permit costs", 
            "Are you having challenges")
    )
    
    had_challenges = (
        extract_field(text, 
            "Are you still having challenges obtaining your visa/ permit?", 
            "If yes, please explain") 
        or
        extract_field(text, 
            "Are you having challenges obtaining your visa", 
            "Please explain these challenges")
    )
    
    challenge_details = clean_narrative(
        extract_field(text,
            "If yes, please explain further",
            "Do you have any suggestions")
        or
        extract_field(text,
            "Please explain these challenges further",
            "Do you have any suggestions")
    )

    advice = clean_narrative(
        extract_field(text,
            "/ permit application process?",
            "What vaccinations")
        or
        extract_field(text,
            "permit application process",
            "What vaccinations")
    )
    
    record = {
        "file": filename,
        
        "report_type": extract_report_type(text),
        
        "year": extract_year(text, filename),
        
        "organization": extract_field(
            text, "Fellowship Organization\n", "Fellowship City"),
        
        "country": extract_field(
            text, "Fellowship Country\n", "Fellowship Start Date"),
        
        "visa_type": visa_type,
        "how_obtained": how_obtained,
        "before_or_after_arrival": before_after,
        "who_paid": who_paid,
        "had_challenges": had_challenges,
        "challenge_details": challenge_details,
        "advice_for_future_fellows": advice,
    }
    
    return record
    


# MAIN SCRIPT
print("=== PIAF VISA DATA EXTRACTOR ===")
print("Starting extraction...\n")

all_records = []

failed_files = []


if os.path.exists("reports"):


    pdf_files = [f for f in os.listdir("reports") if f.lower().endswith(".pdf")]
    

    print(f"Found {len(pdf_files)} PDF reports in the reports folder")
    print("Processing each one now...\n")
    
    for filename in sorted(pdf_files):

        filepath = os.path.join("reports", filename)
       

        try:
           

            record = process_report(filepath)
            

            all_records.append(record)
           

        except Exception as e:
           

            print(f"  ERROR processing {filename}: {e}")
            failed_files.append(filename)
           

else:
    print("No 'reports' folder found.")
    print("Please create a folder called 'reports' and put your PDFs inside it.")
    print("Then run this script again.")


# SAVE THE RAW EXTRACTED DATA 

with open("visa_raw.json", "w") as f:
    json.dump(all_records, f, indent=2)


# PRINT A SUMMARY 

print(f"\n=== EXTRACTION COMPLETE ===")
print(f"Successfully processed: {len(all_records)} reports")

if failed_files:
    print(f"\nFailed to process {len(failed_files)} files:")
    for f in failed_files:
        print(f"  - {f}")
    print("Check these files manually to see what went wrong.")

print(f"\nRaw data saved to: visa_raw.json")
print("Open visa_raw.json in VS Code to inspect your extracted data.")
print("\nNext step: run python3 anonymize.py")

print("\n--- PREVIEW OF EXTRACTED DATA ---")

countries_found = [r["country"] for r in all_records if r.get("country")]


unique_countries = sorted(set(countries_found))


print(f"\nCountries found ({len(unique_countries)} total):")
for country in unique_countries:
    count = countries_found.count(country)
    
    print(f"  {country}: {count} report(s)")

visa_types_found = [r["visa_type"] for r in all_records if r.get("visa_type")]
unique_visa_types = sorted(set(visa_types_found))

print(f"\nVisa types found ({len(unique_visa_types)} total):")
for vtype in unique_visa_types:
    count = visa_types_found.count(vtype)
    print(f"  {vtype}: {count} report(s)")

challenges_found = [r["had_challenges"] for r in all_records if r.get("had_challenges")]
yes_count = sum(1 for c in challenges_found if "yes" in c.lower())
no_count = sum(1 for c in challenges_found if c.lower() == "no")


print(f"\nChallenge summary:")
print(f"  Had challenges: {yes_count}")
print(f"  No challenges: {no_count}")
if yes_count + no_count > 0:
    rate = round(yes_count / (yes_count + no_count) * 100)
    print(f"  Complication rate: {rate}%")