# `cv/` — Fruit & Vegetable Detection

Give it a photo of a fridge drawer. It tells you what's in there and how many.

```
   📷  photo of your fridge                📋  what it found
   ┌───────────────────────┐                ┌────────────────────────────────────┐
   │  🍓🍓  🥬  🌿        │   ──────────▶  │ strawberry x1  container  20 visible│
   │    🥒🥒   🫑         │                │ cherry     x1  container  10 visible│
   │                       │                │ cucumber   x2  discrete             │
   └───────────────────────┘                │ coriander  x1  bundle               │
                                            └────────────────────────────────────┘
```

Everything runs **on your own laptop**. No API key, no cost, no internet needed
once it's set up.

---

## How it works (the short version)

It uses **two** AI models, because each one is good at a different half of the job.

```
        Your photo
             │
             ▼
   ┌─────────────────────┐
   │   1. YOLOE          │   "There's something HERE, and HERE, and HERE"
   │   (the finder)      │   Draws a box around each item. Very fast.
   └─────────────────────┘   ❌ But it's bad at names — it once
             │                  found broccoli and called it cabbage.
             ▼
   ┌─────────────────────┐
   │   2. Qwen3-VL       │   "That one is broccoli. That one is lettuce."
   │   (the namer)       │   Looks at each box and names it properly.
   └─────────────────────┘   Then looks at the whole photo and counts.
             │
             ▼
      carrot x6, lettuce x1 ...
```

**Why two models?** We tested it. YOLOE alone found only 46% of items in a
benchmark of 40 photos. Adding the namer took that to **81%**. YOLOE is great at
*spotting* things and bad at *identifying* them, so we let it do only the
spotting.

---

## "How many?" needs a definition first

Ask "how many things are in this fridge" and there is no answer until you say
what *one thing* is. A bunch of coriander is 1 bunch, not 200 leaves. So every
item in [`labels.py`](labels.py) is one of three kinds:

```
  discrete    1 object = 1              🍎 apple, 🥒 cucumber, 🫑 pepper
  bundle      1 bunch  = 1              🌿 coriander, 🥬 spinach, spring onion
  container   1 box    = 1              🍓 punnet of strawberries, jar of cherries
                                           ...and the berries inside are counted
                                              separately, as a *floor*
```

A punnet of strawberries is **one punnet** *and* **about 28 strawberries**.
Those are two different facts, not two competing answers, so the code keeps
them in separate fields and never mashes them into one number.

That is also why you will see **`floor`** next to some counts. If berries are
piled in a box, you can only see the top layer — so the number is a *minimum*,
not a total. The system says so instead of pretending to know.

---

## Setup — 3 steps

### Step 1 · Python 3.12 and the libraries

⚠️ **It must be Python 3.12.** Newer versions (3.13, 3.14) don't work yet —
PyTorch hasn't released files for them. Your Mac's built-in `python3` is
probably too new.

```bash
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r cv/requirements.txt
```

Don't have `uv`? Install it with `brew install uv`.

### Step 2 · Ollama (the program that runs the naming model)

Ollama is **not** an AI model. It's a little background program that loads the
model and keeps it ready — like a local server.

```bash
brew install ollama        # or download from https://ollama.com/download
ollama serve &             # start it (the & keeps it running in the background)
ollama pull qwen3-vl:8b-instruct
```

That last command downloads about **6 GB**, so give it a few minutes.

> 💡 **Make sure it says `instruct` at the end.** There is another version
> called plain `qwen3-vl:8b` that *thinks out loud* for thousands of words
> before answering, which uses up its whole budget and returns nothing about
> half the time. The `instruct` one answers directly.

### Step 3 · Run it

```bash
python -m cv
```

That's the whole command. It runs on everything in `cv/test_images/`, saves
the boxed images, and opens the results folder.

```bash
python -m cv myphoto.jpg     # just one photo
python -m cv --bench         # score it instead of eyeballing it
python -m cv --conf 0.15     # look harder
```

The first run also downloads the YOLOE model (~272 MB) automatically into
`cv/weights/`. After that it's instant.

---

## Using it on your own photos

```bash
cp ~/Desktop/myfridge.jpg cv/test_images/     # 1. add your photo
python -m cv                                  # 2. that's it
```

(`.jpg`, `.jpeg`, `.png`, `.webp` and `.bmp` all work — no converting needed.)

You get **two kinds of output**:

```
bos.jpeg: 13 box(es)
    cilantro       0.90  [leafy_greens]      ← the BOXES
    cucumber       0.74  [vegetable_other]      (drawn on the saved image)
    ...
      strawberry   x1   container partial  (20 visible, floor)   ← the INVENTORY
      cucumber     x2   discrete  none                              (the real answer)
      coriander    x1   bundle    none
```

**Which do I trust?** The indented inventory lines. The boxes are there so you
can *see* what the computer is looking at, but one box sometimes covers a whole
bunch of touching carrots — so counting boxes undercounts. The inventory line
counts the actual items, in counting units.

The saved images in `cv/eval_output/` look like this — green boxes with a label
and a score on each item:

```
   ┌────────────────────────────────┐
   │ ┌─ cabbage 0.84 ─┐             │
   │ │                │  ┌ bell ────│  ← label + confidence
   │ │     🥬         │  │ pepper   │     (higher = more sure)
   │ │                │  │ 0.73     │
   │ └────────────────┘  └──────────│
   └────────────────────────────────┘
```

---

## Useful options

