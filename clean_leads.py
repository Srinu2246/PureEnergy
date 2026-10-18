import argparse
import csv
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

from dealer_data import load_dealers_csv


ROOT = Path(__file__).resolve().parent
INPUT_FILE = ROOT / "data" / "legacy_leads.csv"
REPORT_FILE = ROOT / "reports" / "reconciliation.csv"
SERVICE_ACCOUNT_FILE = ROOT / "serviceAccountKey.json"
DEALERS_FILE = ROOT / "data" / "dealers.csv"
REPORT_COLUMNS = ["lead_id", "action", "reason"]
LEAD_COLUMNS = (
    "lead_id", "name", "phone", "pincode", "product", "source", "created_on", "status"
)

PRODUCTS = {
    "purepowerhome3kwh": "PuREPower Home 3kWh",
    "purepower3kwh": "PuREPower Home 3kWh",
    "purepowerhome5kwh": "PuREPower Home 5kWh",
    "purepower5kwh": "PuREPower Home 5kWh",
    "purepowercommercial10kwh": "PuREPower Commercial 10kWh",
    "purepower10kwh": "PuREPower Commercial 10kWh",
}
SOURCES = {
    "website": "Website",
    "voiceagent": "Voice Agent",
    "whatsapp": "WhatsApp",
    "dealerwalkin": "Dealer Walk-in",
}
STATUSES = ["New", "Contacted", "Converted", "Lost"]


def compact(value):
    """Lowercase a product or source value and remove punctuation and spaces."""
    return re.sub(r"[^a-z0-9]", "", value.strip().lower())


def normalize_phone(value):
    """Remove the supported separators and an optional +91 country prefix."""
    phone = re.sub(r"[\s-]", "", value.strip())
    if phone.startswith("+91"):
        phone = phone[3:]
    if not re.fullmatch(r"[0-9]{10}", phone):
        raise ValueError("Mobile number must contain exactly 10 digits.")
    return phone


def assign_dealer(pincode, dealers):
    """Find a dealer by the first three digits or return in-house sales."""
    prefix = pincode[:3]
    for dealer in dealers:
        prefixes = [item.strip() for item in dealer["pincode_prefixes"].split("|")]
        if prefix in prefixes:
            return dealer["id"], dealer["name"]
    return "INHOUSE", "In-house Sales"


