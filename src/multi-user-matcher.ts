import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { Job, logger } from './utils.js';
import { KeywordJobMatcher } from './keyword-matcher.js';

/**
 * User profile interface (matches format in users/[username]/profile.json)
 */
export interface UserProfile {
  name: string;
  location: string;
  target_roles: string[];
  skills: {
    primary: string[];
    technologies: string[];
  };
  min_experience_match: number;
  languages: string[];
}

/**
 * User configuration interface (from users/[username]/config.json)
 */
export interface UserConfig {
  enabled: boolean;
  telegram_chat_id: string;
  name: string;
  email?: string;
  matching_threshold: number;
  max_jobs_per_day: number;
}

/**
 * Combined user data
 */
export interface User {
  username: string;
  profile: UserProfile;
  config: UserConfig;
}

/**
 * Match result for a single user
 */
export interface UserMatchResult {
  username: string;
  profile: UserProfile;
  config: UserConfig;
  matched_jobs: Job[];
  stats: {
    total_jobs_checked: number;
    jobs_matched: number;
    avg_score: number;
    high_match_count: number;
  };
}

/**
 * Load all enabled users from users/ directory
 */
export async function loadAllUsers(): Promise<User[]> {
  const usersDir = resolve(process.cwd(), 'users');

  if (!existsSync(usersDir)) {
    logger.warn('users/ directory not found');
    return [];
  }

  const usernames = await readdir(usersDir, { withFileTypes: true });
  const users: User[] = [];

  for (const entry of usernames) {
    if (!entry.isDirectory()) continue;

    const username = entry.name;
    const profilePath = resolve(usersDir, username, 'profile.json');
    const configPath = resolve(usersDir, username, 'config.json');

    // Check if both files exist
    if (!existsSync(profilePath) || !existsSync(configPath)) {
      logger.warn(`Skipping ${username}: missing profile.json or config.json`);
      continue;
    }

    try {
      // Load profile and config
      const profileData = await readFile(profilePath, 'utf-8');
      const configData = await readFile(configPath, 'utf-8');

      const profile: UserProfile = JSON.parse(profileData);
      const config: UserConfig = JSON.parse(configData);

      // Only include enabled users with valid chat IDs
      if (config.enabled && config.telegram_chat_id) {
        users.push({ username, profile, config });
        logger.debug(`✅ Loaded user: ${username} (${profile.name})`);
      } else if (config.enabled && !config.telegram_chat_id) {
        logger.warn(`⚠️  User ${username} is enabled but has no telegram_chat_id`);
      } else {
        logger.debug(`⏸️  User ${username} is disabled`);
      }
    } catch (error) {
      logger.error(`Error loading user ${username}:`, error);
    }
  }

  return users;
}

/**
 * Filter jobs by user-specific threshold with smart guarantees
 */
function filterByUserThreshold(
  jobs: Job[],
  threshold: number,
  maxJobs: number
): Job[] {
  const MIN_RESULTS = 5; // Always return at least 5 jobs if available

  // Sort by score (highest first)
  const sortedJobs = [...jobs].sort((a, b) => (b.score || 0) - (a.score || 0));

  // Filter by threshold
  let filtered = sortedJobs.filter(job => (job.score || 0) >= threshold);

  // Smart minimum guarantee
  if (filtered.length < MIN_RESULTS && sortedJobs.length >= MIN_RESULTS) {
    logger.debug(`Only ${filtered.length} passed threshold, taking top ${MIN_RESULTS}`);
    filtered = sortedJobs.slice(0, MIN_RESULTS);
  }

  // Cap at user's maximum
  if (filtered.length > maxJobs) {
    logger.debug(`Capping results at ${maxJobs} jobs`);
    filtered = filtered.slice(0, maxJobs);
  }

  return filtered;
}

/**
 * Calculate statistics for matched jobs
 */
function calculateStats(matchedJobs: Job[], totalJobs: number) {
  const jobsMatched = matchedJobs.length;
  const avgScore = jobsMatched > 0
    ? Math.round(matchedJobs.reduce((sum, job) => sum + (job.score || 0), 0) / jobsMatched)
    : 0;
  const highMatchCount = matchedJobs.filter(job => (job.score || 0) >= 85).length;

  return {
    total_jobs_checked: totalJobs,
    jobs_matched: jobsMatched,
    avg_score: avgScore,
    high_match_count: highMatchCount
  };
}

/**
 * Match jobs for all enabled users
 */
export async function matchJobsForAllUsers(allJobs: Job[]): Promise<UserMatchResult[]> {
  logger.info(`🔍 Loading users for multi-user matching...`);

  const users = await loadAllUsers();

  if (users.length === 0) {
    logger.error('❌ No enabled users found with valid Telegram chat IDs');
    return [];
  }

  logger.info(`✅ Found ${users.length} enabled user(s): ${users.map(u => u.username).join(', ')}`);

  const results: UserMatchResult[] = [];

  for (const user of users) {
    logger.info(`\n📊 Matching jobs for ${user.username} (${user.profile.name})...`);

    // Create matcher with user's profile
    const matcher = new KeywordJobMatcher(user.profile);

    // Score all jobs
    const scoredJobs = matcher.scoreJobs(allJobs);

    // Filter by user's threshold and limits
    const matchedJobs = filterByUserThreshold(
      scoredJobs,
      user.config.matching_threshold,
      user.config.max_jobs_per_day
    );

    // Calculate statistics
    const stats = calculateStats(matchedJobs, allJobs.length);

    logger.info(`   ✅ ${user.username}: ${matchedJobs.length} jobs matched (avg ${stats.avg_score}%, high match: ${stats.high_match_count})`);

    results.push({
      username: user.username,
      profile: user.profile,
      config: user.config,
      matched_jobs: matchedJobs,
      stats
    });
  }

  return results;
}
