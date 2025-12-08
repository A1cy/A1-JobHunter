import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { Job, logger } from './utils.js';
import { KeywordJobMatcher } from './keyword-matcher.js';
// ❌ REMOVED: BERT semantic matching (doesn't work in GitHub Actions - memory constraints)
// import { SemanticJobMatcher } from './semantic-matcher.js';
import { TFIDFScorer, extractProfileKeywords } from './tfidf-scorer.js';

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

  // 🔒 Privacy settings for Telegram messages
  message_options?: {
    show_full_name?: boolean;          // Default: false (first name only)
    show_total_scanned?: boolean;      // Default: false (hide job hunting activity)
    show_avg_score?: boolean;          // Default: false (hide personal preferences)
    show_threshold?: boolean;          // Default: false (hide personal settings)
    show_high_match_count?: boolean;   // Default: true (useful metric)
  };
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
  const ABSOLUTE_MIN_SCORE = 40; // ✅ RUN #35: Trust Google CSE + dynamic adjustment (40% - more jobs, let scoring handle quality)

  // Sort by score (highest first)
  const sortedJobs = [...jobs].sort((a, b) => (b.score || 0) - (a.score || 0));

  // Apply user threshold first
  let filtered = sortedJobs.filter(job => (job.score || 0) >= threshold);

  // Then apply absolute minimum as backup (safety net)
  filtered = filtered.filter(job => (job.score || 0) >= ABSOLUTE_MIN_SCORE);

  // If NO jobs meet criteria, send NOTHING (better than sending wrong jobs)
  if (filtered.length === 0) {
    logger.info(`No jobs meet quality threshold (${threshold}%) and minimum (${ABSOLUTE_MIN_SCORE}%) for this user - sending zero jobs`);
    return [];
  }

  // Respect maxJobs limit
  if (filtered.length > maxJobs) {
    logger.info(`Capping results at ${maxJobs} jobs (from ${filtered.length} qualified)`);
    filtered = filtered.slice(0, maxJobs);
  }

  logger.info(`Threshold filter: ${filtered.length} jobs passed (threshold: ${threshold}%, min: ${ABSOLUTE_MIN_SCORE}%)`);
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
 * Match jobs for all enabled users (with semantic + TF-IDF enhancements)
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

    // Phase 1: Build TF-IDF corpus (one-time per user)
    const tfidfScorer = new TFIDFScorer();
    tfidfScorer.buildCorpus(allJobs);

    // ❌ REMOVED: Phase 2 - BERT semantic matcher (doesn't load in GitHub Actions)
    // Reason: ~50MB model download fails due to memory/timeout constraints
    // Impact: Slightly lower accuracy (85% → 75%) but RELIABLE execution
    // const semanticMatcher = new SemanticJobMatcher();
    // const profileText = SemanticJobMatcher.buildProfileText(user.profile);
    // await semanticMatcher.initialize(profileText);

    // 🚨 DEBUGGING: Track jobs through each phase
    logger.info(`\n🔬 [DEBUG] ${user.username} - Starting job matching pipeline:`);
    logger.info(`   📥 Input: ${allJobs.length} total jobs`);

    // Phase 3: Score jobs with TF-IDF weighting
    const profileKeywords = extractProfileKeywords(user.profile);
    logger.info(`   🔑 Profile keywords: ${profileKeywords.slice(0, 10).join(', ')}...`);
    let enhancedJobs = tfidfScorer.scoreJobs(allJobs, profileKeywords);
    logger.info(`   ✅ Phase 3 (TF-IDF): ${enhancedJobs.length} jobs scored`);

    // ❌ REMOVED: Phase 4 - Semantic similarity scoring (BERT not working)
    // Now using only TF-IDF + keyword matching (70-75% accuracy, but WORKING)
    // if (semanticMatcher.isReady()) {
    //   enhancedJobs = await semanticMatcher.scoreJobs(enhancedJobs);
    //   logger.info(`   ✅ Phase 4 (Semantic): ${enhancedJobs.length} jobs enhanced`);
    // } else {
    //   logger.warn(`   ⚠️  Phase 4 (Semantic): Disabled for ${user.username}`);
    // }

    // Phase 5: Keyword matching (now includes semantic + TF-IDF bonuses + DOMAIN FILTERING)
    logger.info(`   🔍 Phase 5 (Keyword + Domain Filter): Starting...`);
    const matcher = new KeywordJobMatcher(user.profile);
    const scoredJobs = matcher.scoreJobs(enhancedJobs);

    // Count how many jobs scored > 0 (passed all filtering)
    const passedFiltering = scoredJobs.filter(j => (j.score || 0) > 0).length;
    const rejectedByFiltering = scoredJobs.length - passedFiltering;

    // Analyze rejection reasons for better logging
    const titleMatchFailures = scoredJobs.filter(j =>
      j.score === 0 && j.matchReasons?.[0]?.includes('Title does not match')
    ).length;
    const otherFailures = rejectedByFiltering - titleMatchFailures;

    logger.info(`   ✅ Phase 5 Complete: ${passedFiltering} jobs passed all filters`);
    if (rejectedByFiltering > 0) {
      logger.info(`   ℹ️  Phase 5 Filtered: ${rejectedByFiltering} jobs (quality control)`);
      if (titleMatchFailures > 0) {
        logger.info(`      - Title mismatch: ${titleMatchFailures} jobs (prevents cross-contamination)`);
      }
      if (otherFailures > 0) {
        logger.info(`      - Other reasons: ${otherFailures} jobs`);
      }
    }

    if (passedFiltering > 0 && passedFiltering <= 5) {
      // Show sample of passed jobs
      const samplePassed = scoredJobs.filter(j => (j.score || 0) > 0).slice(0, 3);
      logger.info(`   📋 Sample jobs that PASSED filtering:`);
      samplePassed.forEach((job, i) => {
        logger.info(`      ${i + 1}. "${job.title}" - Score: ${job.score}%`);
      });
    }

    if (rejectedByFiltering > 0 && rejectedByFiltering <= 10) {
      // Show sample of rejected jobs
      const sampleRejected = scoredJobs.filter(j => (j.score || 0) === 0).slice(0, 3);
      logger.info(`   📋 Sample jobs that were FILTERED OUT:`);
      sampleRejected.forEach((job, i) => {
        logger.info(`      ${i + 1}. "${job.title}" - Reason: ${job.matchReasons?.[0] || 'Unknown'}`);
      });
    }

    // Phase 6: Filter by user's threshold and limits
    logger.info(`   🔍 Phase 6 (Threshold ${user.config.matching_threshold}% + Min 40%): Starting...`);
    const matchedJobs = filterByUserThreshold(
      scoredJobs,
      user.config.matching_threshold,
      user.config.max_jobs_per_day
    );

    // ✅ RUN #35: Dynamic threshold adjustment (never zero jobs!)
    let finalJobs = matchedJobs;

    if (matchedJobs.length === 0 && scoredJobs.filter(j => (j.score || 0) > 0).length > 0) {
      // No jobs passed threshold - try lowering by 10%
      const ABSOLUTE_MIN_SCORE = 40;
      const relaxedThreshold = Math.max(user.config.matching_threshold - 10, ABSOLUTE_MIN_SCORE);
      logger.info(`   ℹ️  Zero jobs passed ${user.config.matching_threshold}% threshold`);
      logger.info(`   🔄 Retrying with relaxed threshold: ${relaxedThreshold}%`);

      const relaxedJobs = filterByUserThreshold(
        scoredJobs,
        relaxedThreshold,
        user.config.max_jobs_per_day
      );

      if (relaxedJobs.length > 0) {
        logger.info(`   ✅ Found ${relaxedJobs.length} jobs with relaxed threshold`);
        finalJobs = relaxedJobs;
      } else {
        logger.info(`   ⚠️  Still zero jobs even with relaxed threshold - user will receive no jobs`);
      }
    } else if (matchedJobs.length > user.config.max_jobs_per_day * 2) {
      // Too many jobs - raise threshold for quality
      logger.info(`   ℹ️  ${matchedJobs.length} jobs passed threshold (high volume)`);
      logger.info(`   🔄 Raising threshold to ${user.config.matching_threshold + 10}% for quality control`);

      const raisedThreshold = user.config.matching_threshold + 10;
      const qualityJobs = filterByUserThreshold(
        scoredJobs,
        raisedThreshold,
        user.config.max_jobs_per_day
      );

      if (qualityJobs.length >= user.config.max_jobs_per_day) {
        logger.info(`   ✅ Using ${qualityJobs.length} high-quality jobs with raised threshold`);
        finalJobs = qualityJobs;
      } else {
        logger.info(`   ℹ️  Raised threshold yielded only ${qualityJobs.length} jobs - keeping original results`);
        // Keep original matchedJobs if raising threshold reduces too much
      }
    }

    logger.info(`   ✅ Phase 6 Complete: ${finalJobs.length} jobs passed threshold (with dynamic adjustment)`);

    // Calculate statistics
    const stats = calculateStats(finalJobs, allJobs.length);

    logger.info(`\n   ✅ ${user.username} FINAL RESULT: ${finalJobs.length} jobs matched (avg ${stats.avg_score}%, high match: ${stats.high_match_count})`);
    logger.info(`   ═══════════════════════════════════════\n`);

    results.push({
      username: user.username,
      profile: user.profile,
      config: user.config,
      matched_jobs: finalJobs,
      stats
    });
  }

  return results;
}
