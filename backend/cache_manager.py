"""Simple cache manager for processed articles"""
import json
import os
import time
from typing import List, Dict, Tuple


class SimpleCache:
    def __init__(self, cache_file: str = 'cache.json', max_age_hours: int = 24):
        self.cache_file = cache_file
        self.max_age_hours = max_age_hours
        self.cache = self._load()

    def _load(self) -> Dict:
        """Load cache from file"""
        if not os.path.exists(self.cache_file):
            return {}

        try:
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}

    def _save(self):
        """Save cache to file"""
        with open(self.cache_file, 'w', encoding='utf-8') as f:
            json.dump(self.cache, f, indent=2, ensure_ascii=False)

    def _is_expired(self, timestamp: float) -> bool:
        """Check if cache entry is expired"""
        age_hours = (time.time() - timestamp) / 3600
        return age_hours > self.max_age_hours

    def get_cached(self, items: List[Dict]) -> List[Dict]:
        """Get cached processed items"""
        cached_items = []

        for item in items:
            link = item.get('link', '')
            if link and link in self.cache:
                entry = self.cache[link]
                timestamp = entry.get('timestamp', 0)

                if not self._is_expired(timestamp):
                    cached_items.append(entry['data'])

        return cached_items

    def filter_uncached(self, items: List[Dict]) -> List[Dict]:
        """Return only items not in cache or expired"""
        uncached = []

        for item in items:
            link = item.get('link', '')
            if not link:
                continue

            if link not in self.cache:
                uncached.append(item)
            else:
                timestamp = self.cache[link].get('timestamp', 0)
                if self._is_expired(timestamp):
                    uncached.append(item)

        return uncached

    def update(self, raw_items: List[Dict], processed_items: List[Dict]):
        """Update cache with newly processed items"""
        # Create mapping of link to processed item
        processed_by_link = {item.get('link'): item for item in processed_items if item.get('link')}

        for raw_item in raw_items:
            link = raw_item.get('link', '')
            if link and link in processed_by_link:
                self.cache[link] = {
                    'timestamp': time.time(),
                    'data': processed_by_link[link]
                }

        self._save()

    def clean_expired(self):
        """Remove expired entries from cache"""
        expired_links = [
            link for link, entry in self.cache.items()
            if self._is_expired(entry.get('timestamp', 0))
        ]

        for link in expired_links:
            del self.cache[link]

        if expired_links:
            self._save()

        return len(expired_links)
