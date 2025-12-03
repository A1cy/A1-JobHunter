import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import pLimit from 'p-limit';
import { Job, logger } from './utils.js';

export interface UserProfile {
  name: string;
  location: string;
  skills: {
    primary: string[];
    technologies: string[];
  };
  target_roles: string[];
  min_experience_match: number;
  languages: string[];
}

/**
 * Load user profile from config
 */
export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const profilePath = resolve(process.cwd(), 'config/a1_profile.json');
    const profileData = await readFile(profilePath, 'utf-8');
    return JSON.parse(profileData);
  } catch (error) {
    logger.error('Failed to load user profile:', error);
    throw error;
  }
}

/**
 * AI-powered job matcher using Anthropic Claude
 */
export class AIJobMatcher {
  private anthropic: Anthropic;
  private profile: UserProfile;

  constructor(apiKey: string, profile: UserProfile) {
    this.anthropic = new Anthropic({ apiKey });
    this.profile = profile;
  }

  /**
   * Score a single job using Claude AI
   */
  async scoreJob(job: Job): Promise<{ score: number; matchReasons: string[] }> {
    try {
      const prompt = this.buildMatchPrompt(job);

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Parse response
      const content = response.content[0];
      if (content.type === 'text') {
        return this.parseMatchResponse(content.text);
      }

      return { score: 0, matchReasons: [] };
    } catch (error) {
      logger.error(`Error scoring job "${job.title}":`, error);
      return { score: 0, matchReasons: [] };
    }
  }

  /**
   * Build matching prompt for Claude
   */
  private buildMatchPrompt(job: Job): string {
    const profileSummary = `
Name: ${this.profile.name}
Location: ${this.profile.location}
Primary Skills: ${this.profile.skills.primary.join(', ')}
Technologies: ${this.profile.skills.technologies.join(', ')}
Target Roles: ${this.profile.target_roles.join(', ')}
Languages: ${this.profile.languages.join(', ')}
`.trim();

    const jobSummary = `
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description || 'Not available'}
Requirements: ${job.requirements?.join('; ') || 'Not available'}
Platform: ${job.platform}
`.trim();

    return `You are an expert job matching assistant. Analyze how well this job matches the candidate's profile.

CANDIDATE PROFILE:
${profileSummary}

JOB POSTING:
${jobSummary}

Analyze the match and respond in this exact format:
SCORE: [0-100]
REASONS:
- [Key matching requirement 1]
- [Key matching requirement 2]
- [Key matching requirement 3]
- [Key matching requirement 4]
- [Key matching requirement 5]

Consider:
1. Skills alignment (technical and soft skills)
2. Role relevance to target positions
3. Location match
4. Technology stack overlap
5. Career growth potential

Be honest and critical. Score 0-40 = poor match, 41-60 = moderate match, 61-80 = good match, 81-100 = excellent match.
Focus on concrete matches, not generic statements.`;
  }

  /**
   * Parse Claude's response to extract score and reasons
   */
  private parseMatchResponse(response: string): { score: number; matchReasons: string[] } {
    const lines = response.split('\n').map(line => line.trim());

    // Extract score
    let score = 0;
    const scoreLine = lines.find(line => line.startsWith('SCORE:'));
    if (scoreLine) {
      const scoreMatch = scoreLine.match(/(\d+)/);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1]);
      }
    }

    // Extract reasons
    const matchReasons: string[] = [];
    let inReasons = false;

    for (const line of lines) {
      if (line.startsWith('REASONS:')) {
        inReasons = true;
        continue;
      }

      if (inReasons && line.startsWith('-')) {
        const reason = line.substring(1).trim();
        if (reason) {
          matchReasons.push(reason);
        }
      }
    }

    return { score, matchReasons };
  }

  /**
   * Score multiple jobs with rate limiting
   */
  async scoreJobs(jobs: Job[]): Promise<Job[]> {
    logger.info(`Scoring ${jobs.length} jobs with Claude AI`);

    // Rate limit: 5 concurrent API calls
    const limit = pLimit(5);

    const scoredJobsPromises = jobs.map(job =>
      limit(async () => {
        const { score, matchReasons } = await this.scoreJob(job);

        return {
          ...job,
          score,
          matchReasons
        };
      })
    );

    const scoredJobs = await Promise.all(scoredJobsPromises);

    logger.info(`Scored ${scoredJobs.length} jobs successfully`);

    return scoredJobs;
  }

  /**
   * Filter jobs by minimum score threshold
   */
  filterByScore(jobs: Job[], minScore: number = 60): Job[] {
    return jobs.filter(job => (job.score || 0) >= minScore);
  }
}

/**
 * Match and score jobs using AI
 */
export async function matchJobs(jobs: Job[]): Promise<Job[]> {
  if (jobs.length === 0) {
    logger.warn('No jobs to match');
    return [];
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.error('ANTHROPIC_API_KEY not set, skipping AI matching');
    // Return jobs with default score
    return jobs.map(job => ({ ...job, score: 50, matchReasons: [] }));
  }

  const profile = await loadUserProfile();
  const matcher = new AIJobMatcher(apiKey, profile);

  // Score all jobs
  const scoredJobs = await matcher.scoreJobs(jobs);

  // Filter by minimum threshold
  const minScore = (profile.min_experience_match || 0.6) * 100;
  const filteredJobs = matcher.filterByScore(scoredJobs, minScore);

  logger.info(`${filteredJobs.length} jobs passed minimum score threshold (${minScore})`);

  // Sort by score (highest first)
  return filteredJobs.sort((a, b) => (b.score || 0) - (a.score || 0));
}
