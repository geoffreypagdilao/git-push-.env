import os

from dotenv import load_dotenv
from supabase import create_client

# Loaded here, not just by callers, since this module reads env vars at
# import time — any caller that imports this before running its own
# load_dotenv() would otherwise build the client with missing credentials.
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
