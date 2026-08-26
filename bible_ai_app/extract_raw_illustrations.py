#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script d'Extraction Brute des Illustrations (Étape 1 : 100% Python).
Extrait et normalise les illustrations depuis les EPUBs dans un format JSON intermédiaire propre,
sans aucun coût de token IA, prêt pour la phase de classification et traduction.

Sources traitées :
1. Fables d'Ésope (Chambry, 1927) - Français (~358 fables)
2. Fables de La Fontaine (éd. 1874) - Français (~245 fables)
3. Cyclopedia of Illustrations for Public Speakers (Scott & Stiles) - Anglais (3 520 illustrations)
4. Moody's Anecdotes and Illustrations (D.L. Moody) - Anglais (~185 anecdotes)
"""

import os
import sys
import io
import re
import json
import glob
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Dict, Any
from bs4 import BeautifulSoup

# Encodage console UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SOURCE_DIR = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\illustrations"
OUTPUT_DIR = os.path.join(CURRENT_DIR, "data", "illustrations_raw")


def get_epub_spine(z: zipfile.ZipFile) -> List[str]:
    """Retourne la liste ordonnée des fichiers HTML définis dans le spine de l'OPF."""
    container = z.read('META-INF/container.xml')
    opf_path = ET.fromstring(container).find('.//{*}rootfile').attrib['full-path']
    opf_dir = opf_path.split('/')[0] if '/' in opf_path else ''
    opf_tree = ET.fromstring(z.read(opf_path))
    manifest = {item.attrib['id']: item.attrib['href'] for item in opf_tree.findall('.//{*}manifest/{*}item')}
    spine = []
    for itemref in opf_tree.findall('.//{*}spine/{*}itemref'):
        ref = itemref.attrib['idref']
        if ref in manifest:
            href = manifest[ref]
            spine.append(f"{opf_dir}/{href}" if opf_dir else href)
    return spine


# =========================================================================
# 1. PARSER ÉSOPE
# =========================================================================
def extract_esope(epub_path: str) -> List[Dict[str, Any]]:
    items = []
    with zipfile.ZipFile(epub_path, 'r') as z:
        spine = get_epub_spine(z)
        for f in spine:
            if not f.endswith(('html', 'xhtml')):
                continue
            fname = os.path.basename(f)
            m = re.search(r'c\d+_Fables_d_Esope__trad\._Chambry__1927__(.+)\.xhtml', fname)
            if not m:
                continue
            raw_t = m.group(1).replace('_', ' ')
            if any(skip in raw_t.lower() for skip in ['notice', 'approbation', 'avant propos', 'export']):
                continue
            soup = BeautifulSoup(z.read(f), 'html.parser')
            title_tag = soup.find('title')
            clean_title = raw_t
            if title_tag and title_tag.get_text().strip():
                t = title_tag.get_text().strip()
                if len(t) < 80 and not t.lower().startswith('fables'):
                    clean_title = t
            paras = [p.get_text().strip() for p in soup.find_all('p') if p.get_text().strip() and not p.get_text().strip().startswith('Exporté')]
            if paras:
                items.append({
                    "id": f"esope-{len(items)+1:03d}",
                    "index": len(items) + 1,
                    "title": clean_title,
                    "body": "\n\n".join(paras),
                    "source": "Fables d'Ésope (trad. Chambry, 1927)",
                    "author": "Ésope",
                    "lang": "fr",
                    "original_type": "Fable / Métaphore"
                })
    return items


