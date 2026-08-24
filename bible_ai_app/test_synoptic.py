from core.synoptic_manager import SynopticManager

def test_synoptic():
    sm = SynopticManager.get_instance()
    print("Total pericopes loaded:", len(sm.pericopes))
    
    # 1. Test verse parallels for Matthew 9:2
    par_9_2 = sm.get_parallels_for_verse("MAT", 9, 2)
    print("\n--- Parallels for MAT 9:2 ---")
    for p in par_9_2:
        print(f"Pericope #{p['pericope_id']} [{p['tradition_type']}]: {p['title_fr']}")
        for item in p['parallels']:
            print(f"  -> {item['abbr']} : {item['ref']}")

    # 2. Test context for passage MAT 9:1-8
    ctx = sm.get_synoptic_context_for_passage("MAT", 9, 1, 9, 8, bible_name="LSG")
    print("\n--- Synoptic Context for MAT 9:1-8 ---")
    print("Has synoptic:", ctx.get("has_synoptic"))
    print("Primary pericope ID:", ctx.get("primary_pericope_id"))
    print("Verse parallels count:", len(ctx.get("verse_parallels", {})))
    syn_mat = ctx.get("synopsis_matrix")
    if syn_mat:
        print(f"Synopsis Title: {syn_mat['title_fr']} ({syn_mat['tradition_type']})")
        print("Columns:", [c["book"] for c in syn_mat["columns"]])
        print("Total rows:", len(syn_mat["rows"]))
        if syn_mat["rows"]:
            print("First row sample:", syn_mat["rows"][0]["cells"])

    # 3. Test non-gospel (ROM 8:1)
    rom_ctx = sm.get_synoptic_context_for_passage("ROM", 8, 1, 8, 10)
    print("\n--- Synoptic Context for ROM 8:1-10 ---")
    print("Has synoptic:", rom_ctx.get("has_synoptic"))

if __name__ == "__main__":
    test_synoptic()
