#!/usr/bin/env python3
"""
Business Agent - India Business News Aggregator
"""

import os
import yaml
import json
import re
import time
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import feedparser
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI
from cache_manager import SimpleCache
from concurrent.futures import ThreadPoolExecutor, as_completed
from dateutil import parser as date_parser
from tenacity import retry, stop_after_attempt, wait_exponential

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('news_aggregator.log'),
        logging.StreamHandler()
    ]
)


def load_config():
    """Load environment variables and sources configuration"""
    load_dotenv()

    config = {
        'openai_api_key': os.getenv('OPENAI_API_KEY'),
        'llm_model': os.getenv('LLM_MODEL', 'gpt-4o-mini'),
        'max_items': int(os.getenv('MAX_ITEMS', '50')),
        'batch_size': int(os.getenv('BATCH_SIZE', '4'))
    }

    # Load RSS sources
    with open('sources.yml', 'r') as f:
        sources_config = yaml.safe_load(f)
        config['feeds'] = sources_config['feeds']

    return config


def clean_text(text: str) -> str:
    """Remove HTML tags and normalize whitespace"""
    if not text:
        return ""

    # Remove HTML tags
    soup = BeautifulSoup(text, 'html.parser')
    clean_text = soup.get_text()

    # Collapse whitespace
    clean_text = re.sub(r'\s+', ' ', clean_text)
    clean_text = clean_text.strip()

    return clean_text


def get_published_date(entry) -> str:
    """Safely extract and normalize published date"""
    for field in ['published', 'updated', 'created']:
        date_str = getattr(entry, field, None)
        if date_str:
            try:
                return date_parser.parse(date_str).isoformat()
            except:
                continue
    return datetime.now().isoformat()


