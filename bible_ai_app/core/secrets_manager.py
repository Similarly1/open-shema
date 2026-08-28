"""
secrets_manager.py -- Gestion securisee des cles API via le trousseau systeme.

Les cles sont stockees dans le Windows Credential Manager (keyring) plutot quen
clair dans config.json. Migration automatique des cles existantes au premier appel.

Fallback transparent : si keyring est indisponible (CI, serveur sans UI), les cles
sont lues/ecrites directement dans config.json comme avant.
"""

import logging
logger = logging.getLogger(__name__)

_KEYRING_SERVICE = "OpenShema"
_SECRET_KEYS = ["gemini_api_key", "mistral_api_key", "infomaniak_token", "infomaniak_product_id"]

try:
    import keyring as _keyring
    _KEYRING_AVAILABLE = True
except ImportError:
    _keyring = None
    _KEYRING_AVAILABLE = False
    logger.warning("keyring non disponible -- les cles API resteront dans config.json.")


def get_secret(key_name: str, config: dict = None) -> str:
    """
    Récupère une clé secrète depuis le trousseau système ou depuis la config de secours.
    """
    if _KEYRING_AVAILABLE:
        try:
            value = _keyring.get_password(_KEYRING_SERVICE, key_name)
            if value and str(value).strip():
                return str(value).strip()
        except Exception as e:
            logger.debug("Erreur keyring get (%s) : %s", key_name, e)
    if config and isinstance(config, dict):
        return str(config.get(key_name, "") or "").strip()
    return ""


def set_secret(key_name: str, value: str) -> bool:
    """
    Stocke une clé secrète dans le trousseau sécurisé Windows (Windows Credential Locker).
    Retourne True si réussi, False si keyring indisponible.
    Ne supprime jamais un secret existant si la valeur fournie est vide.
    """
    if not _KEYRING_AVAILABLE:
        return False
    val = str(value or "").strip()
    if not val:
        return True
    try:
        _keyring.set_password(_KEYRING_SERVICE, key_name, val)
        return True
    except Exception as e:
        logger.warning("Impossible de stocker la clé '%s' dans le trousseau : %s", key_name, e)
        return False


def delete_secret(key_name: str) -> bool:
    """Supprime explicitement un secret du trousseau système."""
    if not _KEYRING_AVAILABLE:
        return False
    try:
        _keyring.delete_password(_KEYRING_SERVICE, key_name)
        return True
    except Exception as e:
        logger.debug("Erreur delete_secret (%s) : %s", key_name, e)
        return False


def migrate_secrets_from_config(config: dict) -> dict:
    """
    Transfère les clés secrètes présentes dans le dict config vers le trousseau système (Windows Vault),
    et retourne un nouveau dict avec ces clés vidées afin de ne JAMAIS les stocker en clair dans config.json.
    """
    config = dict(config)
    for key in _SECRET_KEYS:
        value = config.get(key, "")
        if value and str(value).strip():
            set_secret(key, str(value).strip())
        config[key] = ""
    return config


def load_secrets_into_config(config: dict) -> dict:
    """
    Injecte en mémoire vive les clés du trousseau système dans le dict de configuration,
    sans toucher au fichier config.json sur disque.
    """
    config = dict(config)
    for key in _SECRET_KEYS:
        stored = get_secret(key, config)
        if stored:
            config[key] = stored
    return config


def is_keyring_available() -> bool:
    return _KEYRING_AVAILABLE
