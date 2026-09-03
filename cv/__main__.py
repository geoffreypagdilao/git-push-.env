"""Short entry point so the common case is one word.

    python -m cv                    detect on cv/test_images, save, open results
    python -m cv myphoto.jpg        detect on one photo
    python -m cv --bench            score against ground truth instead
    python -m cv --no-open          skip opening the output folder

Anything it does not recognise is passed straight through to cv.eval_local,
so `python -m cv --conf 0.15` still works.

Defaults to the hybrid backend, because typing CV_BACKEND=hybrid every time
was the main friction - and plain yoloe is the wrong default for anyone who
just wants to see what is in a photo.
"""

import os
import subprocess
import sys
from pathlib import Path

DEFAULT_TARGET = "cv/test_images"
OUTPUT_DIR = Path("cv/eval_output")


def main():
    args = sys.argv[1:]

    if "--bench" in args:
        args.remove("--bench")
        os.environ.setdefault("CV_BACKEND", "hybrid")
        from cv.benchmark import main as bench_main

        sys.argv = ["cv.benchmark"] + args
        return bench_main()

    open_after = "--no-open" not in args
    args = [a for a in args if a != "--no-open"]

    # Everything before the first flag is a target; default to the test folder.
    if not args or args[0].startswith("-"):
        args = [DEFAULT_TARGET] + args
    if "--save" not in args:
        args.append("--save")

    os.environ.setdefault("CV_BACKEND", "hybrid")

    from cv.eval_local import main as eval_main

    sys.argv = ["cv.eval_local"] + args
    code = eval_main()

    # Only worth opening if something was actually written, and only on a Mac
    # with a desktop - this is a convenience, never a reason to fail.
    if code == 0 and open_after and OUTPUT_DIR.is_dir() and sys.platform == "darwin":
        try:
            subprocess.run(["open", str(OUTPUT_DIR)], check=False)
        except OSError:
            pass
    return code


if __name__ == "__main__":
    sys.exit(main())
