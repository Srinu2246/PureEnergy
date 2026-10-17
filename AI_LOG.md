# AI Log

## Tools and checks used

- Copilot SDK in VS Code to inspect the existing app, importer, Firestore rules,
  and assignment data, then make targeted changes.
- Firebase CLI to confirm the configured project, compile and deploy Firestore
  rules and Hosting, and publish the static app.
- `curl` to verify the live HTML and JavaScript are served successfully.
- Python `clean_leads.py --dry-run` to validate all 40 legacy rows and generate
  the reconciliation report without writing to Firestore.
- Node.js syntax check for the browser JavaScript.
- Python compilation check for the Admin SDK scripts.

## Example prompts

1. “Keep the web app and Python importer on one Firestore schema and document-ID
   strategy.”
2. “Show the dealer selected from the first three pincode digits before the
   user saves a lead.”
3. “Make a dry run produce exactly one reconciliation result per legacy input
   row without connecting to Firebase.”

## Mistake found and correction

The initial Firebase Hosting configuration pointed to `out`, a generated
Next.js export, even though the assignment requires a plain HTML, CSS, and
JavaScript app. I changed Hosting to serve `public/`, the folder containing the
Firebase modular SDK v10 app, so deployment serves the required implementation.
