# morning-routine-dashboard

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-x4hjapym)

#MorningDash26


Here's a complete guide covering all three. No code changes needed — these are runbook steps for your laptop.

1. Install Node.js and npm
Option A — Official installer (easiest, Windows/macOS)
Download the LTS installer from 
https://nodejs.org

 and run it. It bundles both node and npm.

Option B — nvm (recommended, lets you switch versions)

macOS/Linux:


curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# restart your terminal, then:
nvm install --lts
nvm use --lts
Windows: download nvm-setup.exe from 
https://github.com/coreybutler/nvm-windows/releases

, then:


nvm install lts
nvm use lts
Verify:


node -v   # expect v20.x or newer
npm -v    # expect 10.x or newer
2. Run the dashboard locally
From the project folder:


npm install
npm run dev      # dev server at http://localhost:5173
For a production preview:


npm run build
npm run preview  # serves the built app at http://localhost:4173
3. Install and run n8n locally
Option A — npm (quickest)


npm install -g n8n
n8n
Opens at 
http://localhost:5678

. Data is stored in ~/.n8n by default.

Option B — Docker (recommended for persistence)


docker volume create n8n_data
docker run -d --name n8n -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n
Visit 
http://localhost:5678

, create your owner account, and you're in.

Option C — docker-compose.yml (save in a folder, then docker compose up -d):


services:
  n8n:
    image: n8nio/n8n
    ports: ["5678:5678"]
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=changeme
      - GENERIC_TIMEZONE=America/New_York
    volumes: ["n8n_data:/home/node/.n8n"]
volumes: { n8n_data: {} }
4. Build the webhook workflow in n8n
In n8n, click Add workflow → Add first step → Webhook.
Set HTTP Method = GET, Path = morning-routine, Respond = Using 'Respond to Webhook' node.
Add a Respond to Webhook node and set Respond With = JSON, body:

{
  "emails": [
    { "id": "e1", "subject": "Invoice from Acme", "sender": "billing@acme.com",
      "snippet": "Your July invoice is ready.", "category": "unread",
      "receivedAt": "2026-07-18T09:00:00Z", "body": "Full body here." }
  ],
  "bills": [
    { "id": "b1", "vendor": "Acme", "amount": 199.00, "currency": "USD",
      "dueDate": "2026-08-01", "status": "unpaid", "invoiceRef": "INV-1001" }
  ],
  "commodities": [
    { "id": "c1", "symbol": "XAU", "name": "Gold", "unit": "oz",
      "price": 2410.50, "currency": "USD", "changePct": 0.32,
      "updatedAt": "2026-07-18T09:00:00Z" }
  ]
}
(Replace the static data with real nodes — e.g. Gmail, Email, HTTP — as you build out your morning routine.)
4. Save and Active the workflow.
5. Copy the Test URL (or Production URL) — it looks like 
http://localhost:5678/webhook/morning-routine

 (production) or /webhook-test/... (test).
6. Paste it into the dashboard's App Settings → Local n8n Webhook URL, click Save, then Test. The status dot should turn green.

n8n's Test URL only works while the workflow editor is open with "Listen for test event" active. For always-on fetching, Active the workflow and use the Production URL.

5. Deploy the dashboard
Since this app is local-first by design, the simplest deployment is just run it on your laptop. If you want it reachable from other devices or always on:

Static hosting (Vercel / Netlify / Cloudflare Pages / GitHub Pages)


npm run build        # outputs dist/
Vercel: npm i -g vercel && vercel (auto-detects Vite).
Netlify: drag the dist/ folder onto 
https://app.netlify.com/drop

, or npm i -g netlify-cli && netlify deploy --prod --dir=dist.
GitHub Pages: see step 6 — push, then enable Pages on the repo.
Cloudflare Pages: connect the GitHub repo, framework = Vite, build = npm run build, output = dist.
Self-host on your laptop (always-on)


npm run build
npx serve dist      # or: npm i -g pm2 && pm2 serve dist 4173 --name mrd
If you deploy the dashboard to a host other than your laptop and n8n stays local, the browser will call 
http://localhost:5678/...

 — which resolves to the visitor's machine, not yours. For remote access to n8n, run n8n on a server/cloud VM and use its public URL instead of localhost.

