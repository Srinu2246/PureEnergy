# AI Log

## Tools used

- Copilot SDK in VS Code for code and documentation changes.
- Firebase CLI to inspect the existing Firestore database and deploy Hosting.
- Pylance-selected Python environment to validate the 40-row CSV without writing
  to Firestore.
- Playwright browser checks for the sign-in flow and deployed Hosting page.
- Node.js module syntax check, TypeScript check, and Next.js production build.

## Three useful prompts

1. “Check the Firebase authentication message in the screenshot and add
   dashboard routes.”
2. “Add email/password and Google sign-in while keeping Firestore
   authentication-required.”
3. “Compare the assignment phases with the existing project and implement the
   missing work clearly.”

## An AI mistake and correction

An initial dashboard route used a catch-all path without static parameters.
Because this project exports a static site, the production build failed. The
build output identified the missing `generateStaticParams()` requirement; the
dashboard route was updated to enumerate its supported paths, and the build
then completed successfully.