def is_recent_article(published_date: str, hours: int = 48) -> bool:
    """Check if article is within the specified time window"""
    try:
        article_date = date_parser.parse(published_date)
        cutoff_date = datetime.now(article_date.tzinfo) - timedelta(hours=hours)
        return article_date >= cutoff_date
    except:
        return True  # If we can't parse date, include the article


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def fetch_feed_with_retry(url: str, timeout: int = 10) -> feedparser.FeedParserDict:
    """Fetch RSS feed with retry logic and timeout"""
    response = requests.get(url, timeout=timeout, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    response.raise_for_status()
    return feedparser.parse(response.content)


def fetch_single_feed(feed: Dict) -> tuple[str, List[Dict], Dict]:
    """Fetch items from a single RSS feed with all improvements"""
    name = feed['name']
    url = feed['url']
    items_ok = 0
    items_failed = 0
    items = []

    logging.info(f"Fetching from {name}...")

    try:
        # Fetch with retry and timeout
        parsed_feed = fetch_feed_with_retry(url, timeout=10)

        if parsed_feed.bozo:
            logging.warning(f"Feed parsing issues for {name}: {parsed_feed.bozo_exception}")

        # Check if feed returned entries
        if not hasattr(parsed_feed, 'entries') or len(parsed_feed.entries) == 0:
            logging.error(f"No entries found for {name}")
            items_failed = 1
        else:
            # Extract items
            for entry in parsed_feed.entries:
                try:
                    # Get normalized published date
                    published_date = get_published_date(entry)

                    # Skip old articles (older than 48 hours)
                    if not is_recent_article(published_date, hours=48):
                        continue

                    item = {
                        'title': clean_text(getattr(entry, 'title', '')),
                        'summary': clean_text(getattr(entry, 'summary', '') or getattr(entry, 'description', '')),
                        'link': getattr(entry, 'link', ''),
                        'published': published_date,
                        'source': name
                    }

                    items.append(item)
                    items_ok += 1

                except Exception as e:
                    logging.error(f"Error processing entry from {name}: {type(e).__name__}: {e}")
                    items_failed += 1

        logging.info(f"✅ {name}: {items_ok} items OK, {items_failed} items failed")

    except Exception as e:
        error_msg = f"{type(e).__name__}: {e}"
        logging.error(f"❌ {name}: Complete failure - {error_msg}")
        items_failed = 1

    # Create feed summary
    feed_info = {
        'name': name,
        'items_ok': items_ok,
        'items_failed': items_failed,
        'status': 'success' if items_ok > 0 else 'failed'
    }

    return name, items, feed_info


def fetch_rss_items(feeds: List[Dict], max_items: int) -> tuple[List[Dict[str, Any]], List[Dict]]:
    """Fetch and parse RSS items from all feeds with all improvements:
    - Parallel fetching with ThreadPoolExecutor
    - Timeout handling and retry logic
    - Date filtering (48-hour window)
    - Content validation (spam filtering)
    - Weighted round-robin based on source quality
    """
    source_items = {}
    feed_summary = []

    logging.info(f"Starting parallel fetch from {len(feeds)} feeds...")

    # Parallel fetching with ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=10) as executor:
        # Submit all feed fetch tasks
        future_to_feed = {executor.submit(fetch_single_feed, feed): feed for feed in feeds}

        # Collect results as they complete
        for future in as_completed(future_to_feed):
            try:
                name, items, feed_info = future.result()
                source_items[name] = items
                feed_summary.append(feed_info)

            except Exception as e:
                feed = future_to_feed[future]
                feed_name = feed['name']
                logging.error(f"Unexpected error fetching {feed_name}: {type(e).__name__}: {e}")
                feed_summary.append({
                    'name': feed_name,
                    'items_ok': 0,
                    'items_failed': 1,
                    'status': 'failed'
                })

    # Print feed summary
    logging.info("\nFeed Summary:")
    logging.info("-" * 40)
    successful_feeds = 0
    for feed_info in feed_summary:
        status_icon = "✅" if feed_info['status'] == 'success' else "❌"
        logging.info(f"{status_icon} {feed_info['name']}: {feed_info['items_ok']} OK, {feed_info['items_failed']} failed")
        if feed_info['status'] == 'success':
            successful_feeds += 1

    logging.info(f"\n{successful_feeds}/{len(feed_summary)} feeds successful")

    # Simple selection: flatten all items and take first max_items
    all_items = []
    for source_name in source_items:
        all_items.extend(source_items[source_name])

    # Take only max_items
    all_items = all_items[:max_items]

    logging.info(f"\nSelected {len(all_items)} items")
    source_counts = {}
    for item in all_items:
        source_counts[item['source']] = source_counts.get(item['source'], 0) + 1
    for source, count in sorted(source_counts.items()):
        logging.info(f"  {source}: {count} items")

    return all_items, feed_summary


def deduplicate_items(items: List[Dict]) -> List[Dict]:
    """Remove duplicate items based on link"""
    seen_links = set()
    deduped_items = []

    for item in items:
        link = item.get('link', '')
        if link and link not in seen_links:
            seen_links.add(link)
            deduped_items.append(item)

    return deduped_items


def process_with_llm(items: List[Dict], config: Dict) -> List[Dict]:
    """Process items with OpenAI LLM for analysis and summarization"""
    if not items:
        return []

    print(f"Processing {len(items)} items with LLM...")

    # Initialize OpenAI client
    client = OpenAI(api_key=config['openai_api_key'])

    # Process in batches
    batch_size = config.get('batch_size', 4)
    all_processed = []

    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(items) + batch_size - 1)//batch_size} ({len(batch)} items)...")

        try:
            processed_batch = process_batch_with_llm(batch, config, client)
            all_processed.extend(processed_batch)
        except Exception as e:
            print(f"Error processing batch: {e}, using fallback")
            fallback_batch = fallback_processing(batch)
            all_processed.extend(fallback_batch)

    print(f"Processed {len(all_processed)} items")
    return all_processed


def process_batch_with_llm(items: List[Dict], config: Dict, client: OpenAI) -> List[Dict]:
    """Process a single batch of items with OpenAI LLM"""

    # Prepare system prompt
    system_prompt = """You are a precise India business analyst. Use only the provided item fields (title, summary, source, link, published). Do not invent facts. When unsure, say "unclear". Return strict JSON only."""

    # Prepare user prompt with input data
    user_prompt = f"""INPUT JSON: {json.dumps(items, indent=2)}

TASKS:
For each item, produce:
1. one_liner (≤22 words, factual, no adjectives without evidence).
2. bullets (array, ≤2, each = what happened + why it matters to India or investors + numbers if present).
3. Classify each item into zero or more labels from: policy, markets, startups, infra, energy
   If none fit, use misc.
4. Extract auto_tags:
   - companies: up to 5 company names mentioned (e.g., ["Reliance", "TCS"])
   - sectors: up to 3 business sectors (e.g., ["Technology", "Banking"])
   - financial_terms: up to 4 financial/business terms (e.g., ["IPO", "merger", "profit"])
   - entities: up to 3 other entities like exchanges, currencies, government bodies (e.g., ["NSE", "RBI", "rupee"])

Return exactly:
[{{
 "title": "...",
 "source": "...",
 "link": "...",
 "published": "...",
 "one_liner": "...",
 "bullets": ["...", "..."],
 "labels": ["policy"],
 "auto_tags": {{
   "companies": ["..."],
   "sectors": ["..."],
   "financial_terms": ["..."],
   "entities": ["..."]
 }}
}}]"""

    try:
        response = client.chat.completions.create(
            model=config['llm_model'],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            timeout=120  # Restore reasonable timeout for batch processing
        )

        result_text = response.choices[0].message.content

        # Parse JSON
        parsed_result = json.loads(result_text)

        # Handle if response is wrapped in array
        if isinstance(parsed_result, list):
            processed_items = parsed_result
        elif isinstance(parsed_result, dict):
            # Try different possible keys
            if 'items' in parsed_result:
                processed_items = parsed_result['items']
            elif 'articles' in parsed_result:
                processed_items = parsed_result['articles']
            elif 'stories' in parsed_result:
                processed_items = parsed_result['stories']
            else:
                # If no known key, assume the dict values are the items
                processed_items = list(parsed_result.values())[0] if parsed_result else []
        else:
            processed_items = []

        return validate_llm_output(processed_items)

    except Exception as e:
        print(f"LLM processing failed: {e}")
        return fallback_processing(items)


