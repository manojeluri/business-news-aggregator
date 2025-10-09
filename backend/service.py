#!/usr/bin/env python3
"""
Background Service - Continuously process news articles
Runs every 5 minutes to keep latest_digest.json fresh
"""

import os
import json
import time
import logging
from datetime import datetime
from app import (
    load_config,
    fetch_rss_items,
    deduplicate_items,
    process_with_llm,
    group_items_by_label,
    save_audit_file
)
from cache_manager import SimpleCache

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('service.log'),
        logging.StreamHandler()
    ]
)

# Service configuration
REFRESH_INTERVAL = 5 * 60  # 5 minutes in seconds
STATUS_FILE = 'service_status.json'
DIGEST_FILE = 'latest_digest.json'


def update_status(status: str, message: str = "", last_update: str = None):
    """Update service status file"""
    status_data = {
        'status': status,
        'message': message,
        'last_update': last_update or datetime.now().isoformat(),
        'next_update': datetime.fromtimestamp(time.time() + REFRESH_INTERVAL).isoformat() if status == 'idle' else None
    }

    with open(STATUS_FILE, 'w', encoding='utf-8') as f:
        json.dump(status_data, f, indent=2)


def process_and_save():
    """Main processing function - fetches, processes, and saves digest"""
    try:
        logging.info("=" * 60)
        logging.info("Starting news processing cycle...")
        update_status('processing', 'Fetching RSS feeds...')

        # Load configuration
        config = load_config()
        logging.info(f"Loaded {len(config['feeds'])} RSS feeds")

        # Fetch RSS items
        update_status('processing', 'Fetching articles from feeds...')
        raw_items, feed_summary = fetch_rss_items(config['feeds'], config['max_items'])
        logging.info(f"Total items fetched: {len(raw_items)}")

        # Check if we got any items
        if len(raw_items) == 0:
            logging.warning("No items fetched - all feeds failed")
            empty_digest = {
                'date': datetime.now().strftime("%Y-%m-%d"),
                'categories': {},
                'total_items': 0,
                'message': 'No articles available - all feeds unavailable'
            }
            with open(DIGEST_FILE, 'w', encoding='utf-8') as f:
                json.dump(empty_digest, f, indent=2, ensure_ascii=False)

            update_status('idle', 'All feeds failed', datetime.now().isoformat())
            return

        # Deduplicate
        update_status('processing', 'Removing duplicates...')
        deduped_items = deduplicate_items(raw_items)
        logging.info(f"Items after deduplication: {len(deduped_items)}")

        # Cache check
        update_status('processing', 'Checking cache...')
        cache = SimpleCache('cache.json', max_age_hours=24)
        cache.clean_expired()

        cached_items = cache.get_cached(deduped_items)
        uncached_items = cache.filter_uncached(deduped_items)

        logging.info(f"📊 Cache stats: {len(cached_items)} cached, {len(uncached_items)} need processing")

        # Process uncached items with LLM
        if uncached_items:
            update_status('processing', f'Processing {len(uncached_items)} articles with LLM...')
            processed_new = process_with_llm(uncached_items, config)
            cache.update(uncached_items, processed_new)
            logging.info(f"LLM processing complete: {len(processed_new)} items processed")
        else:
            processed_new = []
            logging.info("All items found in cache, skipping LLM processing")

        # Combine cached + newly processed
        processed_items = cached_items + processed_new
        logging.info(f"Total articles available: {len(processed_items)}")

        if not processed_items:
            logging.warning("No processed items available")
            empty_digest = {
                'date': datetime.now().strftime("%Y-%m-%d"),
                'categories': {},
                'total_items': 0,
                'message': 'No articles available'
            }
            with open(DIGEST_FILE, 'w', encoding='utf-8') as f:
                json.dump(empty_digest, f, indent=2, ensure_ascii=False)

            update_status('idle', 'No articles available', datetime.now().isoformat())
            return

        # Group by category
        update_status('processing', 'Organizing articles by category...')
        grouped_items = group_items_by_label(processed_items)
        logging.info(f"Items grouped into {len(grouped_items)} categories: {list(grouped_items.keys())}")

        # Map labels to friendly section names
        section_names = {
            'policy': 'Policy & Regulation',
            'markets': 'Markets',
            'startups': 'Startups & Innovation',
            'infra': 'Infrastructure & Real Estate',
            'energy': 'Energy & Resources',
            'misc': 'Business News'
        }

        # Create digest structure
        categories = {}
        for label, items in grouped_items.items():
            section_name = section_names.get(label, label.title())
            categories[section_name] = items

        digest_data = {
            'date': datetime.now().strftime("%Y-%m-%d"),
            'last_updated': datetime.now().isoformat(),
            'categories': categories,
            'total_items': len(processed_items),
            'feed_summary': feed_summary
        }

        # Save digest
        update_status('processing', 'Saving digest...')
        with open(DIGEST_FILE, 'w', encoding='utf-8') as f:
            json.dump(digest_data, f, indent=2, ensure_ascii=False)

        logging.info(f"✅ Saved {DIGEST_FILE} with {len(processed_items)} articles")

        # Save audit file
        audit_filename = save_audit_file(raw_items, processed_items)
        logging.info(f"✅ Saved {audit_filename}")

        # Update status to idle
        update_status('idle', f'Successfully processed {len(processed_items)} articles', datetime.now().isoformat())
        logging.info(f"🎉 Processing complete! Next update in {REFRESH_INTERVAL // 60} minutes")

    except Exception as e:
        logging.error(f"❌ Error during processing: {type(e).__name__}: {e}", exc_info=True)
        update_status('error', f'{type(e).__name__}: {str(e)}')


def run_service():
    """Main service loop - runs continuously"""
    logging.info("🚀 Business Agent Background Service Starting...")
    logging.info(f"Refresh interval: {REFRESH_INTERVAL // 60} minutes")

    # Initial status
    update_status('starting', 'Service initializing...')

    # Run initial processing immediately
    process_and_save()

    # Continuous loop
    while True:
        try:
            logging.info(f"⏰ Sleeping for {REFRESH_INTERVAL // 60} minutes...")
            time.sleep(REFRESH_INTERVAL)

            # Process again
            process_and_save()

        except KeyboardInterrupt:
            logging.info("🛑 Service stopped by user")
            update_status('stopped', 'Service stopped by user')
            break
        except Exception as e:
            logging.error(f"❌ Unexpected error in service loop: {e}", exc_info=True)
            update_status('error', f'Service error: {str(e)}')
            # Wait a bit before retrying
            time.sleep(60)


if __name__ == "__main__":
    run_service()
