"""Run SQL migrations against Supabase via the REST API."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from supabase import create_client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def run():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)

    sql_path = os.path.join(os.path.dirname(__file__), "001_init.sql")
    with open(sql_path) as f:
        sql = f.read()

    # Execute via Supabase rpc (requires a wrapper function) or postgrest
    # For direct SQL execution, use the Supabase SQL Editor in the dashboard
    # or use the management API
    print("=" * 60)
    print("SQL Migration: 001_init.sql")
    print("=" * 60)
    print()
    print("Please execute the following SQL in your Supabase SQL Editor:")
    print("  Dashboard -> SQL Editor -> New Query")
    print()
    print(sql)
    print("=" * 60)


if __name__ == "__main__":
    run()