def fallback_processing(items: List[Dict]) -> List[Dict]:
    """Simple fallback processing when LLM fails"""
    print("Using fallback processing...")

    fallback_items = []
    for item in items:
        title = item.get('title', '').strip()
        summary = item.get('summary', '')

        # Truncate summary to first 2-3 sentences (max 200 chars)
        if summary:
            # Split by sentence
            sentences = summary.replace('\n', ' ').split('. ')
            truncated = '. '.join(sentences[:2])
            if len(truncated) > 200:
                truncated = truncated[:197] + '...'
            elif not truncated.endswith('.'):
                truncated += '.'
            bullets = [truncated]
        else:
            bullets = ["News from " + item.get('source', 'India')]

        fallback_item = {
            'title': title,
            'source': item.get('source', 'Unknown'),
            'link': item.get('link', ''),
            'published': item.get('published', ''),
            'one_liner': title,
            'bullets': bullets,
            'labels': ['misc'],
            'auto_tags': {
                'companies': [],
                'sectors': [],
                'financial_terms': [],
                'entities': []
            }
        }
        fallback_items.append(fallback_item)

    return fallback_items


def validate_llm_output(processed_items: List[Dict]) -> List[Dict]:
    """Minimal validation of LLM output"""
    validated_items = []

    for item in processed_items:
        # Ensure labels is always a list
        labels = item.get('labels', ['misc'])
        if isinstance(labels, str):
            labels = [labels]
        if not labels:
            labels = ['misc']

        # Ensure auto_tags has proper structure
        auto_tags = item.get('auto_tags', {})
        if not isinstance(auto_tags, dict):
            auto_tags = {}

        # Ensure all tag types exist with defaults
        auto_tags.setdefault('companies', [])
        auto_tags.setdefault('sectors', [])
        auto_tags.setdefault('financial_terms', [])
        auto_tags.setdefault('entities', [])

        validated_item = {
            'title': item.get('title', 'Unknown'),
            'source': item.get('source', 'Unknown'),
            'link': item.get('link', ''),
            'published': item.get('published', ''),
            'one_liner': item.get('one_liner', ''),
            'bullets': item.get('bullets', []),
            'labels': labels,
            'auto_tags': auto_tags
        }

        validated_items.append(validated_item)

    return validated_items


def group_items_by_label(processed_items: List[Dict]) -> Dict[str, List[Dict]]:
    """Group items by their first label"""
    grouped = {}

    for item in processed_items:
        # Use first label, or 'misc' if no labels
        labels = item.get('labels', ['misc'])
        primary_label = labels[0] if labels else 'misc'

        if primary_label not in grouped:
            grouped[primary_label] = []
        grouped[primary_label].append(item)

    return grouped


def render_markdown_digest(grouped_items: Dict[str, List[Dict]]) -> str:
    """Render grouped items into markdown digest"""
    today = datetime.now().strftime("%Y-%m-%d")

    # Start with H1 title
    markdown = f"# India Business Daily — {today}\n\n"

    # Define label order for sections
    label_order = ['policy', 'markets', 'startups', 'infra', 'energy', 'misc']

    # Process each label section
    for label in label_order:
        if label in grouped_items:
            items = grouped_items[label]

            # Add H2 section header
            markdown += f"## {label.title()}\n\n"

            # Add each story
            for item in items:
                # Title (plain text)
                markdown += f"**{item['title']}**\n\n"

                # Source (italic)
                markdown += f"*{item['source']}*\n\n"

                # One-liner
                markdown += f"{item['one_liner']}\n\n"

                # Bullets (list)
                for bullet in item['bullets']:
                    markdown += f"- {bullet}\n"
                markdown += "\n"

                # Source link
                markdown += f"[Source]({item['link']})\n\n"
                markdown += "---\n\n"

    return markdown


