# Plan: GitHub to Hostico Auto-Deployment

## Goal
Set up continuous deployment so that pushing to the `main` branch automatically deploys the frontend and backend to Hostico (negociator.site).

## Approach Chosen
**GitHub Actions with FTP sync**
It is the robust way because compiling `Vite` (`npm run build`) takes RAM, which shared Hostico plans sometimes throttle or kill. By building it on GitHub's free powerful runners, we guarantee successful builds and simply sync the ready-to-run files via FTP.

## Steps
- [x] 1. Create `.github/workflows/deploy.yml`.
- [x] 2. The workflow will: Checkout code -> Install Node -> `npm install` -> `npm run build` -> Sync files to Hostico via FTP -> Restart Node.js backend.
- [x] 3. Create a helper for Passenger Node.js restart (`tmp/restart.txt`).
- [x] 4. Instruct user to add their FTP secrets in GitHub Settings.
- [x] 5. Instruct user to ensure cPanel Node.js App is correctly pointing to `server.js`.