# =========================================================================
# 2. PARSER LA FONTAINE
# =========================================================================
def extract_la_fontaine(epub_path: str) -> List[Dict[str, Any]]:
    items = []
    with zipfile.ZipFile(epub_path, 'r') as z:
        spine = get_epub_spine(z)
        for f in spine:
            if not f.endswith(('html', 'xhtml')):
                continue
            fname = os.path.basename(f)
            m = re.search(r'c\d+_Fables_de_La_Fontaine__ed\._1874__(.+)\.xhtml', fname)
            if not m:
                continue
            raw_t = m.group(1).replace('_', ' ')
            if any(skip in raw_t.lower() for skip in ['notice', 'epitre', 'preface', 'vie d', 'table', 'export']):
                continue
            soup = BeautifulSoup(z.read(f), 'html.parser')
            h_tag = soup.find(['h2', 'h1'])
            clean_title = raw_t
            if h_tag:
                ht = re.sub(r'^[I|V|X\d\s\.\-]+', '', h_tag.get_text().strip()).strip()
                if ht and len(ht) < 80 and not ht.lower().startswith('livre'):
                    clean_title = ht.title()
            paras = [p.get_text().strip() for p in soup.find_all('p') if p.get_text().strip() and not p.get_text().strip().startswith('Exporté')]
            if paras:
                items.append({
                    "id": f"lafontaine-{len(items)+1:03d}",
                    "index": len(items) + 1,
                    "title": clean_title,
                    "body": "\n\n".join(paras),
                    "source": "Fables de La Fontaine (éd. 1874)",
                    "author": "Jean de La Fontaine",
                    "lang": "fr",
                    "original_type": "Fable / Poésie"
                })
    return items


# =========================================================================
# 3. PARSER CYCLOPEDIA OF ILLUSTRATIONS
# =========================================================================
def extract_cyclopedia(epub_path: str) -> List[Dict[str, Any]]:
    items = []
    with zipfile.ZipFile(epub_path, 'r') as z:
        spine = get_epub_spine(z)
        current_block = []
        for full_href in spine:
            if any(skip in full_href for skip in ['-h-0.', '-h-1.', '-h-35.', '-h-36.', '-h-37.', '-h-38.', 'wrap', 'toc']):
                continue
            soup = BeautifulSoup(z.read(full_href), 'html.parser')
            for el in soup.find_all(['p', 'h2', 'h3']):
                txt = el.get_text().strip()
                if not txt:
                    continue
                num_match = re.match(r'^\((\d+)\)$', txt)
                if num_match:
                    num = int(num_match.group(1))
                    filtered = [l for l in current_block if '—See' not in l and not (len(l) == 1 and l.isupper()) and not l.startswith('Cyclopedia of')]
                    if filtered:
                        title = filtered[0]
                        body = "\n\n".join(filtered[1:]) if len(filtered) > 1 else filtered[0]
                        items.append({
                            "id": f"cyclo-{num:04d}",
                            "num": num,
                            "title": title,
                            "body": body,
                            "source": f"Cyclopedia of Illustrations #{num}",
                            "author": "Robert Scott & William C. Stiles",
                            "lang": "en",
                            "original_type": "Illustration / Anecdote"
                        })
                    current_block = []
                    continue
                current_block.append(txt)
    return items


# =========================================================================
# 4. PARSER MOODY'S ANECDOTES
# =========================================================================
def extract_moody(epub_path: str) -> List[Dict[str, Any]]:
    items = []
    with zipfile.ZipFile(epub_path, 'r') as z:
        for fname in sorted(z.namelist()):
            if not fname.endswith(('html', 'xhtml', 'htm')) or 'toc' in fname or 'wrap' in fname or 'h-5' in fname:
                continue
            soup = BeautifulSoup(z.read(fname), 'html.parser')
            elements = soup.find_all('div', recursive=False)
            if not elements:
                elements = soup.find('body').find_all('div', recursive=False) if soup.find('body') else []
            if not elements:
                elements = soup.find_all(['div', 'p'])
            
            cur_topic = "Général"
            cur_title = None
            cur_paras = []
            
            for el in elements:
                txt = el.get_text().strip()
                if not txt or 'PROJECT GUTENBERG' in txt or 'GUSTAVE DORE' in txt:
                    continue
                if any(skip in txt.lower() for skip in ['revised edition', 'chicago:', 'rhodes & mcclure', 'entered according', 'illustrations', 'preface']):
                    continue
                if txt.isupper() and len(txt) < 50:
                    cur_topic = txt.title()
                    continue
                if len(txt) < 70 and (txt.endswith('.') or txt.endswith('!') or txt.endswith('?')) and len(txt.split()) <= 8:
                    if cur_title and cur_paras:
                        items.append({
                            "id": f"moody-{len(items)+1:03d}",
                            "index": len(items) + 1,
                            "topic": cur_topic,
                            "title": cur_title,
                            "body": "\n\n".join(cur_paras).strip(),
                            "source": "Moody's Anecdotes and Illustrations",
                            "author": "Dwight L. Moody",
                            "lang": "en",
                            "original_type": "Récit d'évangélisation"
                        })
                        cur_paras = []
                    cur_title = txt.rstrip('.')
                else:
                    if cur_title:
                        cur_paras.append(txt)
            if cur_title and cur_paras:
                items.append({
                    "id": f"moody-{len(items)+1:03d}",
                    "index": len(items) + 1,
                    "topic": cur_topic,
                    "title": cur_title,
                    "body": "\n\n".join(cur_paras).strip(),
                    "source": "Moody's Anecdotes and Illustrations",
                    "author": "Dwight L. Moody",
                    "lang": "en",
                    "original_type": "Récit d'évangélisation"
                })
    return items


