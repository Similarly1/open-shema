import sqlite3

conn = sqlite3.connect('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/articles.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(sources)")
print("Columns in sources:", cursor.fetchall())

cursor.execute("SELECT * FROM sources")
for r in cursor.fetchall():
    print("Source row:", r)

cursor.execute("SELECT source_id, COUNT(*) FROM articles GROUP BY source_id")
print("\nArticles count by source_id in articles table:")
for r in cursor.fetchall():
    print(r)

conn.close()
