import sys, os
sys.path.insert(0, os.path.abspath('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app'))

from core.articles_db import ArticlesDB
from core.articles_feed_scraper import ArticlesFeedScraper

db = ArticlesDB()
scraper = ArticlesFeedScraper()

# Fetch and update all e21 articles in database
articles = db.get_articles(source_id='e21', limit=50)
print(f"Found {len(articles)} articles for e21 to re-check avatars")

for art in articles:
    url = art.get('url')
    author = art.get('author')
    item = {
        'id': art['id'],
        'source_id': 'e21',
        'title': art['title'],
        'url': url,
        'author': author,
        'source_config': {
            'id': 'e21',
            'name': 'Évangile 21',
            'selectors': {
                'content': '.entry-content, .post-content, .article-content, .article__content, article .content, main article',
                'author': '.author-name, .entry-author, .author a, .post-author, .author-info, .article__author',
                'excludes': ['.single-header', '.single-meta', '.single-footer', '.single-related', '.sharedaddy', '.jp-relatedposts', '.newsletter-box', '.social-share']
            }
        }
    }
    content, real_author, img_url, avatar_url, lead, audio = scraper.fetch_full_article_content(item)
    if real_author:
        author = real_author
    
    print(f"[{art['id']}] Author: {author:25} | Avatar: {avatar_url}")

    # Write updated markdown
    if art.get('content_file_path') and content:
        abs_path = os.path.abspath(art['content_file_path'])
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write(content)

    art_dict = dict(art)
    art_dict['author'] = author
    art_dict['author_avatar_url'] = avatar_url or ''
    art_dict['image_url'] = img_url or art_dict.get('image_url', '')
    art_dict['lead_summary'] = lead or art_dict.get('lead_summary', '')
    art_dict['audio_url'] = audio or art_dict.get('audio_url', '')

    db.upsert_article(art_dict, art_dict.get('scripture_references'))

print("\nDatabase and markdown files update completed successfully!")
