import sys, os
sys.path.insert(0, os.path.abspath('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app'))

from core.articles_feed_scraper import ArticlesFeedScraper

scraper = ArticlesFeedScraper()
source = {
    "id": "e21",
    "name": "Évangile 21",
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

article_item = {
    "id": "e21_test",
    "source_id": "e21",
    "title": "Trouver les hauteurs et chercher de l’eau: lire les livres des Rois",
    "url": "https://evangile21.thegospelcoalition.org/article/trouver-les-hauteurs-et-chercher-de-leau-lire-les-livres-des-rois/",
    "source_config": source
}

md_content, author, image_url, avatar_url, lead, audio = scraper.fetch_full_article_content(article_item)

print("Fetched author:", author)
print("Fetched avatar:", avatar_url)
print("\n--- LAST 800 CHARACTERS OF MD ---")
print(md_content[-800:])
