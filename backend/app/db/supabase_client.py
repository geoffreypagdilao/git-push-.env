import os

import httpx
from dotenv import load_dotenv
from supabase import ClientOptions, create_client

# Loaded here, not just by callers, since this module reads env vars at
# import time — any caller that imports this before running its own
# load_dotenv() would otherwise build the client with missing credentials.
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# http2=False: the default HTTP/2 transport intermittently raises
# "WinError 10035 (WSAEWOULDBLOCK)" on Windows — a known httpx/httpcore
# incompatibility with Windows' overlapped socket I/O, not a Supabase issue.
# HTTP/1.1 is plenty for this traffic and sidesteps it entirely.
supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
    options=ClientOptions(httpx_client=httpx.Client(http2=False)),
)
