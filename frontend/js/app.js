// Business Agent Frontend App
class NewsApp {
    constructor() {
        this.apiUrl = '/api';  // Use relative path since we're on the same server
        this.init();
    }

    async init() {
        await this.loadNews();
        this.setupAutoRefresh();
    }

    async loadNews() {
        try {
            this.showLoading();
            const response = await fetch(`${this.apiUrl}/cards`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                this.renderNews(result.data.categories);
                this.updateStats(result.data.stats);
                this.hideLoading();
            } else {
                throw new Error(result.error || 'Failed to load news');
            }
        } catch (error) {
            console.error('Failed to load news:', error);
            this.showError(error.message);
        }
    }

    renderNews(categorizedNews) {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = '';

        if (Object.keys(categorizedNews).length === 0) {
            mainContent.innerHTML = `
                <div class="loading">
                    <p>No news available. Try refreshing to fetch the latest stories.</p>
                </div>
            `;
            return;
        }

        for (const [categoryKey, categoryData] of Object.entries(categorizedNews)) {
            const section = this.createCategorySection(categoryKey, categoryData);
            mainContent.appendChild(section);
        }

        mainContent.style.display = 'block';
    }

    createCategorySection(categoryKey, categoryData) {
        const section = document.createElement('section');
        section.className = 'category-section';

        section.innerHTML = `
            <div class="category-header">
                <div class="category-icon" style="background-color: ${categoryData.color};"></div>
                <h2 class="category-title">${categoryData.name}</h2>
                <span class="category-count">${categoryData.articles.length} stories</span>
            </div>
            <div class="cards-grid">
                ${categoryData.articles.map(article => this.createNewsCard(article, categoryData.color)).join('')}
            </div>
        `;

        return section;
    }

    createNewsCard(item, color) {
        const bullets = item.bullets ?
            `<ul class="card-bullets">
                ${item.bullets.map(bullet => `<li>${this.escapeHtml(bullet)}</li>`).join('')}
            </ul>` : '';

        const labels = item.labels ?
            item.labels.map(label => `<span class="label-tag">${this.escapeHtml(label)}</span>`).join('') : '';

        return `
            <article class="news-card" style="border-left-color: ${color};">
                <div class="card-header">
                    <h3 class="card-title">
                        <a href="${this.escapeHtml(item.link)}" target="_blank" rel="noopener">
                            ${this.escapeHtml(item.title)}
                        </a>
                    </h3>
                    <div class="card-source">${this.escapeHtml(item.source)}</div>
                </div>

                <div class="card-content">
                    <p class="card-summary">${this.escapeHtml(item.one_liner)}</p>
                    ${bullets}
                </div>

                <div class="card-footer">
                    <div class="card-labels">
                        ${labels}
                    </div>
                    <a href="${this.escapeHtml(item.link)}" target="_blank" rel="noopener" class="source-link">
                        Read More →
                    </a>
                </div>
            </article>
        `;
    }

    updateStats(stats) {
        document.getElementById('total-stories').textContent = stats.total_stories;
        document.getElementById('total-categories').textContent = stats.total_categories;
        document.getElementById('last-updated').textContent = stats.last_updated;
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    showError(message) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';

        const errorElement = document.getElementById('error');
        errorElement.querySelector('p').textContent = `Failed to load news: ${message}`;
        errorElement.style.display = 'block';
    }

    async refreshNews() {
        const refreshBtn = document.querySelector('.refresh-btn');
        const originalText = refreshBtn.innerHTML;

        try {
            // Show loading state
            refreshBtn.innerHTML = '🔄 Refreshing...';
            refreshBtn.classList.add('refreshing');
            refreshBtn.disabled = true;

            // Trigger refresh on backend
            const refreshResponse = await fetch(`${this.apiUrl}/refresh`, {
                method: 'GET'
            });

            if (!refreshResponse.ok) {
                throw new Error(`Refresh failed: ${refreshResponse.statusText}`);
            }

            const refreshResult = await refreshResponse.json();

            if (!refreshResult.success) {
                throw new Error(refreshResult.error || 'Refresh failed');
            }

            // Reload the news data
            await this.loadNews();
            this.showNotification('News refreshed successfully!');

        } catch (error) {
            console.error('Refresh failed:', error);
            this.showNotification('Failed to refresh news. Please try again.', 'error');
        } finally {
            // Reset button
            refreshBtn.innerHTML = originalText;
            refreshBtn.classList.remove('refreshing');
            refreshBtn.disabled = false;
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = 'notification';

        if (type === 'error') {
            notification.style.background = '#EF4444';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Hide notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    setupAutoRefresh() {
        // Auto-refresh every 30 minutes
        setInterval(async () => {
            try {
                const response = await fetch(`${this.apiUrl}/refresh`);
                const result = await response.json();

                if (result.success) {
                    await this.loadNews();
                    this.showNotification('News updated automatically');
                }
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }, 30 * 60 * 1000); // 30 minutes
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for button clicks
async function refreshNews() {
    await window.newsApp.refreshNews();
}

async function loadNews() {
    await window.newsApp.loadNews();
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.newsApp = new NewsApp();
});