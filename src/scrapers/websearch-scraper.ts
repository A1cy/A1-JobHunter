import { Job, logger, generateJobId, sanitizeText } from '../utils.js';

/**
 * WebSearch Job Scraper - Unlimited Tier 2 method
 *
 * Uses Google search via Claude Code's WebSearch tool to find job listings.
 * This provides truly unlimited job discovery with no API rate limits.
 *
 * Note: This scraper builds search queries. The actual WebSearch execution
 * happens in job_hunter.ts using Claude Code's native WebSearch tool.
 */
export class WebSearchJobScraper {
  /**
   * Build site-specific search queries for Google
   *
   * Creates queries that target specific job sites plus general searches.
   *
   * @param keywords - Array of job keywords (e.g., ["AI Engineer", "ML Engineer"])
   * @param location - Location (e.g., "Riyadh")
   * @returns Array of Google search query strings
   */
  buildSearchQueries(keywords: string[], location: string): string[] {
    const queries: string[] = [];

    for (const keyword of keywords) {
      // Site-specific searches for better results
      queries.push(`"${keyword}" jobs ${location} site:sa.indeed.com`);
      queries.push(`"${keyword}" jobs ${location} site:bayt.com`);
      queries.push(`"${keyword}" jobs ${location} site:tanqeeb.com`);

      // General search as fallback
      queries.push(`"${keyword}" jobs ${location} Saudi Arabia 2025`);
    }

    logger.info(`📝 Generated ${queries.length} WebSearch queries for ${keywords.length} keywords`);
    return queries;
  }

  /**
   * Parse WebSearch results to extract job listings
   *
   * This method processes the text results from Google search to identify
   * and extract job postings with their URLs, titles, and companies.
   *
   * @param searchResults - Raw text results from WebSearch tool
   * @param keyword - The keyword that was searched
   * @param location - The location that was searched
   * @returns Array of Job objects extracted from search results
   */
  parseSearchResults(searchResults: string, keyword: string, location: string): Job[] {
    const jobs: Job[] = [];

    try {
      // Split results by common separators
      const lines = searchResults.split('\n');

      let currentJob: Partial<Job> | null = null;

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) {
          if (currentJob && currentJob.title && currentJob.url) {
            // Save completed job
            jobs.push({
              id: generateJobId(),
              title: sanitizeText(currentJob.title),
              company: sanitizeText(currentJob.company || 'Unknown'),
              location: location,
              url: currentJob.url,
              description: sanitizeText(currentJob.description || '').substring(0, 500),
              platform: currentJob.platform || 'websearch',
              postedDate: undefined // Not typically available from search results
            });
          }
          currentJob = null;
          continue;
        }

        // Detect job URLs (from job sites)
        if (
          trimmed.includes('indeed.com/') ||
          trimmed.includes('bayt.com/') ||
          trimmed.includes('tanqeeb.com/') ||
          trimmed.includes('linkedin.com/jobs/')
        ) {
          if (currentJob) {
            currentJob.url = this.extractUrl(trimmed);

            // Determine platform from URL
            if (trimmed.includes('indeed.com')) currentJob.platform = 'Indeed Saudi';
            else if (trimmed.includes('bayt.com')) currentJob.platform = 'Bayt';
            else if (trimmed.includes('tanqeeb.com')) currentJob.platform = 'Tanqeeb';
            else if (trimmed.includes('linkedin.com')) currentJob.platform = 'LinkedIn Jobs';
          }
        }

        // Detect job titles (lines with job-related keywords)
        if (this.looksLikeJobTitle(trimmed, keyword)) {
          // Start new job
          if (currentJob && currentJob.title && currentJob.url) {
            jobs.push({
              id: generateJobId(),
              title: sanitizeText(currentJob.title),
              company: sanitizeText(currentJob.company || 'Unknown'),
              location: location,
              url: currentJob.url,
              description: sanitizeText(currentJob.description || '').substring(0, 500),
              platform: currentJob.platform || 'websearch',
              postedDate: undefined
            });
          }

          currentJob = {
            title: trimmed,
            location: location
          };
        }

        // Detect company names (often appear after job titles)
        if (currentJob && !currentJob.company && this.looksLikeCompanyName(trimmed)) {
          currentJob.company = trimmed;
        }

        // Collect description fragments
        if (currentJob && !this.looksLikeJobTitle(trimmed, keyword) && !this.looksLikeCompanyName(trimmed)) {
          currentJob.description = (currentJob.description || '') + ' ' + trimmed;
        }
      }

      // Save last job if exists
      if (currentJob && currentJob.title && currentJob.url) {
        jobs.push({
          id: generateJobId(),
          title: sanitizeText(currentJob.title),
          company: sanitizeText(currentJob.company || 'Unknown'),
          location: location,
          url: currentJob.url,
          description: sanitizeText(currentJob.description || '').substring(0, 500),
          platform: currentJob.platform || 'websearch',
          postedDate: undefined
        });
      }

      logger.info(`✅ Parsed ${jobs.length} jobs from WebSearch results for "${keyword}"`);
    } catch (error) {
      logger.error(`❌ Error parsing WebSearch results:`, error);
    }

    return jobs;
  }

  /**
   * Extract URL from a line of text
   */
  private extractUrl(text: string): string {
    // Look for URLs in the text
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : '';
  }

  /**
   * Check if text looks like a job title
   */
  private looksLikeJobTitle(text: string, keyword: string): boolean {
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    // Must contain the keyword or common job terms
    const hasKeyword = lowerText.includes(lowerKeyword);
    const hasJobTerms =
      lowerText.includes('engineer') ||
      lowerText.includes('developer') ||
      lowerText.includes('manager') ||
      lowerText.includes('specialist') ||
      lowerText.includes('consultant') ||
      lowerText.includes('architect') ||
      lowerText.includes('analyst');

    // Should be reasonable length for a title (not too short, not too long)
    const reasonableLength = text.length > 10 && text.length < 150;

    return (hasKeyword || hasJobTerms) && reasonableLength;
  }

  /**
   * Check if text looks like a company name
   */
  private looksLikeCompanyName(text: string): boolean {
    // Company names are typically short and capitalized
    const words = text.split(/\s+/);
    const shortEnough = words.length <= 5;
    const hasCapitals = /[A-Z]/.test(text);

    // Exclude common phrases that aren't companies
    const excludeTerms = ['apply', 'job', 'description', 'requirements', 'qualification'];
    const notExcluded = !excludeTerms.some(term => text.toLowerCase().includes(term));

    return shortEnough && hasCapitals && notExcluded;
  }

  /**
   * Deduplicate jobs by URL
   *
   * @param jobs - Array of jobs to deduplicate
   * @returns Deduplicated array
   */
  deduplicateByUrl(jobs: Job[]): Job[] {
    const seen = new Set<string>();
    const unique: Job[] = [];

    for (const job of jobs) {
      if (!seen.has(job.url)) {
        seen.add(job.url);
        unique.push(job);
      }
    }

    logger.info(`🔍 Deduplicated: ${jobs.length} → ${unique.length} unique jobs`);
    return unique;
  }

  /**
   * Build comprehensive search strategy
   *
   * Returns an object with queries organized by priority
   *
   * @param keywords - Array of job keywords
   * @param location - Location
   * @returns Organized search queries by priority
   */
  buildSearchStrategy(keywords: string[], location: string): {
    high: string[];
    medium: string[];
    low: string[];
  } {
    return {
      high: keywords.map(k => `"${k}" jobs ${location} site:sa.indeed.com`),
      medium: keywords.map(k => `"${k}" jobs ${location} site:bayt.com`),
      low: keywords.map(k => `"${k}" jobs ${location} Saudi Arabia`)
    };
  }
}
