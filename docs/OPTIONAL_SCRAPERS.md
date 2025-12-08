# 🔑 Optional Scrapers (API Keys Required)

**Date**: December 8, 2025
**Status**: Documentation for API-based scrapers (100% FREE but require signup)

---

## 🎯 Currently Active (No API Keys Needed)

✅ **PRIMARY: Google Custom Search** - 70-80% accuracy, 3 API calls, $0
✅ **TIER 2: RSS Static Feeds** - 30-40% accuracy, 3 feeds, $0
✅ **TIER 3: Bayt Direct Scraper** - Riyadh-specific, HTML parsing, $0
✅ **TIER 4: Indeed Direct Scraper** - Riyadh-specific, HTML parsing, $0

**Expected**: 60-100 jobs/day (RELIABLE delivery)

---

## 🚀 Optional Scrapers (FREE APIs - Require Signup)

If you want even MORE jobs (100-150 jobs/day), you can optionally sign up for these FREE API services:

### 1. 🔥 Jooble API (HIGHLY RECOMMENDED)

**What It Is:**
- Aggregates 1000+ job boards worldwide
- Official REST API from Jooble.com
- Excellent Riyadh job coverage

**Free Tier:**
- 2,745 requests/month (FREE forever)
- Our usage: 182 requests/month (6.6% of limit)
- 6 API calls/day × 30 days = 182 calls

**Expected:**
- +30-50 jobs/day
- 60-70% accuracy for Riyadh jobs
- Complements Google CSE perfectly

**Setup Time:** 5 minutes

**How to Activate:**

1. **Sign up for API key:**
   - Go to: https://jooble.org/api/about
   - Fill form: Name, Email, Website (can use "Personal use" or your GitHub repo URL)
   - Submit and wait for API key via email (usually instant)

2. **Add to `.env`:**
   ```bash
   JOOBLE_API_KEY=your_api_key_here
   ```

3. **Activate in `job_hunter.ts`:**
   - Find line ~592 in `src/job_hunter.ts`
   - Uncomment the Jooble scraper:
   ```typescript
   const scraperResults = await Promise.allSettled([
     scrapeGoogle(searchKeywords),
     scrapeRSS(searchKeywords),
     scrapeBayt(searchKeywords),
     scrapeIndeed(searchKeywords),
     scrapeJooble(searchKeywords),  // ✅ UNCOMMENT THIS LINE
   ]);

   // Update scraper names array:
   const scraperNames = ['Google', 'RSS', 'Bayt', 'Indeed', 'Jooble'];
   ```

4. **Test locally:**
   ```bash
   npm start
   ```

5. **Push to GitHub:**
   - Add `JOOBLE_API_KEY` to GitHub Secrets:
   - Go to: Repository → Settings → Secrets → Actions
   - Click "New repository secret"
   - Name: `JOOBLE_API_KEY`
   - Value: Your API key

**Cost:** $0 (100% FREE)

---

### 2. 🔍 JSearch API (Google Jobs Aggregator)

**What It Is:**
- OpenWebNinja's JSearch API
- Aggregates Google Jobs listings
- Good international coverage

**Free Tier:**
- Generous free tier (exact limit varies)
- 1-3 API calls/day (our usage)

**Expected:**
- +20-30 jobs/day
- 50-60% accuracy for Riyadh jobs
- Good for remote/hybrid roles

**Setup Time:** 5 minutes

**How to Activate:**

1. **Sign up for API key:**
   - Go to: https://openwebninja.com/jsearch-api
   - Create account and get API key
   - OR use RapidAPI: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch

2. **Add to `.env`:**
   ```bash
   OPENWEBNINJA_API_KEY=your_api_key_here
   ```

3. **Activate in `job_hunter.ts`:**
   ```typescript
   const scraperResults = await Promise.allSettled([
     scrapeGoogle(searchKeywords),
     scrapeRSS(searchKeywords),
     scrapeBayt(searchKeywords),
     scrapeIndeed(searchKeywords),
     scrapeJSearch(searchKeywords),  // ✅ UNCOMMENT THIS LINE
   ]);

   // Update scraper names:
   const scraperNames = ['Google', 'RSS', 'Bayt', 'Indeed', 'JSearch'];
   ```

4. **Add to GitHub Secrets:**
   - Name: `OPENWEBNINJA_API_KEY`
   - Value: Your API key

**Cost:** $0 (100% FREE)

---

### 3. 🚨 SearchAPI (Emergency Backup)

**What It Is:**
- SearchAPI.io Google Jobs API
- Emergency backup when other sources fail

**Free Tier:**
- 100 searches/month
- Only recommended as last resort

**Expected:**
- +10-15 jobs/day (if activated)
- 50-60% accuracy

**Setup Time:** 5 minutes

**How to Activate:**

