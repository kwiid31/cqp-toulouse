"""
Mode warmup — construit le karma de yasmine_bellefontaine31 
sans aucune mention de CQP Toulouse.
Subreddits sûrs : france, AskFrance, etc.
"""
import time
import random
import argparse
import logging
from bot import browser as B
from bot.ai_engine import generate_warmup_comment
from bot.db import log_reply, already_replied

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

WARMUP_SUBS = ["france", "AskFrance", "paris", "Lyon", "bordeaux"]
DELAY_MIN = 90
DELAY_MAX = 180

def run_warmup(target: int = 8):
    logger.info(f"🌱 Warmup mode — objectif : {target} commentaires")
    count = 0

    for sub in WARMUP_SUBS:
        if count >= target:
            break

        url = f"https://old.reddit.com/r/{sub}/new/"
        logger.info(f"📖 Navigation vers r/{sub}")
        B.open_url(url)
        B.wait_seconds(3)

        tree = B.snapshot()
        # Trouver les liens de posts
        post_links = [line for line in tree.split('\n') 
                     if '/r/' + sub + '/comments/' in line and 'http' in line]

        for link in post_links[:5]:
            if count >= target:
                break

            # Extraire URL
            url_start = link.find('http')
            if url_start == -1:
                continue
            post_url = link[url_start:].split()[0].rstrip(')')

            if already_replied(post_url):
                continue

            logger.info(f"📝 Post : {post_url}")
            B.open_url(post_url)
            B.wait_seconds(2)

            post_tree = B.snapshot()
            # Extraire titre et contenu approximatifs
            lines = [l.strip() for l in post_tree.split('\n') if l.strip()]
            title = lines[2] if len(lines) > 2 else "Post Reddit"
            content = " ".join(lines[3:15]) if len(lines) > 5 else ""

            comment = generate_warmup_comment(title, content, sub)
            if not comment:
                continue

            logger.info(f"💬 Commentaire généré : {comment[:80]}...")

            # Trouver le bouton reply
            reply_refs = B.find_text_refs(post_tree, "reply")
            if not reply_refs:
                logger.warning("Bouton reply non trouvé")
                continue

            B.click(reply_refs[0])
            B.wait_seconds(2)
            B.type_text(comment)
            B.wait_seconds(1)

            # Soumettre
            tree2 = B.snapshot()
            save_refs = B.find_text_refs(tree2, "save")
            if save_refs:
                B.click(save_refs[0])
                log_reply(post_url, "reddit", "warmup", "")
                count += 1
                logger.info(f"✅ Commentaire posté ({count}/{target})")
            
            delay = random.randint(DELAY_MIN, DELAY_MAX)
            logger.info(f"⏳ Pause {delay}s...")
            time.sleep(delay)

    logger.info(f"✅ Warmup terminé — {count} commentaires postés")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=8)
    args = parser.parse_args()
    run_warmup(args.target)
