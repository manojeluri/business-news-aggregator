#!/usr/bin/env python3
"""
Business Agent - India Business News Aggregator
"""

import os
import yaml
import json
import re
from datetime import datetime
from typing import List, Dict, Any
import feedparser
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI


def load_config():
    """Load environment variables and sources configuration"""
    load_dotenv()

    # Load environment variables
    config = {
        'openai_api_key': os.getenv('OPENAI_API_KEY'),
        'llm_model': os.getenv('LLM_MODEL', 'gpt-4o-mini'),
        'max_items': int(os.getenv('MAX_ITEMS', 12))
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


def fetch_rss_items(feeds: List[Dict], max_items: int) -> tuple[List[Dict[str, Any]], List[Dict]]:
    """Fetch and parse RSS items from all feeds with source diversity"""
    source_items = {}  # Store items by source for round-robin selection
    feed_summary = []

    # First, fetch all items from all sources
    for feed in feeds:
        name = feed['name']
        url = feed['url']
        items_ok = 0
        items_failed = 0

        print(f"Fetching from {name}...")

        try:
            # Parse RSS feed
            parsed_feed = feedparser.parse(url)

            if parsed_feed.bozo:
                print(f"  Warning: Feed parsing issues for {name} - {parsed_feed.bozo_exception}")

            # Check if feed actually returned entries
            if not hasattr(parsed_feed, 'entries') or len(parsed_feed.entries) == 0:
                print(f"  No entries found for {name}")
                items_failed = 1  # Count as one failed attempt
            else:
                source_items[name] = []

                # Extract items
                for entry in parsed_feed.entries:
                    try:
                        item = {
                            'title': clean_text(getattr(entry, 'title', '')),
                            'summary': clean_text(getattr(entry, 'summary', '') or getattr(entry, 'description', '')),
                            'link': getattr(entry, 'link', ''),
                            'published': getattr(entry, 'published', ''),
                            'source': name
                        }

                        # Only add if we have minimum required fields
                        if item['title'] and item['link']:
                            source_items[name].append(item)
                            items_ok += 1
                        else:
                            items_failed += 1

                    except Exception as e:
                        print(f"  Error processing entry from {name}: {e}")
                        items_failed += 1

            print(f"  ✅ {name}: {items_ok} items OK, {items_failed} items failed")

        except Exception as e:
            print(f"  ❌ {name}: Complete failure - {e}")
            items_failed = 1

        # Record feed summary
        feed_summary.append({
            'name': name,
            'items_ok': items_ok,
            'items_failed': items_failed,
            'status': 'success' if items_ok > 0 else 'failed'
        })

    # Now implement round-robin selection to ensure source diversity
    all_items = []
    working_sources = [name for name in source_items.keys() if source_items[name]]
    source_indices = {name: 0 for name in working_sources}

    # Round-robin through sources
    while len(all_items) < max_items and working_sources:
        items_added_this_round = 0

        for source_name in working_sources[:]:  # Use slice to avoid modification issues
            if source_indices[source_name] < len(source_items[source_name]):
                all_items.append(source_items[source_name][source_indices[source_name]])
                source_indices[source_name] += 1
                items_added_this_round += 1

                if len(all_items) >= max_items:
                    break
            else:
                # This source is exhausted, remove it
                working_sources.remove(source_name)

        # If no items were added this round, break to avoid infinite loop
        if items_added_this_round == 0:
            break

    print(f"\nSelected {len(all_items)} items with source diversity:")
    source_counts = {}
    for item in all_items:
        source_counts[item['source']] = source_counts.get(item['source'], 0) + 1
    for source, count in source_counts.items():
        print(f"  {source}: {count} items")

    return all_items, feed_summary


def deduplicate_items(items: List[Dict]) -> List[Dict]:
    """Remove duplicate items based on title and link"""
    seen = set()
    deduped_items = []

    for item in items:
        # Create dedup key from first 120 chars of lowercase title + link
        title_key = item['title'].lower()[:120]
        dedup_key = (title_key, item['link'])

        if dedup_key not in seen:
            seen.add(dedup_key)
            deduped_items.append(item)

    return deduped_items


def process_with_llm(items: List[Dict], config: Dict) -> List[Dict]:
    """Process items with OpenAI LLM for summarization and classification"""
    if not items:
        return []

    client = OpenAI(api_key=config['openai_api_key'])

    # Process in smaller batches to avoid timeouts
    batch_size = 8  # Reduced to 8 for Railway timeout limits
    all_processed = []

    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(items) + batch_size - 1)//batch_size} ({len(batch)} items)...")

        try:
            processed_batch = process_batch_with_llm(batch, config, client)
            all_processed.extend(processed_batch)
        except Exception as e:
            print(f"Error processing batch {i//batch_size + 1}: {e}")
            # Continue with next batch
            continue

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

