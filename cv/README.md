# `cv/` — produce detection

Turns a fridge-drawer photo into `{item: count}`, with each item mapped to one
of the five `shelf_life_lookup` categories the database expects.

## Setup

**1. Python 3.12.** Torch has no wheels for 3.13/3.14, so the system `python3`
on a current Mac will not work.

```bash
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install -r cv/requirements.txt
```

**2. Ollama and the vision model.** Not pip-installable, and the default
backend needs both.

```bash
brew install ollama                    # or https://ollama.com/download
ollama serve &
ollama pull qwen3-vl:8b-instruct       # ~6GB
```

Use the **`-instruct`** tag. Plain `qwen3-vl:8b` is a reasoning model that
writes 6,000–16,000 characters of hidden thinking before answering; those
tokens exhaust the output budget, so roughly half of all calls return an empty
string. `think: false` does not disable it.

The YOLOE weights download themselves on first run, into `cv/weights/`
(~272MB, gitignored).

## Running it

```bash
CV_BACKEND=hybrid python -m cv.eval_local cv/test_images --save
open cv/eval_output/
```

Point it at a single file instead of a folder if you prefer. `--save` writes
boxed copies to `cv/eval_output/`; `--conf 0.15` lowers the detection
threshold when items are being missed.

From code:

```python
from cv.detector import get_detector
counts = get_detector().detect(frame)          # {'carrot': 3, 'lettuce': 1}
```

`get_detector()` is a singleton — call it, don't construct `Detector()`
per frame, or the model reloads every time.

## How it works

Two models, each doing the half it is good at.

```
frame
  ├─ YOLOE          finds and boxes items          ~0.1s, deterministic
  ├─ dedupe         merges overlapping boxes
  ├─ Qwen3-VL       names each cropped box         ~0.3s per crop
  └─ category_for() maps the name to a shelf-life category
```

They fail in opposite ways, which is the whole reason for the split. YOLOE
localises well but names badly — it boxes broccoli perfectly and calls it
`cabbage`. Qwen3-VL names well but is hopeless at finding: asked to detect a
whole frame it took 37–186s and returned nothing about half the time. Asked to
name one crop it takes 0.3s and was 10/10 consistent. So YOLOE's boxes and
scores are kept and only the label is replaced.

## Configuration

| Variable | Default | |
|---|---|---|
| `CV_BACKEND` | `yoloe` | `hybrid` (both models), `yoloe` (fast, no Ollama), `ollama` (VLM alone, slow) |
| `CV_CONF_THRESHOLD` | `0.25` | detection threshold |
| `CV_OLLAMA_MODEL` | `qwen3-vl:8b-instruct` | |
| `OLLAMA_HOST` | `http://localhost:11434` | |
| `CV_WEIGHTS_DIR` | `cv/weights` | where model files are cached |

## Files

| | |
|---|---|
| `detector.py` | picks the backend, holds the singleton |
| `labels.py` | 33 produce classes → 56 prompts, plus the category map |
| `backends/hybrid.py` | orchestrates the two models |
| `backends/yoloe.py` | finds and boxes |
| `backends/ollama_vlm.py` | names a crop |
| `backends/base.py` | `Detection`, dedupe, jpeg encoding |
| `model_store.py` | keeps downloads inside `cv/weights/` |
| `smoothing.py` | `CountStabilizer` — flicker filter for the live loop |
| `eval_local.py` | the CLI above |

## Gotchas

- **Ollama must be running.** If it isn't, the hybrid silently falls back to
  YOLOE's own labels rather than dropping items — you get results, just worse
  ones. Check `curl -s localhost:11434/api/tags`.
- **Never call the VLM on every frame.** The capture script posts one every 2
  seconds; that is 43,200 inferences a day. It is meant to run when the drawer
  contents change.
- **An empty result is not an empty drawer.** `OllamaVlmBackend.predict()`
  raises `NoReading` when the model returns nothing usable, precisely so a
  stalled model cannot be mistaken for someone emptying the fridge and log
  every item as removed.
- **Crops under 48px keep YOLOE's label.** Below that the VLM guesses — a
  41×51px box of berries came back `tomato` three times running.
