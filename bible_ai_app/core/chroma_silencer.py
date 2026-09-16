"""
OpenShema - Neutralisation de la telemetrie PostHog de ChromaDB.
Empeche les erreurs de telemetrie posthog (signature conflict capture()).
"""
import os
import sys
import logging

os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_SERVER_NOOP_TELEMETRY"] = "1"

for _logger_name in [
    "chromadb",
    "chromadb.telemetry",
    "chromadb.telemetry.product",
    "chromadb.telemetry.product.posthog",
    "chromadb.telemetry.posthog",
    "posthog"
]:
    logging.getLogger(_logger_name).setLevel(logging.CRITICAL)

try:
    import chromadb.telemetry.product.posthog as ph
    if hasattr(ph, "Posthog"):
        ph.Posthog.capture = lambda *args, **kwargs: None
        ph.Posthog._direct_capture = lambda *args, **kwargs: None
except Exception:
    pass

try:
    import posthog
    posthog.capture = lambda *args, **kwargs: None
    posthog.disabled = True
except Exception:
    pass
