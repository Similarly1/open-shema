"""
core/ssl_utils.py -- Gestion centralisee des contextes SSL pour Open Shema.
REGLE : Ne jamais utiliser make_relaxed_ssl_context pour les mises a jour.
"""

import ssl
import logging

logger = logging.getLogger(__name__)


def make_ssl_context():
    """Contexte SSL strict - verifie les certificats serveur (CERT_REQUIRED).
    A utiliser pour toutes les connexions critiques : GitHub API,
    telechargements de mises a jour, APIs des LLM.
    """
    return ssl.create_default_context()


def make_relaxed_ssl_context(url=""):
    """Contexte SSL permissif (CERT_NONE) -- uniquement pour les stores et
    ebooks chretiens dont certains serveurs ont des certificats auto-signes.

    NE PAS utiliser pour les mises a jour applicatives.
    Un warning est emis dans les logs a chaque utilisation.
    """
    logger.warning(
        "Connexion SSL permissive (CERT_NONE) pour : %s -- "
        "Acceptable uniquement pour les contenus utilisateur (ebooks, modules).",
        url or "URL inconnue"
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx
