# 🎯 A1 Job Hunter

**100% FREE Automated Job Hunting System**

Find tech jobs in Riyadh, Saudi Arabia automatically every day at 9:00 AM with smart keyword matching and Telegram delivery.

[![GitHub Actions](https://github.com/A1cy/A1-JobHunter/workflows/A1%20Job%20Hunter/badge.svg)](https://github.com/A1cy/A1-JobHunter/actions)
[![100% FREE](https://img.shields.io/badge/Cost-$0%2Fmonth-brightgreen)](https://github.com/A1cy/A1-JobHunter)
[![No API Keys](https://img.shields.io/badge/API%20Keys-None%20Required-blue)](https://github.com/A1cy/A1-JobHunter)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 💯 **100% FREE Forever**: No API costs, no credit cards, no limits!
- 🎯 **Smart Keyword Matching**: Rule-based scoring (0-100%) matching your skills and roles
- 🤖 **Fully Automated**: Runs daily at 9:00 AM Riyadh time on GitHub Actions
- 🚀 **WebSearch Integration**: Google-powered job discovery bypassing all bot detection
- 📱 **Telegram Delivery**: Beautiful formatted messages sent directly to your phone
- ⚡ **3-Tier Hybrid System**: RSS feeds → WebSearch → Direct scraping with intelligent failover
- 🛡️ **Anti-Detection**: Stealth mode, user agent rotation, rate limiting
- 🔄 **Smart Deduplication**: Removes duplicate job postings across platforms
- 📊 **Detailed Matching**: Shows why each job matches your profile with match reasons
- 🌐 **100% Cloud-Based**: No local PC required, runs forever on GitHub Actions
- 🔒 **Privacy-First**: All matching done locally, no data sent to external APIs

## 🎯 Target Roles

- Digital Transformation Specialist/Manager/Officer/Consultant
- AI Engineer, ML Engineer, GenAI Developer, MLOps Engineer
- Full Stack Developer, Software Engineer (Web)

## 📋 Prerequisites

- GitHub account
- Telegram account
- Anthropic API key (Claude)

## 🚀 Quick Setup (5 minutes)

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow prompts
3. Save the bot token (looks like: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
4. Message [@userinfobot](https://t.me/userinfobot) to get your chat ID

### 2. Get Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create new API key
3. Save the key (starts with `sk-ant-`)

### 3. Configure GitHub Secrets

1. Go to your repository: `https://github.com/A1cy/A1-JobHunter`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add these secrets:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
   - `TELEGRAM_CHAT_ID`: Your Telegram chat ID
   - `ANTHROPIC_API_KEY`: Your Claude API key

### 4. Customize Your Profile

Edit `config/a1_profile.json` with your skills and preferences:

```json
{
  "name": "Your Name",
  "location": "Riyadh, Saudi Arabia",
  "skills": {
    "primary": ["Your", "Primary", "Skills"],
    "technologies": ["Python", "JavaScript", "etc"]
  },
  "target_roles": ["Role 1", "Role 2"],
  "min_experience_match": 0.6
}
```

### 5. Push to GitHub

```bash
git add .
git commit -m "Initial setup: A1 Job Hunter configured"
git push origin main
```

**That's it!** 🎉 The system will now run automatically at 9:00 AM daily.

## 📱 Sample Output

Every morning you'll receive a Telegram message like this:

```
🎯 A1 Job Hunter - December 3, 2025
Found 12 jobs matching your profile

📊 Summary:
• Total Jobs: 12
• Avg Match: 82%
• High Match (≥85%): 5 jobs

━━━━━━━━━━━━━━━━━━━━

🌟 Senior AI Engineer - Digital Transformation
🏢 Aramco Digital
📍 Riyadh, Saudi Arabia
📊 Match: 94%

Why it matches:
• Requires AI/ML expertise with GenAI focus
• Digital transformation initiative leadership
• Full-stack development for AI platforms
• 5+ years experience matches your profile

🔗 Apply Now

━━━━━━━━━━━━━━━━━━━━

... (more jobs)
```

## 🏗️ Architecture

```
A1-JobHunter/
├── .github/workflows/
│   └── job-hunt.yml          # GitHub Actions workflow (runs daily)
├── config/
│   ├── a1_profile.json       # Your skills and preferences
│   └── platforms.json        # Platform configurations
├── src/
│   ├── job_hunter.ts         # Main orchestrator
│   ├── scrapers/
│   │   ├── base.ts           # Abstract scraper class
│   │   ├── linkedin.ts       # LinkedIn scraper (Playwright)
│   │   ├── indeed.ts         # Indeed scraper (Cheerio)
│   │   ├── bayt.ts           # Bayt scraper (Cheerio)
│   │   └── index.ts          # Scraper coordinator
│   ├── ai-matcher.ts         # Claude AI matching
│   ├── telegram.ts           # Telegram bot integration
│   └── utils.ts              # Helper functions
└── package.json              # Dependencies
```

## 🛠️ Technology Stack

### Core
- **TypeScript** - Type-safe implementation
- **Node.js 20** - Runtime environment

### Web Scraping
- **Playwright** - Browser automation for JavaScript-heavy sites (LinkedIn)
- **Puppeteer + Stealth** - Anti-bot detection bypass
- **Cheerio** - Fast HTML parsing for static sites (Indeed, Bayt)
- **Got** - Advanced HTTP client with retry logic

### Concurrency & Rate Limiting
- **p-limit** - Control concurrent platform scraping
- **p-retry** - Exponential backoff retry logic
- **Bottleneck** - Advanced rate limiting (respect robots.txt)

### AI & Notifications
- **@anthropic-ai/sdk** - Claude AI for job matching
- **Telegraf** - Telegram bot framework

### Utilities
- **date-fns** - Date formatting
- **nanoid** - Unique ID generation
- **user-agents** - User agent rotation

## 🔧 Manual Trigger

### From GitHub Web UI

1. Go to **Actions** tab
2. Select **A1 Job Hunter** workflow
3. Click **Run workflow**
4. Choose mode (quick/deep/adaptive)

### From Command Line

```bash
# Trigger with GitHub CLI
gh workflow run job-hunt.yml --repo A1cy/A1-JobHunter

# Trigger with specific mode
gh workflow run job-hunt.yml --repo A1cy/A1-JobHunter --field mode=deep
```

### From Claude Code (Optional)

Create `/home/a1xai/.claude/commands/job-hunt.md`:

```bash
gh workflow run job-hunt.yml --repo A1cy/A1-JobHunter
```

## 🧪 Local Testing

```bash
# Install dependencies
npm install

# Set environment variables
export TELEGRAM_BOT_TOKEN="your_token"
export TELEGRAM_CHAT_ID="your_chat_id"
export ANTHROPIC_API_KEY="your_api_key"
export MODE="quick"

# Run locally
npm start
```

## 📊 Scan Modes

### Quick Scan (Default)
- Scrapes first 20-30 jobs per platform
- Completes in ~5 minutes
- Good for daily checks

### Deep Scan
- Scrapes 100+ jobs per platform
- Takes 15-20 minutes
- Comprehensive coverage

### Adaptive Scan (Recommended)
- Starts with quick scan
- Automatically triggers deep scan if <10 jobs found
- Best balance of speed and coverage

Set mode in GitHub Actions workflow or environment:
```yaml
env:
  MODE: adaptive  # quick, deep, or adaptive
```

## 🎛️ Configuration

### Add New Platform

1. Edit `config/platforms.json`:

```json
{
  "id": "platform-id",
  "name": "Platform Name",
  "url": "https://example.com",
  "requiresJS": false,
  "priority": 4,
  "enabled": true,
  "search_params": {
    "location": "Riyadh",
    "keywords": ["AI", "ML", "Full Stack"]
  }
}
```

2. Create scraper in `src/scrapers/platform-id.ts`

3. Register in `src/scrapers/index.ts`

### Adjust Matching Threshold

Edit `config/a1_profile.json`:

```json
{
  "min_experience_match": 0.6  // 0.0-1.0 (60% minimum)
}
```

## 📈 Performance

- **Scraping Speed**: 20-30 jobs in ~5 minutes (quick), 100+ jobs in ~15 minutes (deep)
- **AI Matching**: 5 concurrent Claude API calls, ~2s per job
- **Rate Limiting**: 1 request per 2 seconds per platform
- **Concurrency**: 3 platforms scraped simultaneously
- **Total Time**: 5-20 minutes depending on mode

## 🛡️ Anti-Detection Features

- ✅ User agent rotation (random browser identification)
- ✅ Stealth mode (Puppeteer Extra Stealth Plugin)
- ✅ Rate limiting (respects robots.txt and platform limits)
- ✅ Request delays (2-3 seconds between requests)
- ✅ Headless browser with realistic behavior

## 🐛 Troubleshooting

### No Jobs Found

- Check platform selectors haven't changed
- Verify location matches (Riyadh)
- Try deep scan mode
- Check GitHub Actions logs

### Telegram Not Receiving Messages

- Verify bot token and chat ID
- Test with `/test` command locally
- Check bot is not blocked

### AI Matching Errors

- Verify Anthropic API key is valid
- Check API quota/limits
- Review error logs in GitHub Actions

### GitHub Actions Failing

- Check workflow syntax
- Verify all secrets are set correctly
- Review action logs for specific errors

## 📝 Logs

View logs in GitHub Actions:

1. Go to **Actions** tab
2. Click on latest workflow run
3. View **job-hunt** job logs

Logs include:
- Platform scraping progress
- Jobs found per platform
- AI matching scores
- Telegram delivery status

## 🔒 Security

- ✅ No secrets committed to code
- ✅ All sensitive data in GitHub Secrets
- ✅ Results folder gitignored
- ✅ Secure API communication (HTTPS only)
- ✅ No credentials stored locally

## 📜 License

MIT License - see [LICENSE](LICENSE) file

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 🌟 Roadmap

### Phase 2
- [ ] Additional platforms (Glassdoor, Tanqeeb, Mourjan)
- [ ] X/Twitter hashtag monitoring (#وظائف_الرياض)
- [ ] WhatsApp/Telegram group scraping
- [ ] Smart immediate alerts for 90%+ matched jobs

### Phase 3
- [ ] GitHub Pages dashboard
- [ ] Auto-apply to jobs
- [ ] Resume customization per job
- [ ] Interview prep generation
- [ ] Salary insights

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/A1cy/A1-JobHunter/issues)
- **Documentation**: This README
- **Contact**: Create an issue for questions

---

**Built with ❤️ by A1 | Powered by Claude AI (Anthropic)**

*Never miss a job opportunity again!*
