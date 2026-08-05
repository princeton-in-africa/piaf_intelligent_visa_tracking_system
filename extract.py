# ── IMPORTS ───────────────────────────────────────────────
# "import" means "load this tool so I can use it in my code"
# Think of it like opening an app before you use it

import pdfplumber  
# pdfplumber is the tool that reads PDF files and gets the text out
# You installed this earlier with: pip3 install pdfplumber

import json        
# json is a way of saving data as text so you can read it later
# It comes with Python automatically, no installation needed

import os          
# os lets you work with files and folders on your computer
# Like checking if a folder exists or listing files inside it

import re
# re stands for "regular expressions"
# It lets you search for patterns in text
# For example: find any 4-digit number that starts with 20 (like 2023)


# ── FUNCTION 1: READ A PDF ────────────────────────────────
# A function is a reusable block of code that does one specific job
# You define it once and can call it as many times as you want
# "def" means "define a new function"
# "filepath" is the input: the location of the PDF on your computer

def extract_text(filepath):
    """
    Open a PDF file and return all the text as one big string.
    We combine all pages because some answers span across pages.
    """
    
    text = ""  
    # Create an empty string called "text"
    # We will keep adding text from each page into this variable
    # A variable is just a named container that holds a value
    
    with pdfplumber.open(filepath) as pdf:
        # "with" opens the PDF file safely
        # If something goes wrong, Python automatically closes the file
        # "as pdf" gives the opened file the nickname "pdf" 
        # so we can refer to it below
        
        for page in pdf.pages:
            # "for" is a loop: it repeats the code below for each page
            # pdf.pages is a list of all pages in the document
            # Each time the loop runs, "page" is one page from that list
            
            page_text = page.extract_text()
            # extract_text() reads all the text on this single page
            # and stores it in a variable called "page_text"
            
            if page_text:
                # "if page_text" means "if this page actually has text"
                # Some pages might be blank or just have images
                # We skip those because there is nothing useful to extract
                
                text += page_text + "\n"
                # "+=" means "add this to what is already in text"
                # We add the page text plus a new line character "\n"
                # "\n" is how you tell Python to start a new line
                # This separates the text from different pages
    
    return text
    # "return" sends the result back to whoever called this function
    # So when you call extract_text("report.pdf"), 
    # you get back one big string with all the text from all pages


# ── FUNCTION 2: EXTRACT ONE FIELD ─────────────────────────

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
    # text.lower() converts all text to lowercase
    # Why? So "Visa" and "visa" and "VISA" all match
    # .find() searches for the start_phrase inside the text
    # It returns the position (index) where the phrase starts
    # For example if "visa" starts at character 500, start_index = 500
    # If the phrase is NOT found, .find() returns -1
    
    if start_index == -1:
        return None
    # If start_index is -1, the question was not found in this report
    # "return None" means "return nothing": this field is empty
    # None is Python's way of saying "no value here"
    
    start_index += len(start_phrase)
    # Move start_index forward past the question itself
    # We do not want the question text, we want the answer after it
    # len(start_phrase) gives us the length of the question
    # Adding it to start_index skips past the question to where answer begins
    
    end_index = text.lower().find(end_phrase.lower(), start_index)
    # Now find where the NEXT question starts
    # That is where our answer ends
    # The second argument "start_index" tells .find() where to start searching
    # So it only looks AFTER our current question, not before it
    
    if end_index == -1:
        answer = text[start_index:start_index + max_length]
    else:
        answer = text[start_index:end_index]
    # text[start_index:end_index] is called "slicing"
    # It grabs just the part of the text between those two positions
    # Like cutting a sentence: take everything from position A to position B
    # If we could not find the end, we just take max_length characters (500)
    
    return strip_question_label(answer)
    # Removes surrounding whitespace AND any leftover question-numbering label
    # (see strip_question_label below for why this is necessary)


# ── FUNCTION 2b: CLEAN UP EXTRACTION ARTIFACTS ────────────

# The report form numbers its questions with letters, and the label sits on the
# SAME line as the question text, like this:
#
#     If yes, please explain further
#     g)Do you have any suggestions to help future Fellows...
#
# extract_field() slices from the end of one question to the start of the next.
# Because the "g)" label comes BEFORE the words "Do you have any suggestions",
# that stray label lands at the end of the answer. When the Fellow left the
# question blank, the entire "answer" ends up being the single string "g)".
#
# That is how 11 of 21 records ended up with challenge_details == "g)":
# it was never real content, just the next question's label.

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


