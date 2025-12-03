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
   * Score job title match (0-40 points)
   */
  private scoreTitleMatch(title: string): { score: number; matchedRole: string | null } {
    const lowerTitle = title.toLowerCase();
    let bestScore = 0;
    let bestRole = null;

    for (const role of this.profile.target_roles) {
      const roleWords = role.toLowerCase().split(' ');
      const titleWords = lowerTitle.split(' ');

      // Count matching words
      const matchingWords = roleWords.filter(word =>
        titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))
      );

      const matchRatio = matchingWords.length / roleWords.length;

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
    const lowerDesc = description.toLowerCase();
    return this.profile.skills.primary.filter(skill =>
      lowerDesc.includes(skill.toLowerCase())
    );
  }

  /**
   * Find technologies in job description
   */
  private findTechnologies(description: string): string[] {
    const lowerDesc = description.toLowerCase();
    return this.profile.skills.technologies.filter(tech =>
      lowerDesc.includes(tech.toLowerCase())
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
  const minScore = (profile.min_experience_match || 0.6) * 100;
  const filteredJobs = matcher.filterByScore(scoredJobs, minScore);

  logger.info(`✅ Keyword matching complete: ${filteredJobs.length}/${jobs.length} jobs passed threshold (≥${minScore}%)`);

  return filteredJobs;
}
