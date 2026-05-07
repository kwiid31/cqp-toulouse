import os
import anthropic
import json
from pathlib import Path
from typing import Optional, Tuple

CONFIG = json.loads((Path(__file__).parent.parent / "config.json").read_text())

IDENTITY = CONFIG["identity"]

def detect_relevance(text: str) -> bool:
    """Vérifie si le texte contient des mots-clés pertinents pour les quartiers toulousains."""
    text_lower = text.lower()
    keywords = CONFIG["products"]["CQP Toulouse"]["trigger_keywords"]
    return any(kw in text_lower for kw in keywords)


def generate_reply(post_title: str, post_content: str, platform: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Génère une réponse en tant que Yasmine, habitante de Bellefontaine.
    Retourne (reply_text, "CQP Toulouse") ou (None, None) si SKIP.
    """
    if not detect_relevance(f"{post_title} {post_content}"):
        return None, None

    product_desc = CONFIG["products"]["CQP Toulouse"]["description"]
    style_rules = "\n".join(f"- {r}" for r in CONFIG["reply_style"]["rules"])
    max_len = (CONFIG["reply_style"]["max_length_x"] if platform == "x"
               else CONFIG["reply_style"]["max_length_reddit"])

    system_prompt = f"""Tu es {IDENTITY['name']}, {IDENTITY['description']}.
Tu réponds à des posts sur les réseaux sociaux en tant que vraie habitante des quartiers populaires de Toulouse.
Tu connais bien le terrain : Bellefontaine, Mirail, Reynerie, Empalot, Bagatelle.
Tu peux mentionner CQP Toulouse ({product_desc}) comme un outil du quartier — mais seulement si c'est naturel.

Règles de style :
{style_rules}

Longueur max : {max_len} caractères pour {platform}. Sois concise et naturelle."""

    user_prompt = f"""Titre du post : {post_title}

Contenu :
{post_content[:800]}

Écris une réponse naturelle en tant qu'habitante des quartiers toulousains.
Mentionne cqp-toulouse.fr seulement si ça s'intègre vraiment bien.
Si le post n'est pas pertinent du tout, réponds juste : SKIP
Écris uniquement la réponse, rien d'autre."""

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
    )
    reply = message.content[0].text.strip()

    if reply.upper().startswith("SKIP") or len(reply) < 20:
        return None, None

    # Couper si trop long
    if len(reply) > max_len + 50:
        reply = reply[:max_len].rsplit(" ", 1)[0] + "..."

    return reply, "CQP Toulouse"


def generate_warmup_comment(post_title: str, post_content: str, subreddit: str) -> Optional[str]:
    """
    Génère un commentaire de warmup (karma building) sans mention de CQP.
    Réponse naturelle en français sur des sujets du quotidien.
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    system_prompt = f"""Tu es {IDENTITY['name']}, {IDENTITY['description']}.
Tu commentes de manière naturelle et bienveillante sur Reddit en français.
Tu n'as AUCUN produit ou site à promouvoir dans ces commentaires — c'est juste une conversation normale.
Sois sincère, utile, humaine."""

    user_prompt = f"""Subreddit : r/{subreddit}
Titre : {post_title}
Contenu : {post_content[:400]}

Écris un court commentaire naturel en français (2-4 phrases max).
N'ajoute aucun lien ni promotion.
Uniquement le texte du commentaire."""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
    )
    comment = message.content[0].text.strip()
    return comment if len(comment) > 15 else None
