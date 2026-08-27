import sys, os
sys.path.insert(0, os.path.abspath('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app'))

from core.articles_feed_scraper import ArticlesFeedScraper

source = {
    "id": "e21",
    "name": "Évangile 21",
    "website_url": "https://evangile21.thegospelcoalition.org",
    "feed_url": "https://evangile21.thegospelcoalition.org/feed/",
    "category": "pastoral_theologique",
    "description": "Ressources théologiques, études bibliques et réflexions pastorales par The Gospel Coalition France.",
    "enabled_by_default": True,
    "selectors": {
        "content": ".entry-content, .post-content, .article-content, .article__content, article .content, main article",
        "author": ".author-name, .entry-author, .author a, .post-author, .author-info, .article__author",
        "excludes": [
            ".single-header",
            ".single-meta",
            ".single-footer",
            ".single-related",
            ".sharedaddy",
            ".jp-relatedposts",
            ".newsletter-box",
            ".social-share",
            ".social-sharing",
            "nav.post-navigation",
            ".comments-area",
            ".article__social",
            ".article__more"
        ]
    }
}

scraper = ArticlesFeedScraper()
xml = scraper.fetch_feed_xml(source["feed_url"])
items = scraper.parse_feed_items(xml, source)

if items:
    sample = items[0]
    processed = scraper.process_article(sample)
    print("Processed Title:", processed["title"])
    print("Scripture references:", processed["scripture_references"])
    print("Markdown length:", len(processed["content_markdown"]))
    print("\n--- FIRST 600 CHARACTERS ---")
    print(processed["content_markdown"][:600])
