# Wapas: deposit wapas, bina jhagde ke

**What Wapas does, in three lines:**

1. On move-in day you record each room on your phone, saying what you see; every video is fingerprinted with SHA-256 the moment it lands.
2. Your landlord opens one link, reads the condition report and taps Agree, which locks the record.
3. At move-out you record the same rooms, and Wapas stamps every issue **pre-existing, worsened, new or fixed** and prices only what is fair to deduct.

Built by team **0xalgos** for the Next Founders Hackathon (Devpost), 2026.

## Live URLs

| What | URL |
| --- | --- |
| Frontend (Vercel) | `TODO: paste the Vercel URL` |
| Backend API (Render) | `TODO: paste the Render URL` |
| API docs | `TODO: <backend URL>/docs` |
| Demo video | `TODO: paste the Devpost/YouTube link` |

> The hosted backend runs on a free plan: it sleeps when idle, takes up to a minute to wake on the
> first request, and clears its data when it restarts unless a disk is mounted (see
> "Persistent storage on Render"). The app handles both: a banner says
> "Waking up the server…" and retries, and any page whose record has been wiped offers
> **Load sample inspection** instead of an error.

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

The backend serves http://localhost:8000 (docs at `/docs`), the frontend http://localhost:3000, and
Next.js proxies `/api` and `/media` to the backend, so no frontend configuration is needed locally.

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

## Environment variables

Names only: put the values in `backend/.env` (copy `backend/.env.example`) and in your host's
dashboard. Never commit a filled `.env`.

**Backend** (`backend/.env`, read by `backend/app/config.py`)

| Name | Needed | What it is for |
| --- | --- | --- |
| `GEMINI_API_KEY` | for real AI | Vision analysis of the frames. Empty means demo mode. |
| `GEMINI_MODEL` | optional | Which Gemini model to call. |
| `GROQ_API_KEY` | optional | Whisper transcription of the Hinglish voice notes. |
| `WHISPER_MODEL` | optional | Which Whisper model to call. |
| `FORCE_DEMO` | optional | `1` keeps demo mode even when keys exist. |
| `DATA_DIR` | on a host | One folder for everything written: the database, room videos and frames. Point it at a mounted disk. Unset means the usual local paths. |
| `DB_PATH` | optional | Overrides just the database location (defaults to `DATA_DIR`). |
| `STORAGE_DIR` | optional | Overrides just the videos and frames location (defaults to `DATA_DIR`). |
| `ADMIN_TOKEN` | optional | Turns on `GET /api/admin/backup`. Unset means that endpoint answers 404. |
| `PUBLIC_BASE_URL` | on a host | Public backend URL, so media links in the API are absolute. |
| `FRAME_INTERVAL_SEC` | optional | Seconds between sampled frames. |
| `MAX_FRAMES` | optional | Cap on frames per room video. |
| `FRAME_WIDTH` | optional | Width each sampled frame is resized to. |

**Frontend** (Vercel project settings)

| Name | Needed | What it is for |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | on a host | Backend URL the browser uploads to directly. |
| `BACKEND_URL` | on a host | Backend URL the Next.js proxy forwards `/api` and `/media` to. |

**Cost logging:** not implemented yet, so there are no variables for it. When we add the
per-inspection AI cost log, the names to reserve are `COST_LOG_ENABLED`, `COST_LOG_PATH`,
`COST_PER_1K_INPUT_TOKENS` and `COST_PER_1K_OUTPUT_TOKENS`, documented here once the code reads them.

## Demo mode vs real AI

Without keys the app runs in **demo mode**: the whole flow works, but issues are sample data, and a
yellow strip says so. Restart the backend after editing `.env`. For the hackathon video, **record
with real keys**, because the demo must be real.

There is also a one-click sample case (**Load sample inspection** on the dashboard, or
`POST /api/demo/sample`): it builds one clearly-marked sample property with a finished verdict, needs
no video and no AI call, and is safe to click repeatedly. Use it when the hosted database has been
wiped by a restart.

## Use it from your phone (same Wi-Fi)

1. Run both servers on your laptop.
2. Find your laptop IP: `ipconfig` and use the IPv4 address, for example `192.168.1.5`.
3. On the phone open `http://192.168.1.5:3000`. "Open camera" opens the phone camera directly.
4. If Windows asks about the firewall for Node.js, allow it on private networks.

The phone only talks to Next.js. Next.js forwards `/api` and `/media` to FastAPI (`frontend/next.config.ts`).

## Persistent storage on Render

Render's free instances restart with an empty filesystem, so without a disk every property, video
and verdict disappears. One folder (`DATA_DIR`) holds all of it, so mounting a disk is enough:

1. In the Render dashboard open the backend service, go to **Disks**, and **Add Disk** (any size; 1 GB
   is plenty for a demo).
2. Set its **Mount Path** to `/var/data`.
3. In **Environment**, add `DATA_DIR=/var/data`.
4. In **Environment**, add `ADMIN_TOKEN` with a long random secret of your own, so you can pull
   backups.
5. Redeploy. The startup log prints the resolved data folder and whether it is writable, and
   `GET /api/health` reports `"storage": {"data_dir_configured": true, "writable": true}`.

The database lands at `/var/data/wapas.db` and the room videos and their frames under
`/var/data/storage/`. Nothing is copied or deleted for you: if a service already has data in the old
location, the log warns that it is being bypassed, and you move it across yourself.

**Download a backup** (database only, never videos and never `.env`):

```bash
curl -H "X-Admin-Token: $ADMIN_TOKEN" https://<backend-url>/api/admin/backup -o wapas-backup.db
```

The snapshot is taken through SQLite's backup API, so it is consistent even while the app is serving
requests, and you can open it locally with any SQLite tool.

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
| POST | `/api/comparisons/{id}/share` | Create (or return) the read-only report link |
| POST | `/api/comparisons/{id}/share/revoke` | Stop sharing that report |
| GET | `/api/shared/{token}` | The report behind a share link, read-only |
| POST | `/api/demo/sample` | Build the sample case, or return the existing one |
| GET | `/api/admin/backup` | Download a database snapshot (needs the `X-Admin-Token` header) |
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
