# 🔑 Adzuna API Setup Guide (RUN #36 - FUTURE ENHANCEMENT)

## Overview

Adzuna is a FREE job search API with generous limits:
- **5,000 requests/month** FREE (no credit card required)
- High-quality job aggregation from 1000+ sources
- Global coverage including Middle East
- Our usage: ~90 requests/month (1.8% of limit)

Expected impact: **+30-50 jobs/day**

## Setup Instructions

### Step 1: Sign Up for Free Account

1. Visit: https://developer.adzuna.com/signup
2. Fill out the registration form:
   - Email address
   - Password
   - Company name (can be "Personal" or "A1xAI")
   - Reason: "Job aggregation for personal use"
3. Verify your email
4. Log in to developer portal

### Step 2: Get API Credentials

1. After logging in, go to: https://developer.adzuna.com/account
2. You'll see your credentials:
   - **App ID**: e.g., `12345678`
   - **API Key**: e.g., `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
3. Copy both values

### Step 3: Add to Environment Variables

Add these lines to your `.env` file:

```bash
# Adzuna API (FREE - 5,000 req/month)
ADZUNA_APP_ID=your_app_id_here
ADZUNA_APP_KEY=your_api_key_here
```

### Step 4: Verify Setup

Run the test script to verify it works:

```bash
# Test Adzuna scraper
npx tsx scripts/test-adzuna-scraper.ts
```

Expected output:
```
✅ Adzuna API: "software engineer" → 30-50 jobs
✅ Adzuna API test PASSED
```

### Step 5: Activate in job_hunter.ts

Once verified, uncomment the Adzuna scraper in `src/job_hunter.ts`:

```typescript
// Find this section (around line 635):
const scraperResults = await Promise.allSettled([
  scrapeGoogle(searchKeywords),
  scrapeRSS(searchKeywords),
  scrapeRemotive(searchKeywords),
  scrapeArbeitnow(searchKeywords),
  scrapeAdzuna(searchKeywords),  // ← Uncomment this line
]);
```

## API Limits and Usage

| Metric | Free Tier | Our Usage | % Used |
|--------|-----------|-----------|--------|
| Requests/month | 5,000 | ~90 | 1.8% |
| Requests/day | ~166 | ~3 | 1.8% |
| Cost | $0 | $0 | FREE ✅ |

**Safety margin**: 98.2% of quota remains unused

## Expected Results

### Before Adzuna:
- Total jobs/day: 150-200
- Sources: 4 (Google, RSS, Remotive, Arbeitnow)

### After Adzuna:
- Total jobs/day: 180-250 ✅
- Sources: 5 (+ Adzuna)
- Improvement: +30-50 jobs/day (+20%)

## Troubleshooting

### Error: "Invalid App ID or API Key"
- **Cause**: Credentials not configured or incorrect
- **Solution**: Double-check `.env` file, restart application

### Error: "Quota exceeded"
- **Cause**: Exceeded 5,000 requests/month
- **Solution**: Wait until next month (unlikely with our usage rate)

### No jobs returned
- **Cause**: API may be down or query returned no results
- **Solution**: Try different keywords, check Adzuna status page

## API Documentation

Official docs: https://developer.adzuna.com/docs/search

### Example API Call:
```bash
curl "https://api.adzuna.com/v1/api/jobs/sa/search/1?app_id=YOUR_APP_ID&app_key=YOUR_APP_KEY&what=software+engineer&where=Riyadh"
```

### Response Format:
```json
{
  "results": [
    {
      "title": "Senior Software Engineer",
      "company": {
        "display_name": "Saudi Aramco"
      },
      "location": {
        "display_name": "Riyadh, Saudi Arabia"
      },
      "redirect_url": "https://...",
      "description": "...",
      "salary_min": 15000,
      "salary_max": 25000,
      "created": "2025-12-08T10:00:00Z"
    }
  ]
}
```

## Rate Limiting

Adzuna enforces:
- **1 request/second** (built into our scraper)
- **5,000 requests/month**

Our implementation:
```typescript
// Rate limit: 1 req/second
await new Promise(r => setTimeout(r, 1000));
```

## Advantages Over Other APIs

| Feature | Adzuna | Remotive | Arbeitnow |
|---------|--------|----------|-----------|
| **Coverage** | Global (1000+ boards) | Remote only | Remote tech only |
| **Quality** | High (aggregated) | High (curated) | High (curated) |
| **Limit** | 5,000/month | Unlimited | Unlimited |
| **Salary data** | ✅ Yes | ⚠️  Sometimes | ❌ No |
| **Location filter** | ✅ Yes | ⚠️  Limited | ❌ No |
| **Company verified** | ✅ Yes | ✅ Yes | ✅ Yes |

## Support

- Adzuna Support: developer@adzuna.com
- API Status: https://developer.adzuna.com/status
- Community: https://groups.google.com/forum/#!forum/adzuna-api

---

**Status**: ⏳ PENDING USER SIGNUP
**Priority**: MEDIUM (nice-to-have, not critical)
**Cost**: $0/month (100% FREE)
**Setup time**: 5 minutes
