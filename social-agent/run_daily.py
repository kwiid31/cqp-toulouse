"""
Agent CQP Toulouse — Yasmine Bellefontaine
Lance tous les jours et répond aux conversations pertinentes sur Reddit et Twitter/X
"""
import argparse
import logging
import time
import random
import sys
from bot import browser as B
from bot.ai_engine import generate_reply
from bot.db import log_reply, already_replied, get_today_count
from bot.reddit_bot import run as run_reddit
from bot.x_bot import run as run_x
import json
from pathlib import Path

CONFIG = json.loads((Path(__file__).parent / "config.json").read_text())

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("agent.log", encoding="utf-8")
    ]
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Agent CQP Toulouse — Yasmine")
    parser.add_argument("--reddit-only", action="store_true")
    parser.add_argument("--x-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true", 
                        help="Génère les réponses sans les poster")
    args = parser.parse_args()

    identity = CONFIG["identity"]
    logger.info(f"🚀 Agent CQP démarré — Identité : {identity['name']} ({identity['reddit_username']})")
    logger.info(f"📊 Objectifs : Reddit {CONFIG['reddit']['daily_target']}/j | X {CONFIG['x']['daily_target']}/j")

    if not args.x_only:
        logger.info("📱 Lancement Reddit...")
        try:
            run_reddit(dry_run=args.dry_run)
        except Exception as e:
            logger.error(f"Erreur Reddit: {e}")

    if not args.reddit_only:
        logger.info("🐦 Lancement X/Twitter...")
        try:
            run_x(dry_run=args.dry_run)
        except Exception as e:
            logger.error(f"Erreur X: {e}")

    logger.info("✅ Session terminée")


if __name__ == "__main__":
    main()