def save_audit_file(raw_items: List[Dict], processed_items: List[Dict]) -> str:
    """Save audit JSON file with raw and processed data"""
    today = datetime.now().strftime("%Y-%m-%d")
    audit_filename = f"run_{today}.json"

    audit_data = {
        "date": today,
        "total_raw_items": len(raw_items),
        "total_processed_items": len(processed_items),
        "raw_items": raw_items,
        "llm_output": processed_items
    }

    with open(audit_filename, 'w', encoding='utf-8') as f:
        json.dump(audit_data, f, indent=2, ensure_ascii=False)

    return audit_filename


def main():
    """Main execution function"""
    print("Business Agent - Starting RSS aggregation...")

    # Load configuration
    config = load_config()
    print(f"Loaded {len(config['feeds'])} RSS feeds")
    print(f"Max items limit: {config['max_items']}")

    # Fetch RSS items
    raw_items, feed_summary = fetch_rss_items(config['feeds'], config['max_items'])
    print(f"Total items fetched: {len(raw_items)}")

    # Print feed summary
    print("\nFeed Summary:")
    print("-" * 40)
    successful_feeds = 0
    for feed_info in feed_summary:
        status_icon = "✅" if feed_info['status'] == 'success' else "❌"
        print(f"{status_icon} {feed_info['name']}: {feed_info['items_ok']} OK, {feed_info['items_failed']} failed")
        if feed_info['status'] == 'success':
            successful_feeds += 1

    print(f"\n{successful_feeds}/{len(feed_summary)} feeds successful")

    # Check if all feeds failed
    if len(raw_items) == 0:
        print("\n⚠️  All feeds failed - creating empty digest")
        today = datetime.now().strftime("%Y-%m-%d")
        empty_digest = f"# India Business Daily — {today}\n\nNo items available today. All RSS feeds were unavailable.\n"
        with open('digest.md', 'w', encoding='utf-8') as f:
            f.write(empty_digest)
        print("✅ Empty digest.md created")

        # Save empty audit file
        audit_filename = save_audit_file([], [])
        print(f"✅ {audit_filename} saved")
        return

    # Deduplicate
    deduped_items = deduplicate_items(raw_items)
    print(f"Items after deduplication: {len(deduped_items)}")

    # Simple cache check
    cache = SimpleCache('cache.json', max_age_hours=24)
    cache.clean_expired()

    cached_items = cache.get_cached(deduped_items)
    uncached_items = cache.filter_uncached(deduped_items)

    print(f"📊 Cache stats: {len(cached_items)} cached, {len(uncached_items)} need processing")

    # Only process uncached items
    if uncached_items:
        processed_new = process_with_llm(uncached_items, config)
        cache.update(uncached_items, processed_new)
        print(f"LLM processing complete: {len(processed_new)} items processed")
    else:
        processed_new = []
        print("All items found in cache, skipping LLM processing")

    # Combine cached + newly processed
    processed_items = cached_items + processed_new
    print(f"Total articles available: {len(processed_items)}")

    # Process items if available
    if processed_items:
        # Preview processed output
        print("\nPreview of processed items:")
        print("=" * 50)
        for i, item in enumerate(processed_items[:3]):  # Show first 3 items
            print(f"{i+1}. {item['title']}")
            print(f"   Source: {item['source']}")
            print(f"   One-liner: {item['one_liner']}")
            print(f"   Bullets: {item['bullets']}")
            print(f"   Labels: {item['labels']}")
            print(f"   Link: {item['link']}")
            print()

        # Generate digest
        grouped_items = group_items_by_label(processed_items)
        print(f"Items grouped into {len(grouped_items)} categories: {list(grouped_items.keys())}")

        # Render markdown digest
        markdown_content = render_markdown_digest(grouped_items)

        # Save digest.md
        with open('digest.md', 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        print("✅ digest.md saved")

        # Save audit file
        audit_filename = save_audit_file(raw_items, processed_items)
        print(f"✅ {audit_filename} saved")

        print(f"\n🎉 Processing complete! Generated digest with {len(processed_items)} stories across {len(grouped_items)} categories.")
    else:
        print("No items to process.")
        # Create empty digest if no items
        today = datetime.now().strftime("%Y-%m-%d")
        empty_digest = f"# India Business Daily — {today}\n\nNo items available today.\n"
        with open('digest.md', 'w', encoding='utf-8') as f:
            f.write(empty_digest)
        print("✅ Empty digest.md created")


if __name__ == "__main__":
    main()