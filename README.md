# git-push-.env

## Project structure

```
.
├── docker-compose.yml
└── frontend/          # React + Vite app
```

## Running with Docker

Run these commands from the **repository root** (not from inside `frontend/`) —
`docker-compose.yml` already points at `./frontend`, so a `docker build ... ./frontend`
run from inside `frontend/` will fail looking for `frontend/frontend`.

```bash
docker compose up --build
```

The app will be available at [http://localhost:5173](http://localhost:5173).
Stop it with `Ctrl+C`, or run in the background with:

```bash
docker compose up --build -d
docker compose down   # to stop
```

If you want to build the image manually instead of via Compose, run it from the
repo root:

```bash
docker build -t last-one-frontend ./frontend
```

## Running locally without Docker

Requires Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

Other available scripts (run from `frontend/`):

| Command           | Description                        |
|-------------------|-------------------------------------|
| `npm run dev`     | Start the Vite dev server           |
| `npm run build`   | Build for production                |
| `npm run preview` | Preview the production build        |
| `npm run lint`    | Run Oxlint                          |
