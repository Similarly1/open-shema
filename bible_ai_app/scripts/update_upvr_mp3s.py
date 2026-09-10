import sqlite3
import urllib.request
import xml.etree.ElementTree as ET
import re
import os

def update_upvr_mp3s():
    rss_url = 'https://anchor.fm/s/86da8348/podcast/rss'
    print(f"Fetching RSS feed from {rss_url}...")
    req = urllib.request.Request(rss_url, headers={'User-Agent': 'Mozilla/5.0'})
    content = urllib.request.urlopen(req).read()
    root = ET.fromstring(content)
    channel = root.find('channel')
    items = channel.findall('item')

    feed_by_num = {}
    for item in items:
        title = item.find('title').text or ''
        m = re.search(r'[#\s](\d{3})\b', title)
        if not m:
            m = re.search(r'épisode\s+(\d+)', title, re.I)
        if m:
            num = int(m.group(1))
            enc = item.find('enclosure')
            duration_el = item.find('{http://www.itunes.com/dtds/podcast-1.0.dtd}duration')
            duration = duration_el.text if duration_el is not None else ''
            if enc is not None and enc.get('url'):
                feed_by_num[num] = {
                    'mp3_url': enc.get('url'),
                    'duration': duration
                }

    print(f"Parsed {len(feed_by_num)} episodes with MP3 URLs from RSS feed.")

    db_paths = [
        os.path.abspath("bible_ai_app/data/upvr_corpus.sqlite"),
        os.path.abspath("data/upvr_corpus/upvr_corpus.sqlite")
    ]

    for db_path in db_paths:
        if not os.path.exists(db_path):
            print(f"Skipping non-existent DB: {db_path}")
            continue

        print(f"\nUpdating database: {db_path}")
        conn = sqlite3.connect(db_path)
        c = conn.cursor()

        # Check if columns exist
        c.execute("PRAGMA table_info(upvr_episodes)")
        cols = [col[1] for col in c.fetchall()]

        if "mp3_url" not in cols:
            print("  Adding column 'mp3_url'...")
            c.execute("ALTER TABLE upvr_episodes ADD COLUMN mp3_url TEXT")
        if "duration" not in cols:
            print("  Adding column 'duration'...")
            c.execute("ALTER TABLE upvr_episodes ADD COLUMN duration TEXT")

        c.execute("SELECT episode_number FROM upvr_episodes")
        rows = c.fetchall()

        updated_count = 0
        for (ep_num,) in rows:
            if ep_num in feed_by_num:
                info = feed_by_num[ep_num]
                c.execute(
                    "UPDATE upvr_episodes SET mp3_url = ?, duration = ? WHERE episode_number = ?",
                    (info['mp3_url'], info['duration'], ep_num)
                )
                updated_count += 1

        conn.commit()
        conn.close()
        print(f"  Successfully updated {updated_count}/{len(rows)} episodes in {os.path.basename(db_path)}.")

if __name__ == '__main__':
    update_upvr_mp3s()