| Command | What it does |
|---|---|
| `--no-open` | Don't pop open the results folder afterwards |
| `--save` | Save the images with boxes drawn on them (on by default via `python -m cv`) |
| `--conf 0.15` | Look harder — finds more, but more mistakes too |
| `cv/test_images/one.jpg` | Run on a single photo instead of the whole folder |
| `CV_BACKEND=yoloe` | Skip the naming model. Instant, no Ollama needed, less accurate |

---

## Something went wrong?

| What you see | What it means | Fix |
|---|---|---|
| `Could not reach Ollama` | The background program isn't running | `ollama serve &` |
| `no module named torch` | Wrong Python, or venv not active | `source .venv/bin/activate` |
| `ERROR: No matching distribution` on install | Python is 3.13 or 3.14 | Rebuild the venv with `--python 3.12` |
| `address already in use` | Ollama was **already** running | Nothing — that's fine, ignore it |
| Counts come back empty | Wrong model version | Check you pulled the **`-instruct`** one |

Check everything is alive:

```bash
python -V                                    # want 3.12.x
curl -s localhost:11434/api/tags > /dev/null && echo "ollama OK"
ollama list | grep instruct                  # want qwen3-vl:8b-instruct
```

---

## Adding new fruits & vegetables

The models aren't trained on produce specifically — they're general models told
*what to look for*. That list lives in [`labels.py`](labels.py). To add one:

```python
_c("blueberry", FRUIT, "a punnet of blueberries"),
```

Two rules we learned the hard way, by measuring:

- 🚫 **Never start with a colour.** `"banana"` scores **0.78**, but
  `"a yellow banana"` scores **0.17**. Colour words make it much worse.
- ✅ **Shape words help.** `"a head of green broccoli"` (0.50) beats plain
  `"broccoli"` (0.31).

Always re-run afterwards to check you didn't break something else — when we
added `chili pepper`, it started stealing the *bell* peppers.

---

## Is it any good?

Tested against photos from COCO, a public dataset where humans labelled every
item by hand — not photos we picked:

| | finder only | **finder + namer** |
|---|---|---|
| Items it found (recall) | 46% | **76–81%** |
| Items it invented (precision) | 86% | **100%** |

100% precision means: across 25 photos it never once invented an item that
wasn't there. When it names something, believe it.

Honest weak spots:

- **Piles.** Seven carrots in a heap reads as six. Separated items are reliable.
- **Blurry backgrounds.** Fruit that's out of focus gets misnamed, and no
  amount of prompting fixes it — the detail was never in the photo. We tried
  higher resolution, forced multiple-choice, and asking it to say "unknown"
  when unsure. It guesses anyway, every time.
- **Red round things.** Apple vs tomato vs nectarine vs radish is genuinely
  hard when small or blurred. A person struggles too.

---

## Checking your changes didn't break anything

```bash
python -m cv --bench --runs 3
```

### Testing against a bigger set with known answers

Your own photos only cover your own fridge. To check it works on photos nobody
here chose, download a set that strangers labelled by hand:

```bash
python -m cv.fetch_eval_set --n 40

CV_BACKEND=hybrid python -m cv.benchmark cv/eval_set/images \
    --ground-truth cv/eval_set/ground_truth.json \
    --restrict-to-truth-classes --runs 1
```

The photos and answers land in `cv/eval_set/`, which is **gitignored** — they
stay on your machine and never get pushed. Only the download script is in git,
so anyone can rebuild the identical set.

⚠️ `--restrict-to-truth-classes` is not optional. That dataset only labels
five kinds of produce, so without the flag a correctly-spotted cabbage counts
as a *mistake*. And ignore its count numbers — one photo is a plate of ~50
chopped carrot pieces labelled "1 carrot". Use it to check **what** was found;
use your own photos to check **how many**.

This runs each photo 3 times and checks two things:

1. **Does it give the same answer every time?** (very important — a wobbly
   count invents fake "someone took a carrot" events)
2. **Does it match the known correct answer?** — from
   [`test_images/ground_truth.json`](test_images/ground_truth.json), which you
   can add your own photos to.

---

## The files

| File | Job |
|---|---|
| `eval_local.py` | The command you type |
| `detector.py` | Chooses which models to use |
| `labels.py` | The list of fruits & vegetables to look for |
| `backends/yoloe.py` | The finder 🔍 |
| `backends/ollama_vlm.py` | The namer 🏷️ |
| `backends/hybrid.py` | Runs them together |
| `backends/base.py` | Shared helpers |
| `model_store.py` | Keeps downloaded models tidy in `cv/weights/` |
| `smoothing.py` | Steadies the numbers for live video (not used yet) |
| `backends/base.py` | The `Reading` type: counts, units, occlusion |
| `benchmark.py` | The scorecard |
| `fetch_eval_set.py` | Downloads a test set with known answers |

---

## Settings (optional)

| Setting | Default | Meaning |
|---|---|---|
| `CV_BACKEND` | `yoloe` | Use `hybrid` for the best results |
| `CV_CONF_THRESHOLD` | `0.25` | Lower = finds more, but more false alarms |
| `CV_OLLAMA_MODEL` | `qwen3-vl:8b-instruct` | The naming model |
| `CV_VLM_SAMPLES` | `1` | Read each photo N times, keep only what the runs agree on. `3` is steadier but 3× slower — worth it for a live camera |
| `OLLAMA_HOST` | `http://localhost:11434` | Where Ollama is running |

Use them like this:

```bash
CV_BACKEND=hybrid CV_CONF_THRESHOLD=0.15 python -m cv.eval_local cv/test_images
```
