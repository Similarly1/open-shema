"""
UpdaterMixin - API Bridge pour la gestion des mises à jour Open Shema.
Exposé à PyWebView via BibleAppApi.
Zéro emoji, méthodes directes et sécurisées.
"""

import os
import sys
import time
import logging
from typing import Dict, Any

from core.updater import (
    APP_VERSION,
    check_for_updates,
    start_background_download,
    get_update_state,
    apply_update_and_restart
)
from core.config import load_config, save_config

logger = logging.getLogger("api_updater")


class UpdaterMixin:
    """Mixin pour les fonctionnalités d'auto-mise à jour in-app."""

    def check_for_updates(self, force: bool = False) -> Dict[str, Any]:
        """
        Vérifie la disponibilité d'une nouvelle version sur GitHub.
        Met à jour la date de dernière vérification dans la configuration.
        """
        cfg = load_config()
        freq = cfg.get("update_frequency", "startup")
        last_check = cfg.get("last_update_check", 0)
        now = time.time()

        # Si ce n'est pas un appel forcé (manuel), respecter la fréquence
        if not force:
            if freq == "manual":
                return {
                    "success": True,
                    "update_available": False,
                    "current_version": APP_VERSION,
                    "skipped": True,
                    "reason": "Vérification configurée en mode manuel."
                }
            elif freq == "weekly":
                # Moins de 7 jours
                if (now - last_check) < (7 * 86400):
                    return {
                        "success": True,
                        "update_available": False,
                        "current_version": APP_VERSION,
                        "skipped": True,
                        "reason": "Dernière vérification hebdomadaire encore récente."
                    }

        res = check_for_updates()
        if res.get("success"):
            cfg["last_update_check"] = int(now)
            save_config(cfg)

        return res

    def start_background_update(self) -> Dict[str, Any]:
        """Déclenche le téléchargement en arrière-plan sans bloquer l'UI."""
        return start_background_download()

    def get_update_progress(self) -> Dict[str, Any]:
        """Retourne l'état courant de la mise à jour (utilisé par le polling frontend)."""
        return get_update_state()

    def apply_update_and_restart(self) -> Dict[str, Any]:
        """Déclenche la bascule vers la nouvelle version et quitte l'application."""
        res = apply_update_and_restart()
        if res.get("success"):
            # Fermeture propre de la fenêtre PyWebView si disponible
            try:
                if hasattr(self, "_window") and self._window:
                    self._window.destroy()
            except Exception:
                pass
            sys.exit(0)
        return res

    def get_update_settings(self) -> Dict[str, Any]:
        """Récupère les préférences de mise à jour (fréquence, dernière vérification)."""
        cfg = load_config()
        return {
            "current_version": APP_VERSION,
            "update_frequency": cfg.get("update_frequency", "startup"),
            "last_update_check": cfg.get("last_update_check", 0),
            "app_version": APP_VERSION
        }

    def save_update_settings(self, frequency: str) -> Dict[str, Any]:
        """Enregistre la fréquence de vérification choisie par l'utilisateur."""
        allowed = ["startup", "weekly", "manual"]
        freq = frequency if frequency in allowed else "startup"

        cfg = load_config()
        cfg["update_frequency"] = freq
        save_config(cfg)
        return {"success": True, "update_frequency": freq}
