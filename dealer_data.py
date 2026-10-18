import csv
import re
from pathlib import Path


FALLBACK_DEALERS = [
    {"id": "D01", "name": "Sri Sai Power Solutions", "city": "Hyderabad", "pincode_prefixes": "500", "contact_email": "d01@example.com"},
    {"id": "D02", "name": "Kandi Energy Point", "city": "Sangareddy", "pincode_prefixes": "502", "contact_email": "d02@example.com"},
    {"id": "D03", "name": "Warangal Green Systems", "city": "Warangal", "pincode_prefixes": "506", "contact_email": "d03@example.com"},
    {"id": "D04", "name": "Karimnagar Solar Hub", "city": "Karimnagar", "pincode_prefixes": "505", "contact_email": "d04@example.com"},
    {"id": "D05", "name": "Vizag Home Power", "city": "Visakhapatnam", "pincode_prefixes": "530|531", "contact_email": "d05@example.com"},
    {"id": "D06", "name": "Krishna Energy Store", "city": "Vijayawada", "pincode_prefixes": "520|521", "contact_email": "d06@example.com"},
    {"id": "D07", "name": "Guntur Battery World", "city": "Guntur", "pincode_prefixes": "522", "contact_email": "d07@example.com"},
    {"id": "D08", "name": "Tirupati PowerHouse", "city": "Tirupati", "pincode_prefixes": "517", "contact_email": "d08@example.com"},
]


def load_dealers_csv(path: Path) -> list[dict[str, str]]:
    """Load and validate dealer rows from the assignment CSV."""
    if not path.is_file():
        raise FileNotFoundError(f"Dealer CSV not found: {path}")

    dealers = []
    ids = set()
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames:
            raise ValueError("Dealer CSV must include a header row.")

        columns = {column.strip().casefold(): column for column in reader.fieldnames if column}
        id_column = columns.get("dealer_id") or columns.get("id")
        name_column = columns.get("name") or columns.get("dealer_name")
        prefix_column = columns.get("pincode_prefixes")
        phone_column = columns.get("phone")
        city_column = columns.get("city")
        email_column = columns.get("contact_email")
        if not name_column or not prefix_column:
            raise ValueError("Dealer CSV must include name and pincode_prefixes columns.")

        for row_number, row in enumerate(reader, start=2):
            name = (row.get(name_column) or "").strip()
            prefixes = (row.get(prefix_column) or "").strip()
            dealer_id = (row.get(id_column) or "").strip() if id_column else f"D{len(dealers) + 1:02d}"
            phone = (row.get(phone_column) or "").strip() if phone_column else ""
            city = (row.get(city_column) or "").strip() if city_column else ""
            contact_email = (row.get(email_column) or "").strip() if email_column else ""

            if not dealer_id or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", dealer_id):
                raise ValueError(f"Invalid dealer ID on CSV row {row_number}.")
            if dealer_id in ids:
                raise ValueError(f"Duplicate dealer ID on CSV row {row_number}.")
            if not name or len(name) > 100:
                raise ValueError(f"Dealer name is missing or too long on CSV row {row_number}.")
            if not re.fullmatch(r"[0-9]{3}(?:\|[0-9]{3})*", prefixes):
                raise ValueError(f"Invalid pincode_prefixes on CSV row {row_number}; use 3-digit prefixes separated by |.")
            if phone and len(phone) > 20:
                raise ValueError(f"Dealer phone is too long on CSV row {row_number}.")

            dealer = {"id": dealer_id, "name": name, "pincode_prefixes": prefixes}
            if city:
                dealer["city"] = city
            if contact_email:
                dealer["contact_email"] = contact_email
            if phone:
                dealer["phone"] = phone
            dealers.append(dealer)
            ids.add(dealer_id)

    if not dealers:
        raise ValueError("Dealer CSV contains no dealer rows.")
    return dealers
