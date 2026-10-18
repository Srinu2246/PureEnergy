import argparse
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

from dealer_data import load_dealers_csv


ROOT = Path(__file__).resolve().parent
INPUT_FILE = ROOT / "data" / "dealers.csv"
SERVICE_ACCOUNT_FILE = ROOT / "serviceAccountKey.json"


def main():
    parser = argparse.ArgumentParser(description="Validate or seed dealers in Firestore.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write validated dealer documents to Firestore. Without this flag, only validate the CSV.",
    )
    args = parser.parse_args()
    dealers = load_dealers_csv(INPUT_FILE)

    if not args.apply:
        print(f"Validated {len(dealers)} dealer rows; Firestore was not changed.")
        print("Review the rows, then use --apply to seed the dealers collection.")
        return

    if not SERVICE_ACCOUNT_FILE.is_file():
        raise FileNotFoundError(
            f"Service account key not found: {SERVICE_ACCOUNT_FILE}. "
            "Store it locally; do not upload or commit it."
        )

    credential = credentials.Certificate(str(SERVICE_ACCOUNT_FILE))
    firebase_admin.initialize_app(credential)
    database = firestore.client()
    batch = database.batch()
    for dealer in dealers:
        dealer_id = dealer["id"]
        data = {key: value for key, value in dealer.items() if key != "id"}
        batch.set(database.collection("dealers").document(dealer_id), data, merge=True)
    batch.commit()
    print(f"Seeded {len(dealers)} dealer documents in Firestore.")


if __name__ == "__main__":
    main()
