"""Keeps downloaded model weights inside cv/weights/.

Ultralytics' ``attempt_download_asset()`` looks for a bare filename relative
to the current working directory and, failing that, downloads it there. Run
from the repo root - which is how every entrypoint here runs - that scatters
large binaries across the project: a 31MB ``yoloe-26s-seg.pt`` and a 242MB
``mobileclip2_b.ts`` (YOLOE's text encoder, pulled in by ``set_classes``).

The ``.ts`` one is the reason this module exists rather than a .gitignore
line: ``*.ts`` is TypeScript, and blanket-ignoring it would quietly swallow
frontend source.

So model construction runs with the CWD pointed at cv/weights/. The chdir is
process-global and not thread-safe, which is why it wraps construction only -
a few seconds, once per process, behind the Detector singleton - and never
inference.

Override the location with ``CV_WEIGHTS_DIR``.
"""

import contextlib
import os
from pathlib import Path

DEFAULT_WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"


def weights_dir():
    return Path(os.environ.get("CV_WEIGHTS_DIR") or DEFAULT_WEIGHTS_DIR).resolve()


def resolve_model_path(model_path):
    """Make a model path safe to use from inside ``download_into_weights_dir``.

    A path that already exists is returned absolute, so the upcoming chdir
    cannot break it. A bare name that is already cached in the weights dir
    resolves to that copy. Anything else is passed through untouched so
    ultralytics can download it.
    """
    path = Path(model_path)
    if path.exists():
        return str(path.resolve())

    cached = weights_dir() / path.name
    if cached.exists():
        return str(cached)

    return str(model_path)


@contextlib.contextmanager
def download_into_weights_dir():
    """Run a block with the CWD set to cv/weights/."""
    target = weights_dir()
    target.mkdir(parents=True, exist_ok=True)

    previous = Path.cwd()
    os.chdir(target)
    try:
        yield target
    finally:
        os.chdir(previous)