Return exactly:
[{{
 "title": "...",
 "source": "...",
 "link": "...",
 "one_liner": "...",
 "bullets": ["...", "..."],
 "labels": ["policy"]
}}]"""

    try:
        response = client.chat.completions.create(
            model=config['llm_model'],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            timeout=60  # Add timeout for individual requests
        )

        result_text = response.choices[0].message.content

        # Parse JSON
        try:
            parsed_result = json.loads(result_text)
            print(f"Raw LLM response type: {type(parsed_result)}")
            print(f"Raw LLM response keys: {list(parsed_result.keys()) if isinstance(parsed_result, dict) else 'Not a dict'}")

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

            print(f"LLM processed {len(processed_items)} items")
            return validate_llm_output(processed_items)

        except json.JSONDecodeError as e:
            print(f"JSON parsing failed: {e}")
            print(f"Raw response: {result_text[:200]}...")
            # Retry once with simpler prompt
            return retry_llm_processing(items, config, client)

    except Exception as e:
        print(f"LLM processing failed: {e}")
        return fallback_processing(items)


def retry_llm_processing(items: List[Dict], config: Dict, client: OpenAI) -> List[Dict]:
    """Retry LLM processing with simpler approach"""
    print("Retrying with simplified prompt...")

    simple_prompt = f"""Summarize these India business news items into JSON. For each item return: title, source, link, one_liner (max 22 words), bullets (max 2), labels (from: policy, markets, startups, infra, energy, misc).

Items: {json.dumps(items[:3], indent=2)}

Return JSON array."""

    try:
        response = client.chat.completions.create(
            model=config['llm_model'],
            messages=[{"role": "user", "content": simple_prompt}],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        if isinstance(result, list):
            return validate_llm_output(result)
        else:
            return validate_llm_output(result.get('items', []))

    except Exception as e:
        print(f"Retry failed: {e}")
        return fallback_processing(items)


def fallback_processing(items: List[Dict]) -> List[Dict]:
    """Fallback processing when LLM fails"""
    print("Using fallback processing...")

    fallback_items = []
    for item in items:
        fallback_item = {
            'title': item['title'],
            'source': item['source'],
            'link': item['link'],
            'one_liner': 'unclear',
            'bullets': ['Data processing unavailable'],
            'labels': ['misc']
        }
        fallback_items.append(fallback_item)

    return fallback_items


def validate_llm_output(processed_items: List[Dict]) -> List[Dict]:
    """Validate and clean LLM output"""
    valid_labels = {'policy', 'markets', 'startups', 'infra', 'energy', 'misc'}
    validated_items = []

    for item in processed_items:
        # Validate one_liner length
        one_liner = item.get('one_liner', 'unclear')
        if len(one_liner.split()) > 22:
            one_liner = ' '.join(one_liner.split()[:22])

        # Validate bullets length
        bullets = item.get('bullets', [])
        if len(bullets) > 2:
            bullets = bullets[:2]

        # Validate labels
        labels = item.get('labels', ['misc'])
        if isinstance(labels, str):
            labels = [labels]
        labels = [label for label in labels if label in valid_labels]
        if not labels:
            labels = ['misc']

        validated_item = {
            'title': item.get('title', 'Unknown'),
            'source': item.get('source', 'Unknown'),
            'link': item.get('link', ''),
            'one_liner': one_liner,
            'bullets': bullets,
            'labels': labels
        }
        validated_items.append(validated_item)

    print(f"Validated {len(validated_items)} items")
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

    # Process with LLM
    if deduped_items:
        processed_items = process_with_llm(deduped_items, config)
        print(f"LLM processing complete: {len(processed_items)} items processed")

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