# Answers that technically contain characters but carry no information.
# These appear when a Fellow types a placeholder instead of leaving it blank.
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


# ── FUNCTION 3: FIND THE YEAR ─────────────────────────────

def extract_year(text, filename):
    """
    Try to find which year this report is from.
    We need this for trend analysis later, comparing 2021 vs 2024.
    
    We check two places:
    1. The filename (many files have the year in the name)
    2. The fellowship start date inside the report
    """
    
    year_match = re.search(r'20\d{2}', filename)
    # re.search() looks for a pattern anywhere in the text
    # r'20\d{2}' is a pattern that means:
    #   20 = literally the number 20
    #   \d = any digit (0-9)
    #   {2} = exactly 2 of those digits
    # So it matches: 2021, 2022, 2023, 2024, 2025, 2026 etc.
    
    if year_match:
        return year_match.group()
    # .group() returns the actual text that matched the pattern
    # For example if "2023" was found, this returns the string "2023"
    
    start_date = extract_field(text, "Fellowship Start Date\n", "Anticipated")
    # If the year is not in the filename, look inside the report
    # The Fellowship Start Date field usually contains the year
    
    if start_date:
        year_match = re.search(r'20\d{2}', start_date)
        if year_match:
            return year_match.group()
    
    return "Unknown"
    # If we still could not find the year, return "Unknown"
    # This is better than crashing, the record still gets saved


# ── FUNCTION 4: FIND THE REPORT TYPE ──────────────────────

def extract_report_type(text):
    """
    Figure out if this is a 3-month, 6-month, or 9-month report.
    PIAF requires fellows to submit reports at 3, 6, and 9 months.
    Knowing which one helps us understand where in the year this was.
    """
    
    text_lower = text.lower()
    # Convert to lowercase once and store it
    # More efficient than converting it multiple times below
    
    if "9-month" in text_lower or "9 month" in text_lower:
        return "9-month"
    elif "6-month" in text_lower or "6 month" in text_lower:
        return "6-month"
    elif "3-month" in text_lower or "3 month" in text_lower:
        return "3-month"
    return "Unknown"
    # "in" checks if a phrase exists anywhere in the text
    # We check both "9-month" and "9 month" because 
    # different reports format it differently


# ── FUNCTION 5: PROCESS ONE COMPLETE REPORT ───────────────

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
    # os.path.basename() gets just the filename without the folder path
    # For example: "/reports/Kenya_2023.pdf" becomes "Kenya_2023.pdf"
    
    print(f"  Processing: {filename}")
    # f"..." is an f-string: it lets you put variables inside text
    # {filename} gets replaced with the actual filename value
    # This prints progress so you can see what is happening
    
    text = extract_text(filepath)
    # Call our first function to get all the text from this PDF
    # Now "text" contains everything written in the entire report
    
    # Now we extract each visa field one by one
    # For each field we call extract_field with:
    # 1. The full report text
    # 2. The question we are looking for  
    # 3. The next question after it (so we know where the answer ends)
    
    # The "or" pattern handles different phrasings across different years
    # Some years say "visa/ permit" others say "visa/permit"
    # We try the first version, and if it returns None we try the second
    
    visa_type = (
        extract_field(text, 
            "What kind of visa/ permit do you have or applied for?", 
            "How did you obtain") 
        or
        extract_field(text, 
            "What kind of visa/permit do you have", 
            "How did you obtain")
    )
    # The parentheses let us write this across multiple lines for readability
    # "or" means: try the first extract_field, 
    # if it returns None try the second one
    
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
    
    # Package everything into a dictionary
    # This is like one row in a spreadsheet
    # Each key is a column name, each value is what we extracted
    record = {
        "file": filename,
        # Which file this came from, useful for debugging
        
        "report_type": extract_report_type(text),
        # 3-month, 6-month, or 9-month
        
        "year": extract_year(text, filename),
        # Which cohort year, important for trend analysis
        
        "organization": extract_field(
            text, "Fellowship Organization\n", "Fellowship City"),
        # The host organization name
        
        "country": extract_field(
            text, "Fellowship Country\n", "Fellowship Start Date"),
        # The host country
        
        "visa_type": visa_type,
        "how_obtained": how_obtained,
        "before_or_after_arrival": before_after,
        "who_paid": who_paid,
        "had_challenges": had_challenges,
        "challenge_details": challenge_details,
        "advice_for_future_fellows": advice,
    }
    
    return record
    # Return the complete dictionary for this report


