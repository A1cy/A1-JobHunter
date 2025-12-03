import { Job, logger } from './utils.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

interface UserProfile {
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

export class KeywordJobMatcher {
  private profile: UserProfile;

  // Abbreviation map for matching common job description abbreviations
  private abbreviationMap: Map<string, string[]> = new Map([
    ['ml', ['machine learning']],
    ['ai', ['artificial intelligence']],
    ['dt', ['digital transformation']],
    ['genai', ['generative ai', 'generative artificial intelligence']],
    ['mlops', ['machine learning operations', 'ml operations']],
    ['api', ['application programming interface']],
  ]);

  constructor(profile: UserProfile) {
    this.profile = profile;
  }

  /**
   * Score a job based on keyword matching (0-100)
   */
  scoreJob(job: Job): { score: number; matchReasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 1. Title Match (40 points max)
    const titleResult = this.scoreTitleMatch(job.title);
    score += titleResult.score;
    if (titleResult.matchedRole) {
      reasons.push(`Role matches ${titleResult.matchedRole}`);
    }

    // 2. Skills Match (30 points max)
    const skillsFound = this.findSkills(job.description);
    score += skillsFound.length * 6;
    if (skillsFound.length > 0) {
      reasons.push(`Requires ${skillsFound.join(', ')} (matches your expertise)`);
    }

    // 3. Technology Match (20 points max)
    const techsFound = this.findTechnologies(job.description);
    const techScore = Math.min(techsFound.length * 2, 20);
    score += techScore;
    if (techsFound.length > 0) {
      const topTechs = techsFound.slice(0, 3).join(', ');
      reasons.push(`Tech stack includes ${topTechs}`);
    }

    // 4. Location Match (10 points max)
    const locationScore = this.scoreLocation(job.location);
    score += locationScore;
    if (locationScore > 0) {
      reasons.push('Based in Riyadh, Saudi Arabia');
    }

    return { score: Math.min(score, 100), matchReasons: reasons };
  }

  /**
   * Expand text with abbreviation equivalents for matching
   * Example: "ML models" → "ML models machine learning models"
   */
  private expandWithAbbreviations(text: string): string {
    let expanded = text.toLowerCase();

    for (const [abbr, expansions] of this.abbreviationMap) {
      // Match word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      if (regex.test(text)) {
        // Append expansions to text for matching
        expanded += ' ' + expansions.join(' ');
      }
    }

    return expanded;
  }

  /**
   * Score job title match (0-40 points)
   */
  private scoreTitleMatch(title: string): { score: number; matchedRole: string | null } {
    // Expand both title and roles for matching (handles ML ↔ Machine Learning, etc.)
    const expandedTitle = this.expandWithAbbreviations(title);
    let bestScore = 0;
    let bestRole = null;

    for (const role of this.profile.target_roles) {
      const expandedRole = this.expandWithAbbreviations(role);
      const roleWords = expandedRole.split(' ').filter(w => w.length > 0);
      const titleWords = expandedTitle.split(' ').filter(w => w.length > 0);

      // Count matching words
      const matchingWords = roleWords.filter(word =>
        titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))
      );

      // Use original role length for ratio calculation (not expanded)
      const originalRoleLength = role.split(' ').length;
      const matchRatio = matchingWords.length / originalRoleLength;

      // Exact match: 40 points, Partial: 20-35 points
      const score = matchRatio === 1.0 ? 40 : Math.floor(matchRatio * 35);

      if (score > bestScore) {
        bestScore = score;
        bestRole = role;
      }
    }

    return { score: bestScore, matchedRole: bestRole };
  }

  /**
   * Find primary skills in job description
   */
  private findSkills(description: string): string[] {
    // Expand abbreviations in description before matching (ML → machine learning)
    const expandedDesc = this.expandWithAbbreviations(description);

    return this.profile.skills.primary.filter(skill =>
      expandedDesc.includes(skill.toLowerCase())
    );
  }

  /**
   * Find technologies in job description
   */
  private findTechnologies(description: string): string[] {
    // Expand abbreviations in description before matching (API → application programming interface)
    const expandedDesc = this.expandWithAbbreviations(description);

    return this.profile.skills.technologies.filter(tech =>
      expandedDesc.includes(tech.toLowerCase())
    );
  }

  /**
   * Score location match (0-10 points)
   */
  private scoreLocation(location: string): number {
    const lowerLoc = location.toLowerCase();

    if (lowerLoc.includes('riyadh')) {
      return 10;
    } else if (lowerLoc.includes('remote') || lowerLoc.includes('hybrid')) {
      return 8;
    } else if (lowerLoc.includes('saudi arabia')) {
      return 5;
    }

    return 0;
  }

  /**
   * Filter jobs by minimum score
   */
  filterByScore(jobs: Job[], minScore: number = 60): Job[] {
    return jobs.filter(job => (job.score || 0) >= minScore);
  }

  /**
   * Score all jobs
   */
  scoreJobs(jobs: Job[]): Job[] {
    return jobs.map(job => {
      const { score, matchReasons } = this.scoreJob(job);
      return { ...job, score, matchReasons };
    });
  }
}

/**
 * Load user profile from config
 */
async function loadUserProfile(): Promise<UserProfile> {
  const profilePath = resolve(process.cwd(), 'config/a1_profile.json');
  const profileData = await readFile(profilePath, 'utf-8');
  return JSON.parse(profileData);
}

/**
 * Main export: Match jobs using FREE keyword matching
 */
export async function matchJobs(jobs: Job[]): Promise<Job[]> {
  logger.info(`🔍 Starting FREE keyword-based matching for ${jobs.length} jobs...`);

  const profile = await loadUserProfile();
  const matcher = new KeywordJobMatcher(profile);

  const scoredJobs = matcher.scoreJobs(jobs);
  // Lower threshold to 55 to account for abbreviation-heavy job descriptions
  const minScore = 55;
  const filteredJobs = matcher.filterByScore(scoredJobs, minScore);

  logger.info(`✅ Keyword matching complete: ${filteredJobs.length}/${jobs.length} jobs passed threshold (≥${minScore}%)`);

  return filteredJobs;
}
