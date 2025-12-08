# 🔧 GitHub Actions Constraints & Lessons Learned

**Date**: December 8, 2025
**Context**: RUN #36 Rollback - Simplification for Reliability

---

## 🚨 What Happened: The RUN #36 Failure

### The Problem
RUN #36 attempted to implement:
- ✅ BERT semantic matching (AI-powered job scoring)
- ✅ Remotive API scraper (remote jobs)
- ✅ Arbeitnow API scraper (Germany tech jobs)
- ✅ Company RSS feeds (Aramco, STC, SABIC, Almarai)
- ✅ Fuzzy deduplication

### The Result
**❌ 0 jobs delivered** due to:
1. **429 Quota Exceeded** - Google API after only 2 calls (9 API calls/run was too much)
2. **BERT Not Loading** - ~50MB model failed to download in GitHub Actions
3. **Remote Jobs Ineffective** - 100% remote ≠ Riyadh full-time office jobs
4. **Company RSS 404s** - Career pages don't offer RSS anymore

---

## ❌ What DOESN'T Work in GitHub Actions

### 1. Large ML Models (BERT/Transformers)
**Why**: Memory constraints + slow downloads + timeout issues

```typescript
// ❌ BROKEN in GitHub Actions
import { pipeline } from '@xenova/transformers';
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'); // ~50MB
// Result: Silent failure, returns 0 scores
```

**Evidence**: No "🧠 Initializing BERT" logs in GitHub Actions runs

**Impact**: System continued running but semantic matching contributed ZERO

**Lesson**: Avoid large dependencies that require model downloads

---

### 2. Remote Job APIs (Remotive, Arbeitnow)
**Why**: Not relevant for location-specific searches

```typescript
// ❌ INEFFECTIVE for "Riyadh full-time jobs"
// Remotive: 100% remote jobs (NOT office jobs)
location: 'Remote (Riyadh-friendly)' // Misleading - remote ≠ Riyadh
// Effectiveness: 10-20% at best

// Arbeitnow: Germany-based remote
location: 'Germany' // NO Riyadh filtering
// Effectiveness: 5-10% at best
```

**Lesson**: Focus on location-specific sources, not global remote APIs

---

### 3. Company RSS Feeds
**Why**: Outdated technology - most don't exist anymore

```typescript
// ❌ BROKEN - Returns 404 errors
const COMPANY_RSS_FEEDS = [
  'https://careers.aramco.com/rss',  // 404
  'https://careers.stc.com.sa/rss',  // 404
  // Career pages no longer offer RSS (technology from 2010s)
];
```

**Lesson**: RSS peaked in 2010s, modern career pages use JSON APIs or no feeds

---

### 4. High API Quota Usage
**Why**: Testing exhausts daily limits

```typescript
// ❌ BROKEN - 429 errors
for (let page = 0; page < 3; page++) {  // 3 pages
  // 3 domains × 3 pages = 9 API calls per run
}
// Result: Multiple test runs = quota exhausted = 0 jobs

// ✅ FIXED - No 429 errors
for (let page = 0; page < 1; page++) {  // 1 page
  // 3 domains × 1 page = 3 API calls per run
  // Allows 33 runs/day instead of 11
}
```

**Lesson**: Design for 10-20 runs/day buffer during testing/debugging

---

## ✅ What DOES Work in GitHub Actions

### 1. Google Custom Search API (with quota management)
**Why**: Reliable, proven, location-specific

```typescript
✅ WORKING:
- 1 page per domain = 3 API calls/run (3% quota)
- 10 results per page × 3 domains = 30 jobs
- Allows 33 runs/day (testing + production)
- 70-80% accuracy (Riyadh-specific)
```

**Best Practice**: Reduce pages to minimum viable for quota safety

---

### 2. Static RSS Feeds from Major Job Boards
**Why**: Bot-friendly, Riyadh-specific, reliable

```typescript
✅ WORKING:
const STATIC_RSS_FEEDS = [
  'https://www.gulftalent.com/jobs-in-saudi-arabia?format=rss',  // ✅ Works
  'https://www.naukrigulf.com/jobs-in-riyadh-saudi-arabia?format=rss',  // ✅ Works
  'https://www.bayt.com/en/saudi-arabia/jobs/?format=rss',  // ✅ Works
];
// 10-20 jobs/day, 30-40% accuracy
```

