STEP-BY-STEP (NO COMMANDS NEEDED)

1) Install Node.js
   - Open https://nodejs.org/
   - Download the LTS version (green button)
   - Run the installer > Next > Next > Install > Close

2) Extract this ZIP
   - Right click the ZIP > Extract All...
   - Choose a simple path like Desktop\crazy-time-miniapp
   - Open the extracted folder

3) Start the app locally
   - Double click:  start-dev.bat
   - The first time it will install dependencies; then it opens a local URL (e.g., http://localhost:5173)
   - Keep this window open while testing. Press Ctrl+C in that window to stop.

4) Add sounds (optional)
   - Put files into public\sounds\
       - click.mp3
       - roll_loop.mp3
       - win.mp3

5) Build production files (for deployment)
   - Double click:  build-production.bat
   - When finished, a 'dist' folder appears. This folder is what you deploy.

6) Deploy without CLI (easiest)
   Option A: Netlify Drop (drag-and-drop)
     - Go to https://app.netlify.com/drop
     - Drag the 'dist' folder into the page
     - It will give you a live HTTPS URL you can use in BotFather (/setdomain and /setmenubutton).

   Option B: Vercel (GUI)
     - Go to https://vercel.com/dashboard
     - New Project > Import from Git (GitHub) OR use Vercel CLI if you prefer
     - If using GitHub: create a repo, upload project files, link it in Vercel, and set Framework = Vite.