# =========================================================================
# POINT D'ENTRÉE PRINCIPAL
# =========================================================================
def run_full_raw_extraction(source_dir: str = DEFAULT_SOURCE_DIR, output_dir: str = OUTPUT_DIR):
    os.makedirs(output_dir, exist_ok=True)
    print("=" * 70)
    print("🚀 DÉMARRAGE DE L'EXTRACTION BRUTE DES ILLUSTRATIONS (ÉTAPE 1)")
    print(f"📂 Dossier source : {source_dir}")
    print(f"📁 Dossier destination : {output_dir}")
    print("=" * 70)

    summary = {}

    # 1. Ésope
    esope_files = glob.glob(os.path.join(source_dir, "*sope*.epub"))
    if esope_files:
        print(f"\n[1/4] Extraction des Fables d'Ésope ({os.path.basename(esope_files[0])})...")
        esope_items = extract_esope(esope_files[0])
        out_file = os.path.join(output_dir, "raw_esope.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(esope_items, f, ensure_ascii=False, indent=2)
        print(f"  ✅ {len(esope_items)} fables extraites -> {out_file}")
        summary["esope"] = len(esope_items)

    # 2. La Fontaine
    lf_files = glob.glob(os.path.join(source_dir, "*Fontaine*.epub"))
    if lf_files:
        print(f"\n[2/4] Extraction des Fables de La Fontaine ({os.path.basename(lf_files[0])})...")
        lf_items = extract_la_fontaine(lf_files[0])
        out_file = os.path.join(output_dir, "raw_lafontaine.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(lf_items, f, ensure_ascii=False, indent=2)
        print(f"  ✅ {len(lf_items)} fables extraites -> {out_file}")
        summary["la_fontaine"] = len(lf_items)

    # 3. Cyclopedia
    cyclo_files = glob.glob(os.path.join(source_dir, "*74575*.epub"))
    if cyclo_files:
        print(f"\n[3/4] Extraction de la Cyclopedia of Illustrations ({os.path.basename(cyclo_files[0])})...")
        cyclo_items = extract_cyclopedia(cyclo_files[0])
        out_file = os.path.join(output_dir, "raw_cyclopedia.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(cyclo_items, f, ensure_ascii=False, indent=2)
        print(f"  ✅ {len(cyclo_items)} illustrations extraites -> {out_file}")
        summary["cyclopedia"] = len(cyclo_items)

    # 4. Moody
    moody_files = glob.glob(os.path.join(source_dir, "*19830*.epub"))
    if moody_files:
        print(f"\n[4/4] Extraction des Anecdotes de Moody ({os.path.basename(moody_files[0])})...")
        moody_items = extract_moody(moody_files[0])
        out_file = os.path.join(output_dir, "raw_moody.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(moody_items, f, ensure_ascii=False, indent=2)
        print(f"  ✅ {len(moody_items)} anecdotes extraites -> {out_file}")
        summary["moody"] = len(moody_items)

    total_extracted = sum(summary.values())
    manifest = {
        "timestamp": os.path.getmtime(source_dir) if os.path.exists(source_dir) else None,
        "total_illustrations": total_extracted,
        "details": summary
    }
    with open(os.path.join(output_dir, "raw_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print(f"🎉 EXTRACTION BRUTE TERMINÉE AVEC SUCCÈS !")
    print(f"📊 TOTAL GÉNÉRAL : {total_extracted:,} illustrations prêtes dans {output_dir}")
    print("=" * 70)


if __name__ == "__main__":
    run_full_raw_extraction()
