#!/usr/bin/env python
"""
Run the FinBuddy email sync on a schedule.

Polls your Gmail inbox every 15 minutes for bank alert emails.

Usage:
  source .venv/bin/activate
  python scripts/run_email_sync.py
"""
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data.loaders.email_loader import sync_emails

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 15 * 60  # 15 minutes


def main():
    logger.info("📧 FinBuddy email sync started (interval: %d min)", INTERVAL_SECONDS // 60)
    while True:
        try:
            n = sync_emails()
            if n:
                logger.info("✅ Imported %d transaction(s) from email", n)
            else:
                logger.info("No new transactions from email")
        except Exception as e:
            logger.error("Sync error: %s", e)

        logger.info("Sleeping %d minutes…", INTERVAL_SECONDS // 60)
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