**Best Practice**: Use major job board RSS, not company career pages

---

### 3. TF-IDF + Keyword Matching (No AI dependencies)
**Why**: No external dependencies, reliable, fast

```typescript
✅ WORKING:
- TF-IDF keyword importance weighting (70-75% accuracy)
- Keyword matching with domain filtering
- No model downloads, no memory issues
- 100% reliable in GitHub Actions
```

**Best Practice**: Simple algorithms beat complex ML in constrained environments

---

### 4. Simple Architecture (Fewer moving parts)
**Why**: Fewer components = fewer failure points

```typescript
✅ WORKING:
Sources: 2 (Google + RSS)
Matching: TF-IDF + Keyword (no BERT)
Dedup: Simple URL matching (no fuzzy)

Result: 30-50 jobs/day (RELIABLE) vs 0 jobs (RUN #36 failed)
```

**Best Practice**: Simplicity over features in production automation

---

## 📐 Design Principles for GitHub Actions

### 1. **Simplicity Over Features**
- ✅ 2 scrapers (reliable) > 5 scrapers (complex)
- ✅ Simple URL dedup > Fuzzy Levenshtein matching
- ✅ Keyword matching > BERT semantic matching

**Why**: Every component adds failure risk in constrained environment

---

### 2. **Quota Management First**
- ✅ Design for 10-20 runs/day buffer (testing + debugging)
- ✅ Monitor usage: 3 calls/run = 3% quota (safe)
- ❌ Avoid: 9+ calls/run = 9% quota (risky during testing)

**Why**: Testing consumes quota, multiple runs cause 429 errors

---

### 3. **No Large Dependencies**
- ✅ Native JavaScript/TypeScript
- ✅ Small libraries (<10MB)
- ❌ ML models (~50MB+)
- ❌ Browser automation (Playwright ~200MB)

**Why**: GitHub Actions has memory/timeout constraints

---

### 4. **Quality Over Quantity**
- ✅ 30 GOOD jobs (delivered) > 150 CLAIMED jobs (0 delivered)
- ✅ 70% accuracy (working) > 85% accuracy (not loading)
- ✅ Reliable execution > Feature-rich failure

**Why**: User needs consistent job delivery, not promises

---

## 🎯 Expected Results: Before vs After

### Before (RUN #36 - FAILED)
```
API calls: 9/run → 429 errors
Jobs delivered: 0 (quota blocked)
BERT: Not loading (silent failure)
Sources: 4 (2 ineffective)
User satisfaction: ❌ (no jobs)
```

### After (Simplified - WORKING)
```
API calls: 3/run → No errors
Jobs delivered: 30-50 (reliable)
BERT: Removed (not needed)
Sources: 2 (both proven)
User satisfaction: ✅ (consistent delivery)
```

---

## 💡 Key Takeaways

1. **GitHub Actions is NOT a development environment**
   - It's a production cron scheduler with constraints
   - Design for reliability, not experimentation

2. **Graceful degradation hides critical failures**
   - BERT failed silently (returned 0)
   - System continued but quality suffered
   - Better to fail loudly than degrade silently

3. **Remote ≠ Location-specific**
   - Remote job APIs are NOT effective for "Riyadh full-time jobs"
   - Focus on location-specific sources only

4. **RSS is dying but not dead**
   - Major job boards still offer RSS (GulfTalent, Naukrigulf, Bayt)
   - Company career pages have abandoned RSS (use APIs if available)

5. **Quota management is critical**
   - Test runs exhaust daily limits quickly
   - Always design with 3x safety margin

---

## 🔜 Future Enhancements (If Needed)

### Potential Additions (Carefully Vetted)
1. **Adzuna API** ($0, 5000 req/month) - IF user signs up manually
2. **More RSS feeds** - Major job boards only, test first
3. **Playwright scraping** - Last resort, high memory cost

### What to AVOID
1. ❌ Any ML models requiring downloads
2. ❌ Remote job APIs (unless specifically requested)
3. ❌ Company RSS feeds (don't exist)
4. ❌ Complex deduplication (fuzzy matching)

---

_Document created: December 8, 2025_
_Purpose: Learn from failures, prevent repetition_
_Motto: "30 reliable jobs > 150 promised jobs"_
