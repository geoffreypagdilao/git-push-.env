# last-one-agent

## Project structure

```
.
├── docker-compose.yml
├── frontend/     # React + Vite app (dockerized)
├── backend/      # FastAPI app (dockerized) — /inventory, /webhook/frame, Supabase client
├── cv/           # YOLO-World item detector, imported by the backend (not its own service)
├── agent/        # LangChain agent + tools, imported by the backend (not its own service)
├── capture/      # Local webcam capture script — runs on your machine, NOT dockerized
└── supabase/     # Reference SQL schema — apply manually in the Supabase SQL editor
```

## Running with Docker

Run these commands from the **repository root** (not from inside `frontend/`) —
`docker-compose.yml` already points at `./frontend` and `./backend`, so building
from inside a service folder will fail looking for a nested copy of itself.

```bash
docker compose up --build
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:8010](http://localhost:8010) (mapped from container port 8000 —
  8000 is taken by other services on this machine)

Stop it with `Ctrl+C`, or run in the background with:

```bash
docker compose up --build -d
docker compose down   # to stop
```

The backend expects a `.env` file at the repo root (see `backend/app/db/supabase_client.py`
and `agent/langchain_agent.py` for the variables it reads, e.g. `SUPABASE_URL`,
`SUPABASE_KEY`, `ANTHROPIC_API_KEY`). It's gitignored — create your own locally.

## Running the frontend locally without Docker

Requires Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

| Command           | Description                  |
|-------------------|-------------------------------|
| `npm run dev`     | Start the Vite dev server     |
| `npm run build`   | Build for production          |
| `npm run preview` | Preview the production build  |
| `npm run lint`    | Run Oxlint                    |

## cv/ — item detection (local only, not yet dockerized)

Wraps a pretrained YOLO-World model (`yolov8s-worldv2.pt`, auto-downloaded on first
run — no custom training). Heavy dependency (torch), so it's tested locally via a
venv before being wired into Docker.

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r cv/requirements.txt
```

Drop a test photo at `cv/test_images/before.jpg`, then from the repo root:

```bash
python -m cv.test_detector
```

(Run with `-m` from the repo root so `from cv.detector import Detector` resolves —
running the script directly won't find the package.)

## agent/ — LangChain agent logic

Not its own service; imported by the backend. `agent/tools.py` defines four tools
(`add_to_shopping_list`, `check_store_stock`, `place_order`, `send_notification`);
`agent/langchain_agent.py` exposes `run_agent(item_name, autonomy_mode)` where
`autonomy_mode` is `"suggest"` or `"autopilot"`. No LLM is wired up yet — see the
`_get_llm()` stub for where the real Anthropic client call goes once you add
`ANTHROPIC_API_KEY`.

## capture/ — webcam capture (local only, not dockerized)

Runs on the machine with the webcam attached. Captures a frame every 2 seconds and
POSTs it as JPEG to the backend's `/webhook/frame` endpoint.

```bash
pip install -r capture/requirements.txt
python capture/webcam_capture.py
```

Reads the backend URL from the `BACKEND_URL` env var (default `http://localhost:8000`
— set it to `http://localhost:8010` to match the Docker Compose port mapping above).
Stop with `Ctrl+C`.

## supabase/ — reference schema

`supabase/schema.sql` defines the `items`, `inventory_log`, and `shopping_list`
tables. Not applied automatically — run it manually in your Supabase project's
SQL editor.