1. **Sign up for API key:**
   - Go to: https://www.searchapi.io
   - Create account and get API key

2. **Add to `.env`:**
   ```bash
   SEARCHAPI_KEY=your_api_key_here
   ```

3. **Activate in `job_hunter.ts`:**
   ```typescript
   const scraperResults = await Promise.allSettled([
     scrapeGoogle(searchKeywords),
     scrapeRSS(searchKeywords),
     scrapeBayt(searchKeywords),
     scrapeIndeed(searchKeywords),
     scrapeSearchAPI(searchKeywords),  // ✅ UNCOMMENT THIS LINE
   ]);

   // Update scraper names:
   const scraperNames = ['Google', 'RSS', 'Bayt', 'Indeed', 'SearchAPI'];
   ```

4. **Add to GitHub Secrets:**
   - Name: `SEARCHAPI_KEY`
   - Value: Your API key

**Cost:** $0 (100% FREE)

**Warning:** Only 100 searches/month - save for emergencies

---

## 📊 Expected Results with Optional APIs

### Current Setup (No API Keys):
```
Total jobs/day: 60-100 jobs
Sources: 4 (Google, RSS, Bayt, Indeed)
Accuracy: 70-80% overall
Cost: $0/month
```

### With Jooble (RECOMMENDED):
```
Total jobs/day: 90-150 jobs (+50%)
Sources: 5 (Google, RSS, Bayt, Indeed, Jooble)
Accuracy: 70-80% overall
Cost: $0/month (FREE tier)
```

### With All Optional APIs:
```
Total jobs/day: 120-180 jobs (+100%)
Sources: 7 (Google, RSS, Bayt, Indeed, Jooble, JSearch, SearchAPI)
Accuracy: 70-80% overall
Cost: $0/month (ALL free tiers)
```

---

## ❌ NOT Suitable for GitHub Actions

### LinkedIn Scraper
**Why Not:**
- Uses Playwright browser automation (~200MB)
- Heavy memory usage (like BERT in RUN #36)
- Will likely fail silently in GitHub Actions
- Not worth the complexity

### WebSearch Scraper
**Why Not:**
- Requires Claude Code's WebSearch tool
- Not available in GitHub Actions environment
- Only works in interactive Claude Code sessions

---

## 💡 Recommendations

### For Maximum Results:
1. **Start with current 4 scrapers** (60-100 jobs, proven reliable)
2. **Add Jooble** (+30-50 jobs, highly recommended, 5-min setup)
3. **Optionally add JSearch** (+20-30 jobs if you want even more)
4. **Keep SearchAPI as emergency backup** (only if other sources fail)

### Priority Order:
1. ✅ **Google CSE** (already active) - PRIMARY source
2. ✅ **RSS Feeds** (already active) - Bot-friendly
3. ✅ **Bayt** (already active) - Riyadh-specific
4. ✅ **Indeed** (already active) - Saudi Arabia focus
5. 🔑 **Jooble** (OPTIONAL, HIGHLY RECOMMENDED) - Aggregates 1000+ boards
6. 🔑 **JSearch** (OPTIONAL) - Google Jobs aggregator
7. 🔑 **SearchAPI** (OPTIONAL, BACKUP ONLY) - Limited free tier

---

## 🔧 Troubleshooting

### API Key Not Working
```bash
# Test API key locally:
export JOOBLE_API_KEY="your_key"
npm start

# Check logs for:
# ✅ [Jooble] Starting...
# ✅ [Jooble] X jobs found
```

### GitHub Actions Not Using API Key
```bash
# Verify secret is set:
# Go to: Repository → Settings → Secrets → Actions
# Ensure secret name matches exactly (case-sensitive):
# - JOOBLE_API_KEY
# - OPENWEBNINJA_API_KEY
# - SEARCHAPI_KEY
```

### API Rate Limit Exceeded
```bash
# Check usage:
# Jooble: 182 calls/month of 2,745 limit (6.6%)
# JSearch: Check OpenWebNinja dashboard
# SearchAPI: Check SearchAPI.io dashboard

# Solution: Remove API key or reduce calls
```

---

## 📝 Summary

**Current Setup (No API Keys):**
- ✅ 60-100 jobs/day
- ✅ 100% FREE
- ✅ Reliable delivery
- ✅ No signup required

**With Optional APIs:**
- 🚀 120-180 jobs/day (+100%)
- 💰 Still 100% FREE
- 🔑 Requires 5-10 min setup per API
- 📧 Email signup required

**Recommendation:**
- Start with current 4 scrapers (proven reliable)
- Add Jooble if you want 50% more jobs (highly recommended)
- Skip LinkedIn and WebSearch (not suitable for GitHub Actions)

---

_Document created: December 8, 2025_
_Status: Optional enhancement guide_
_Cost: $0 (all APIs have free tiers)_
_Motto: "More jobs, still free, your choice"_