def clean_row(row, dealers):
    """Validate and normalize one CSV row into the web app's Firestore shape."""
    original = {
        column: row.get(column, "").strip()
        if isinstance(row.get(column), str)
        else ""
        for column in LEAD_COLUMNS
    }
    lead_id = original["lead_id"]
    if not lead_id or len(lead_id) > 100:
        raise ValueError("Lead ID is required and must be at most 100 characters.")

    name = original["name"]
    if not name:
        raise ValueError("Customer name is required.")
    if len(name) > 120:
        raise ValueError("Customer name must be at most 120 characters.")

    phone = normalize_phone(original["phone"])
    pincode = original["pincode"]
    if not re.fullmatch(r"[0-9]{6}", pincode):
        raise ValueError("Pincode must contain exactly 6 digits.")

    status = original["status"].title()
    if status not in STATUSES:
        raise ValueError("Status must be New, Contacted, Converted, or Lost.")

    source_key = compact(original["source"])
    if source_key not in SOURCES:
        raise ValueError("Source is not one of the supported lead sources.")
    source = SOURCES[source_key]

    product_key = compact(original["product"])
    if product_key not in PRODUCTS:
        raise ValueError("Product is not one of the supported products.")
    product = PRODUCTS[product_key]

    created_text = original["created_on"]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", created_text):
        raise ValueError("Date must use the valid YYYY-MM-DD format.")
    try:
        created_on = datetime.strptime(created_text, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError as error:
        raise ValueError("Date must be a real calendar date in YYYY-MM-DD format.") from error

    dealer_id, dealer_name = assign_dealer(pincode, dealers)
    data = {
        "lead_id": original["lead_id"],
        "name": name,
        "phone": phone,
        "pincode": pincode,
        "product": product,
        "source": source,
        "status": status,
        "dealer_id": dealer_id,
        "dealer_name": dealer_name,
        "created_on": created_on,
    }

    changed_fields = []
    for key, value in [
        ("name", name),
        ("lead_id", original["lead_id"]),
        ("phone", phone),
        ("pincode", pincode),
        ("product", product),
        ("source", source),
        ("status", status),
    ]:
        if value != (row.get(key) or ""):
            changed_fields.append(key)
    if original["created_on"] != (row.get("created_on") or ""):
        changed_fields.append("created_on")
    return data, changed_fields, dealer_id == "INHOUSE"


def make_report_row(lead_id, action, reason):
    return {"lead_id": lead_id, "action": action, "reason": reason}


def main():
    parser = argparse.ArgumentParser(description="Clean and import legacy leads.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and write the reconciliation report without connecting to Firestore.",
    )
    args = parser.parse_args()

    if not INPUT_FILE.is_file():
        raise FileNotFoundError(f"Input CSV not found: {INPUT_FILE}")
    if not DEALERS_FILE.is_file():
        raise FileNotFoundError(f"Dealer CSV not found: {DEALERS_FILE}")
    dealers = load_dealers_csv(DEALERS_FILE)
    if not args.dry_run and not SERVICE_ACCOUNT_FILE.is_file():
        raise FileNotFoundError(
            f"Service account key not found: {SERVICE_ACCOUNT_FILE}. "
            "Download it from Firebase Console and keep it out of version control."
        )

    database = None
    if not args.dry_run:
        credential = credentials.Certificate(str(SERVICE_ACCOUNT_FILE))
        firebase_admin.initialize_app(credential)
        database = firestore.client()
    report_rows = []
    action_counts = Counter()
    seen_phones = {}

    with INPUT_FILE.open("r", encoding="utf-8-sig", newline="") as input_file:
        reader = csv.DictReader(input_file)
        if not reader.fieldnames or not set(LEAD_COLUMNS).issubset(reader.fieldnames):
            raise ValueError(f"CSV must contain these columns: {', '.join(LEAD_COLUMNS)}")

        for row in reader:
            lead_id = (row.get("lead_id") or "").strip()
            try:
                data, changed_fields, is_inhouse = clean_row(row, dealers)
            except (KeyError, ValueError) as error:
                result = make_report_row(lead_id, "rejected", str(error))
            else:
                phone = data["phone"]
                if phone in seen_phones:
                    first_name = seen_phones[phone]
                    if first_name.casefold() == data["name"].casefold():
                        reason = "Duplicate mobile number; kept the first valid row."
                    else:
                        reason = "Mobile number belongs to a different earlier name; kept the first valid row."
                    result = make_report_row(lead_id, "merged", reason)
                elif args.dry_run:
                    seen_phones[phone] = data["name"]
                    if is_inhouse:
                        result = make_report_row(
                            lead_id, "assigned_inhouse", "No dealer prefix matched; assigned to In-house Sales."
                        )
                    elif changed_fields:
                        fields = ", ".join(changed_fields)
                        result = make_report_row(
                            lead_id, "fixed", f"Imported after normalizing {fields}."
                        )
                    else:
                        result = make_report_row(lead_id, "imported", "Imported without changes.")
                else:
                    assert database is not None
                    lead_ref = database.collection("leads").document(phone)

                    transaction = database.transaction()

                    @firestore.transactional
                    def create_if_missing(current_transaction):
                        existing = lead_ref.get(transaction=current_transaction)
                        if existing.exists:
                            return False
                        current_transaction.set(lead_ref, data)
                        return True

                    created = create_if_missing(transaction)
                    if not created:
                        result = make_report_row(
                            lead_id, "merged", "Mobile number already exists in Firestore; kept the stored lead."
                        )
                    else:
                        seen_phones[phone] = data["name"]
                        if is_inhouse:
                            result = make_report_row(
                                lead_id, "assigned_inhouse", "No dealer prefix matched; assigned to In-house Sales."
                            )
                        elif changed_fields:
                            fields = ", ".join(changed_fields)
                            result = make_report_row(
                                lead_id, "fixed", f"Imported after normalizing {fields}."
                            )
                        else:
                            result = make_report_row(lead_id, "imported", "Imported without changes.")

            report_rows.append(result)
            action_counts[result["action"]] += 1

    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with REPORT_FILE.open("w", encoding="utf-8", newline="") as report_file:
        writer = csv.DictWriter(report_file, fieldnames=REPORT_COLUMNS, extrasaction="raise")
        writer.writeheader()
        writer.writerows(report_rows)

    mode = "Dry run" if args.dry_run else "Import"
    print(f"{mode} processed {len(report_rows)} input rows.")
    for action in ["imported", "fixed", "merged", "rejected", "assigned_inhouse"]:
        print(f"{action}: {action_counts[action]}")
    print(f"Reconciliation report: {REPORT_FILE}")


if __name__ == "__main__":
    main()
