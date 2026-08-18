import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from core.pericope_manager import PericopeManager
from core.bible_json_loader import BibleJsonLoader
from core.config import load_config

print("=== TEST 1 : Vérification PericopeManager S21 ===")
title_jhn_1 = PericopeManager.get_section_title("Segond 21", "Joh", 1, 1)
title_jhn_19 = PericopeManager.get_section_title("Segond 21", "Joh", 1, 19)
title_gen_1 = PericopeManager.get_section_title("Segond 21", "Gen", 1, 1)
print("S21 Jean 1:1 :", title_jhn_1)
print("S21 Jean 1:19 :", title_jhn_19)
print("S21 Genèse 1:1 :", title_gen_1)

print("\n=== TEST 2 : Vérification PericopeManager NFC ===")
nfc_gen_1 = PericopeManager.get_section_title("NFC", "Gen", 1, 1)
nfc_gen_2_5 = PericopeManager.get_section_title("NFC", "Gen", 2, 5)
print("NFC Genèse 1:1 :", nfc_gen_1)
print("NFC Genèse 2:5 :", nfc_gen_2_5)

print("\n=== TEST 3 : Vérification PericopeManager Parole Vivante ===")
pv_mat_1_1 = PericopeManager.get_section_title("Parole_Vivante", "Mat", 1, 1)
pv_mat_1_18 = PericopeManager.get_section_title("Parole_Vivante", "Mat", 1, 18)
print("PV Matthieu 1:1 :", pv_mat_1_1)
print("PV Matthieu 1:18 :", pv_mat_1_18)

print("\n=== TEST 4 : Zéro mélange pour les Bibles sans titres (LSG / Darby) ===")
lsg_title = PericopeManager.get_section_title("LSG", "Joh", 1, 1)
drb_title = PericopeManager.get_section_title("DARBY", "Joh", 1, 1)
print("LSG Jean 1:1 :", lsg_title, "(doit être None)")
print("Darby Jean 1:1 :", drb_title, "(doit être None)")
assert lsg_title is None, "Erreur: LSG ne doit pas avoir de péricopes artificielles !"
assert drb_title is None, "Erreur: Darby ne doit pas avoir de péricopes artificielles !"

print("\n=== TEST 5 : Triplet de contexte herméneutique (Jean 1:25) ===")
ctx = PericopeManager.get_pericope_context("Segond 21", "Joh", 1, 25)
print("Péricope courante :", ctx["current"]["ref_range"], "—", ctx["current"]["title"])
print("Péricope précédente :", ctx["prev"]["ref_range"], "—", ctx["prev"]["title"])
print("Péricope suivante :", ctx["next"]["ref_range"], "—", ctx["next"]["title"])

print("\nTous les tests unitaires de péricopes sont validés avec succès !")
