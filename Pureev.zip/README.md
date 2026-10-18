Kandi

# PuRE Energy Dealer Lead Router

Live app: <https://srinu2246-ddd87.web.app>

## What is implemented

- Firebase email/password registration and sign-in, Google sign-in, and sign-out.
- Dashboard loads only for signed-in users and reads leads in real time.
- Lead form validates 10-digit mobile numbers and 6-digit pincodes. It removes
  spaces, hyphens, and an optional `+91` prefix from the mobile before saving.
- The normalized 10-digit phone is the Firestore document ID, preventing a
  second lead with the same phone.
- Dealer assignment matches the first three pincode digits against
  the Firestore `dealers` collection's `pincode_prefixes` values separated by
  `|`; unknown prefixes go to In-house Sales. Before the official dealer file
  is loaded, the app clearly warns and uses the prior built-in mapping.
- Dashboard shows lead totals by status and dealer, and status dropdowns update
  Firestore.
- CSV Cleaner keeps the uploaded headers and column positions, removes blank
  and exact duplicate records, and uses a scrollable preview of the same rows
  written to the cleaned download. Headerless files use `Column N` labels.
- Firestore rules require authentication, validate lead fields, allow status
  changes only, and deny deletes.

## Run locally

Install dependencies with `pnpm install`, then start the Next.js app:

```powershell
pnpm dev
```

Open `http://localhost:3000`. The separate static Firebase Hosting app is in
`public/`; its public Firebase Web configuration is in `public/app.js`. Web
configuration is not a service-account key. Never put a service-account key in
client code or commit one.

In Firebase Console, enable **Email/Password** and **Google** in **Authentication
→ Sign-in method**. Add `localhost` and `srinu2246-ddd87.web.app` to
**Authentication → Settings → Authorized domains** for Google sign-in.

## Firebase and data

The project uses the existing `(default)` Firestore database in Standard
edition, located in `asia-south1` (Mumbai). `firebase.json` points to
`firestore.rules`; `firebase deploy --only hosting` publishes the static `public/`
app. Firestore rules must remain authentication-required. Do not replace them
with public test rules.

Account registration is open in the current sign-in screens, and the current
rules let any authenticated account read all leads and submit leads. Restrict
registration or add trusted role-based access rules before sharing customer
data beyond the intended workspace.

`data/dealers.csv` contains the supplied dealer directory, including dealer ID,
name, city, pincode prefixes, and contact email. Prefixes must be three-digit
strings separated by `|`. The signed-in app reads dealer documents from
Firestore and uses the prefix list to route new leads; if the collection is
empty or unavailable, it clearly warns and uses the built-in fallback list.
The CSV importer preserves optional city and contact email fields on dealer
documents. The `/dashboard/dealers` page displays that directory and each
dealer's assigned lead count.

After placing a local `serviceAccountKey.json` in the project root, validate
and seed the read-only `dealers` collection:

```powershell
python seed_dealers.py
python seed_dealers.py --apply
```

The first command validates without writing. The second seeds or updates the
dealer documents using the Admin SDK. It does not delete existing dealers.
Clients may read dealers after sign-in; only the trusted Admin SDK can write
them. The app continues to show an explicit warning when the collection is
empty or invalid.

## Legacy lead import

The input `data/legacy_leads.csv` contains 40 rows. First run a safe local
validation; it does not connect to Firestore:

```powershell
python clean_leads.py --dry-run
```

This writes `reports/reconciliation.csv`, with one result for each input row
and a header. Current validation finds 36 valid rows and 4 rejected rows (one
each for invalid mobile, pincode, date, and missing name); among valid rows,
five repeat a mobile, six need normalization, and one routes to In-house Sales.
These counts are based on the provided CSV and the current dealer list.

To import after reviewing the report, put a Firebase service-account key at
`serviceAccountKey.json` (already ignored by Git), then run:

```powershell
python clean_leads.py
```

The live import writes directly to the configured project's `leads` collection.
Do not run it until you have reviewed the report and confirmed the target
project and data.

## Assignment deliverables and remaining input

- `AI_LOG.md`: tools, example prompts, and one corrected AI mistake.
- `NOTE.md`: a short next-feature proposal.
- `submission.json`: submission details and live URL. Confirm the name is your
  full name before submitting.
- Needed to use official dealer prefixes: the assignment's `dealers.csv`.
- Needed to seed dealers or run the live legacy import: a locally stored
  service-account key.

## Deploy

Deploy the validated authenticated-only rules, then publish the static app:

```powershell
firebase deploy --only firestore:rules
firebase deploy --only hosting
```

The rules allow signed-in users to read dealers and leads, deny client-side
dealer writes and lead deletes, validate lead creation, and limit lead updates
to valid status changes. They are a security prototype, not a complete
role-based access policy.
