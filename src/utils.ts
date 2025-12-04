import userAgents from 'user-agents';
import { nanoid } from 'nanoid';
import { formatDistanceToNow } from 'date-fns';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description?: string;
  requirements?: string[];
  postedDate?: Date;
  platform: string;
  score?: number;
  matchReasons?: string[];
  semanticScore?: number;  // Phase 2: BERT-based semantic similarity (0-15 points)
  tfidfScore?: number;      // Phase 2: TF-IDF keyword importance (0-10 points)
  source?: string;          // Job source (API, WebSearch, etc.)
}

/**
 * Generate a random user agent to avoid bot detection
 */
export function getRandomUserAgent(): string {
  return new userAgents().toString();
}

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return nanoid(10);
}

/**
 * Format date relative to now (e.g., "2 days ago")
 */
export function formatRelativeDate(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Sleep for a specified duration (for rate limiting)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitize text by removing extra whitespace and HTML entities
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Check if a job matches the target location
 */
export function matchesLocation(location: string, targetLocation: string = 'Riyadh'): boolean {
  return location.toLowerCase().includes(targetLocation.toLowerCase());
}

/**
 * Extract requirements from job description text
 */
export function extractRequirements(text: string): string[] {
  const requirements: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Look for bullet points or numbered lists
    if (
      trimmed.startsWith('•') ||
      trimmed.startsWith('-') ||
      trimmed.startsWith('*') ||
      /^\d+\./.test(trimmed)
    ) {
      const requirement = trimmed.replace(/^[•\-\*\d\.]\s*/, '').trim();
      if (requirement.length > 10 && requirement.length < 200) {
        requirements.push(requirement);
      }
    }
  }

  return requirements.slice(0, 10); // Limit to 10 requirements
}

/**
 * Deduplicate jobs by URL or title+company combination
 */
export function deduplicateJobs(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  const unique: Job[] = [];

  for (const job of jobs) {
    const key = job.url || `${job.title}|${job.company}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(job);
    }
  }

  return unique;
}

/**
 * Logger utility
 */
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
};
