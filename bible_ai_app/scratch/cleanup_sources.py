import sqlite3

conn = sqlite3.connect('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/articles.db')
cursor = conn.cursor()

# Remove obsolete sources without articles
cursor.execute("DELETE FROM sources WHERE id IN ('evangile21', 'leboncombat') AND (SELECT COUNT(*) FROM articles WHERE source_id = sources.id) = 0")
conn.commit()

cursor.execute("SELECT id, name, feed_url, is_enabled, (SELECT COUNT(*) FROM articles WHERE source_id = sources.id) as count FROM sources")
print("Remaining sources in DB:")
for r in cursor.fetchall():
    print(" -", r)

conn.close()
