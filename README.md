# Wapas: deposit wapas, bina jhagde ke

Wapas is an AI move-in/move-out witness for Indian tenants. You record each room on move-in day, your landlord signs the report on WhatsApp, and at move-out AI stamps every issue as **pre-existing, worsened, new or fixed** with a fair repair cost.

Built by team **0xalgos** for the Next Founders Hackathon (Devpost), 2026.

## What works in this MVP

| Feature | Where |
| --- | --- |
| Add a rented place (tenant, deposit, landlord) | `/property/new` |
| Record rooms (phone camera or video file), SHA-256 fingerprint on upload | `/inspect/[id]` |
| AI pipeline: ffmpeg frames, Groq Whisper (Hinglish voice notes), Gemini vision gives issues as JSON | `backend/app/pipeline.py` |
| Condition report: issue tags with frame + timestamp, click to jump in video, edit / remove / add missed issue | `/inspect/[id]` |
| Landlord sign-off link (no login), WhatsApp share, Agree / Dispute, record locks after Agree | `/sign/[token]` |
| Move-out record + AI compare against the signed move-in, plus fair deduction from a rate card | `/compare/[id]` |
| Printable evidence report (save as PDF) with every video's fingerprint | `/report/[id]` |
| Public tamper check: drop a video, see if it matches | `/verify` |

**Not added yet, on purpose:** login, security and payments. These come later (see "Next features").

## Run it on Windows

You need **Python 3.10+** and **Node.js 20.9+**. ffmpeg comes with the Python packages, so you don't install it separately.

**Easy way:** double-click `run-backend.bat`, then `run-frontend.bat`, and open http://localhost:3000

**Manual way (two terminals):**

```powershell
# Terminal 1: backend
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

```powershell
# Terminal 2: frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

> OneDrive tip: if `npm install` or Next.js shows `EPERM` / file-lock errors inside the OneDrive Desktop folder, pause OneDrive sync while you work, or move the project to `C:\dev\wapas`.

## Demo mode vs real AI

Without keys the app runs in **demo mode**: the whole flow works, but issues are sample data, and a yellow strip says so. Add keys in `backend/.env` for real analysis:

```env
GEMINI_API_KEY=your_key      # https://aistudio.google.com/apikey
GEMINI_MODEL=gemini-2.5-flash # any Gemini Flash model your key can use
GROQ_API_KEY=your_key        # https://console.groq.com/keys  (Hinglish voice notes)
```

Restart the backend after editing `.env`. For the hackathon video, **record with real keys**, because the demo must be real.

## Use it from your phone (same Wi-Fi)

1. Run both servers on your laptop.
2. Find your laptop IP: `ipconfig` and use the IPv4 address, for example `192.168.1.5`.
3. On the phone open `http://192.168.1.5:3000`. "Open camera" opens the phone camera directly.
4. If Windows asks about the firewall for Node.js, allow it on private networks.

The phone only talks to Next.js. Next.js forwards `/api` and `/media` to FastAPI (`frontend/next.config.ts`).

## Deploy (Railway backend + Vercel frontend)

**Backend on Railway** (a volume keeps videos and the database across restarts)

1. railway.com: New Project, Deploy from GitHub repo, pick this repo.
2. Service Settings: Root Directory `backend`. Custom Start Command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Add a Volume to the service with mount path `/data`.
4. Variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `STORAGE_DIR=/data/storage`, `DB_PATH=/data/wapas.db`.
5. Networking: Generate Domain. Then add `PUBLIC_BASE_URL=https://<that-domain>` and redeploy.
6. Check `https://<that-domain>/api/health` returns `"ai_live": true`.

**Frontend on Vercel**

1. vercel.com: Add New Project, import this repo.
2. Root Directory `frontend` (framework: Next.js).
3. Environment variables: `NEXT_PUBLIC_API_URL=https://<railway-domain>` and `BACKEND_URL=https://<railway-domain>`.
4. Deploy, then open the Vercel URL.

With `NEXT_PUBLIC_API_URL` set, the browser sends uploads straight to FastAPI (CORS is open), so big phone videos don't pass through Vercel.

## Demo script (what to click)

1. **Add a place**, then record **Bedroom** and **Bathroom**. Say issues out loud: "almirah ka handle toota hai".
2. Open a room report, click an issue's frame (the video jumps there), edit one, and add one the AI missed.
3. **Send to landlord**, then **Open the landlord's page** (or open the link on a second phone) and tap **Agree and sign**. The tenant page shows the violet AGREED seal live.
4. Back on the folder, **Start move-out** and record the same rooms (add a new stain or mess for the demo).
5. **Compare with move-in**: the stamps slam down, and the settlement slip shows the deposit you should get back.
6. **Open evidence report**, then **Print or save as PDF**.
7. **Verify a video**: drop the original move-in video to show "MATCH, untampered".

## Project structure

```text
wapas/
  backend/                 FastAPI + SQLite
    app/main.py            API routes
    app/pipeline.py        background jobs: process room, compare
    app/ai.py              Whisper + Gemini calls, demo fallback, rule matcher
    app/prompts.py         detection + compare prompts
    app/media.py           SHA-256, ffmpeg frames/audio
    app/ratecard.json      repair rates (SAMPLE: replace with local quotes)
    storage/               videos + frames (created at runtime)
  frontend/                Next.js 16 (App Router, TypeScript, plain CSS)
    app/                   pages: landing, dashboard, property, inspect, sign, compare, report, verify
    components/            Stamp, IssueTag, Topbar, RoomScene
    lib/api.ts             typed API client + formatting
```

## API (FastAPI, http://localhost:8000/docs)

| Method | Path | Does |
| --- | --- | --- |
| GET | `/api/health` | Demo or live AI |
| POST, GET | `/api/properties` | Create and list places |
| GET, DELETE | `/api/properties/{id}` | One place with its records |
| POST | `/api/properties/{id}/inspections` | Start move-in or move-out |
| GET | `/api/inspections/{id}` | Rooms, issues, sign-off |
| POST | `/api/inspections/{id}/rooms` | Upload a room video (form: name, file) |
| POST | `/api/rooms/{id}/retry` | Re-run AI on a failed room |
| DELETE | `/api/rooms/{id}` | Remove a room to re-record |
| POST | `/api/rooms/{id}/issues` | Add an issue the AI missed |
| PATCH, DELETE | `/api/issues/{id}` | Edit or remove an issue |
| POST | `/api/inspections/{id}/share` | Create the landlord link |
| POST | `/api/inspections/{id}/lock` | Lock without landlord |
| GET, POST | `/api/sign/{token}` | Landlord view and decision |
| POST | `/api/properties/{id}/compare` | Run move-in vs move-out |
| GET | `/api/comparisons/{id}` | Verdicts, costs, counts |
| GET | `/api/verify/{sha256}` and POST `/api/verify` | Tamper check by hash or file |

## Before the pitch

- Replace `backend/app/ratecard.json` values with real quotes from 3 to 4 local painters, plumbers and carpenters, and update `source_note`.
- Measure the real AI cost per inspection with your keys and put it in the business slide.
- Test with 3 to 5 PG friends and use one real quote in the video.

## Next features (add slowly)

1. Razorpay test mode for the ₹149 Move-out pack
2. Login (phone OTP) and per-user data
3. Hash anchoring on Base Sepolia for extra tamper-proofing
4. Bounding boxes on frames
5. PG operator dashboard (many beds, bulk check-in/out)
6. Deposit refund reminders and a demand-letter template

Wapas organises evidence. It isn't legal advice.