# ── MAIN SCRIPT ───────────────────────────────────────────
# Everything above was defining functions, preparing tools
# This section actually RUNS the extraction
# Python executes this code from top to bottom when you run the file

print("=== PIAF VISA DATA EXTRACTOR ===")
print("Starting extraction...\n")
# Print a header so you know the script started

all_records = []
# Create an empty list to collect all records
# A list is an ordered collection, like a spreadsheet with rows
# We will add one record (dictionary) per report

failed_files = []
# A separate list to track any files that caused errors
# So we can go back and fix them

if os.path.exists("reports"):
    # os.path.exists() checks if a folder called "reports" exists
    # Returns True if it exists, False if it does not

    pdf_files = [f for f in os.listdir("reports") if f.lower().endswith(".pdf")]
    # os.listdir("reports") returns a list of everything in the reports folder
    # [f for f in ... if f.endswith(".pdf")] is a list comprehension
    # It means: go through every file, keep only the ones ending in ".pdf"
    # This filters out any non-PDF files like .DS_Store on Mac

    print(f"Found {len(pdf_files)} PDF reports in the reports folder")
    print("Processing each one now...\n")
    # len() counts how many items are in the list

    for filename in sorted(pdf_files):
        # sorted() puts the files in alphabetical order
        # This makes the output consistent and easier to read

        filepath = os.path.join("reports", filename)
        # os.path.join() creates the full file path
        # "reports" + "Kenya_2023.pdf" becomes "reports/Kenya_2023.pdf"
        # This works on both Mac and Windows (handles / vs \ automatically)

        try:
            # "try" means: attempt the code below
            # If it crashes, go to "except" instead of stopping everything

            record = process_report(filepath)
            # Call our process_report function on this file
            # Get back a dictionary with all the extracted visa fields

            all_records.append(record)
            # .append() adds the record to our list
            # Like adding a new row to a spreadsheet

        except Exception as e:
            # "except" catches any error that happened in the "try" block
            # "Exception as e" captures the error message in variable "e"

            print(f"  ERROR processing {filename}: {e}")
            failed_files.append(filename)
            # Add this file to our failed list so we know to investigate it
            # The script keeps running rather than stopping

else:
    print("No 'reports' folder found.")
    print("Please create a folder called 'reports' and put your PDFs inside it.")
    print("Then run this script again.")


# ── SAVE THE RAW EXTRACTED DATA ───────────────────────────

with open("visa_raw.json", "w") as f:
    json.dump(all_records, f, indent=2)
# open("visa_raw.json", "w") opens a file for writing
# "w" means write mode: creates the file if it does not exist
# json.dump() converts our list of dictionaries into JSON text and saves it
# indent=2 makes the JSON file readable with proper indentation
# This file is your raw extraction before any cleaning


# ── PRINT A SUMMARY ───────────────────────────────────────

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

# Show a preview of what countries and orgs were found
print("\n--- PREVIEW OF EXTRACTED DATA ---")

countries_found = [r["country"] for r in all_records if r.get("country")]
# This is a list comprehension: it goes through every record
# and collects the "country" value if it exists
# Result: a list like ["Kenya", "South Africa", "Kenya", "Rwanda", ...]

unique_countries = sorted(set(countries_found))
# set() removes duplicates, so "Kenya" only appears once
# sorted() puts them in alphabetical order

print(f"\nCountries found ({len(unique_countries)} total):")
for country in unique_countries:
    count = countries_found.count(country)
    # .count() tells us how many times this country appears in the list
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
# sum(1 for ...) counts how many items match a condition
# "yes" in c.lower() checks if the word "yes" appears anywhere in the answer

print(f"\nChallenge summary:")
print(f"  Had challenges: {yes_count}")
print(f"  No challenges: {no_count}")
if yes_count + no_count > 0:
    rate = round(yes_count / (yes_count + no_count) * 100)
    print(f"  Complication rate: {rate}%")