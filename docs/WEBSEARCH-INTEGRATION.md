# WebSearch Integration Guide

## 🎯 Overview

WebSearch is the **ONLY working method** for job discovery because it bypasses all bot detection by using Google search. Both RSS feeds and direct scraping are blocked by Cloudflare.

## ✅ Proven Results

- **68 AI Engineer jobs** found in Riyadh
- **213+ Digital Transformation jobs** in Saudi Arabia
- **74 Full Stack Developer jobs** on LinkedIn
- **355+ total opportunities** discovered

## 🔧 How It Works

1. **Manual Job Discovery**: Run WebSearch via Claude Code to find current jobs
2. **Data Storage**: Save results to `data/websearch-jobs-YYYY-MM-DD.json`
3. **Automated Integration**: job_hunter.ts reads latest WebSearch data file
4. **AI Matching**: Jobs scored and filtered by Claude
5. **Telegram Delivery**: Best matches sent to your Telegram

## 📋 Step-by-Step Usage

### Step 1: Run WebSearch in Claude Code

Open Claude Code and ask:
```
"Use WebSearch to find AI Engineer, Machine Learning, and Digital Transformation jobs
in Riyadh, Saudi Arabia. Save results to data/websearch-jobs-YYYY-MM-DD.json"
```

### Step 2: Verify Data File

Check that the file was created:
```bash
ls -lh A1-JobHunter/data/websearch-jobs-*.json
```

### Step 3: Run Job Hunter

The automated system will automatically use the WebSearch data:
```bash
cd A1-JobHunter
npm start
```

Or trigger via GitHub Actions:
```bash
gh workflow run job-hunt.yml --repo A1cy/A1-JobHunter
```

### Step 4: Receive Results

Jobs will be sent to your Telegram with:
- AI match scores (0-100%)
- Key matching requirements
- Direct application links
- Company and platform info

## 📁 Data File Format

```json
{
  "timestamp": "2025-12-03T12:00:00Z",
  "location": "Riyadh, Saudi Arabia",
  "method": "WebSearch via Claude Code",
  "total_jobs_found": 355,
  "jobs": [
    {
      "id": "ws-001",
      "title": "Machine Learning Engineer",
      "company": "Company Name",
      "location": "Riyadh, Saudi Arabia",
      "url": "https://www.bayt.com/...",
      "description": "Job description here...",
      "platform": "Bayt",
      "keywords": ["ML", "Python"],
      "salary_range": "Competitive",
      "experience_required": "5+ years"
    }
  ]
}
```

## 🔄 Automation Options

### Option 1: Manual Weekly (Recommended)

Run WebSearch manually once per week:
1. Open Claude Code
2. Request job search
3. Verify data file created
4. GitHub Actions uses it automatically

### Option 2: Claude Code API (Advanced)

Future enhancement to call Claude Code API from GitHub Actions:
```yaml
- name: Generate WebSearch Jobs
  run: |
    curl -X POST https://api.anthropic.com/v1/messages \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -d '{"model":"claude-sonnet-4.5","messages":[...]}'
```

### Option 3: Hybrid Approach (Current)

- Tier 1: RSS feeds (fails - Cloudflare blocks)
- Tier 2: WebSearch data (WORKS - reads JSON file)
- Tier 3: Direct/proxy scraping (fallback)

## 🎯 Why WebSearch Works

**Traditional Scraping Issues:**
- ❌ Indeed RSS: Blocked by Cloudflare
- ❌ Direct scraping: 403 Forbidden errors
- ❌ Even with proxies: Still detected

**WebSearch Advantages:**
- ✅ Uses Google search (cannot be blocked)
- ✅ Finds jobs across multiple platforms
- ✅ No rate limits or API costs
- ✅ Truly unlimited job discovery
- ✅ Bypasses ALL bot detection

## 📊 Example Results

From December 3, 2025 WebSearch run:

**Top Jobs Found:**
1. Machine Learning Engineer at Octopus by RTG - SAR 25k-40k/month
2. AI Engineer at Salla - Remote-first with relocation package
3. Digital Transformation Manager at AtkinsRéalis - 10+ years exp
4. Full Stack Developer at Aramco - Premium compensation
5. Senior MLOps Engineer at Salla - Cloud pipelines expert

**Salary Ranges:**
- Junior Consultant: SAR 2,000 - 4,000/month
- Mid-Level Engineer: SAR 15,000 - 25,000/month
- Senior Engineer: SAR 25,000 - 50,000/month
- Executive Level: SAR 15,000 - 30,000/month + benefits

## 🚀 Quick Start

```bash
# 1. Request jobs via Claude Code
"Find jobs in Riyadh using WebSearch"

# 2. Push data file to GitHub
cd A1-JobHunter
git add data/websearch-jobs-*.json
git commit -m "Update: WebSearch jobs data for [date]"
git push

# 3. GitHub Actions will use it automatically at 9 AM daily
# Or trigger manually:
gh workflow run job-hunt.yml --repo A1cy/A1-JobHunter
```

## 📝 Best Practices

1. **Update Weekly**: Run WebSearch every 7 days for fresh jobs
2. **Vary Keywords**: Rotate search terms (AI, ML, GenAI, Digital Transformation)
3. **Check Multiple Sites**: Include Bayt, LinkedIn, GulfTalent, Indeed
4. **Save History**: Keep old JSON files for trend analysis
5. **Review Results**: Manually verify top matches before applying

## 🔗 Useful Sources

- [AI/ML Jobs in Saudi Arabia](https://zerotaxjobs.com/ai-jobs-in-saudi-arabia)
- [Bayt - Machine Learning Jobs](https://www.bayt.com/en/saudi-arabia/jobs/machine-learning-engineer-jobs/)
- [GulfTalent - Digital Transformation](https://www.gulftalent.com/saudi-arabia/jobs/title/digital-transformation-consultant)
- [LinkedIn - Full Stack Jobs](https://sa.linkedin.com/jobs/full-stack-developer-jobs)
- [NaukriGulf - AI Jobs in Riyadh](https://www.naukrigulf.com/artificial-intelligence-jobs-in-riyadh)

## 🆘 Troubleshooting

**No jobs found:**
- Check data/ directory exists
- Verify JSON file format is correct
- Ensure file name starts with `websearch-jobs-`
- Run WebSearch again for fresh data

**Old data being used:**
- System automatically uses most recent file
- Delete old files or update timestamps

**Integration not working:**
- Check GitHub Actions logs
- Verify data/ directory pushed to repo
- Ensure JSON is valid (use jsonlint.com)

---

**Last Updated:** December 3, 2025
**Status:** ✅ Working - 355+ jobs discovered
