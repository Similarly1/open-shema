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
_SECRET_KEYS = ["gemini_api_key", "mistral_api_key", "infomaniak_token"]

try:
    import keyring as _keyring
    _KEYRING_AVAILABLE = True
except ImportError:
    _keyring = None
    _KEYRING_AVAILABLE = False
    logger.warning("keyring non disponible -- les cles API resteront dans config.json.")


def get_secret(key_name: str, config: dict = None) -> str:
    """
    Recupere une cle secrete depuis le trousseau systeme.
    Fallback sur config dict si keyring indisponible ou cle absente du trousseau.
    """
    if _KEYRING_AVAILABLE:
        try:
            value = _keyring.get_password(_KEYRING_SERVICE, key_name)
            if value:
                return value
        except Exception as e:
            logger.debug("Erreur keyring get (%s) : %s", key_name, e)
    if config:
        return config.get(key_name, "")
    return ""


def set_secret(key_name: str, value: str) -> bool:
    """
    Stocke une cle secrete dans le trousseau systeme.
    Retourne True si reussi, False si keyring indisponible.
    """
    if not _KEYRING_AVAILABLE:
        return False
    try:
        if value:
            _keyring.set_password(_KEYRING_SERVICE, key_name, value)
        else:
            try:
                _keyring.delete_password(_KEYRING_SERVICE, key_name)
            except Exception as _silent_e:
                logger.debug("Erreur ignoree : %s", _silent_e)
        return True
    except Exception as e:
        logger.warning("Impossible de stocker la cle '%s' dans le trousseau : %s", key_name, e)
        return False


def migrate_secrets_from_config(config: dict) -> dict:
    """
    Migration one-shot : deplace les cles secretes de config.json vers le trousseau.
    Retire les cles migrees du dict de config retourne.
    """
    if not _KEYRING_AVAILABLE:
        return config
    migrated = []
    for key in _SECRET_KEYS:
        value = config.get(key, "")
        if value:
            if set_secret(key, value):
                migrated.append(key)
    if migrated:
        logger.info("Cles API migrees vers le trousseau systeme : %s", migrated)
        config = dict(config)
        for key in migrated:
            config[key] = ""
        from core.config import save_config
        save_config(config)
    return config


def load_secrets_into_config(config: dict) -> dict:
    """
    Injecte les cles du trousseau dans le dict de config pour usage transparent.
    """
    config = dict(config)
    for key in _SECRET_KEYS:
        stored = get_secret(key, config)
        if stored:
            config[key] = stored
    return config


def is_keyring_available() -> bool:
    return _KEYRING_AVAILABLE
