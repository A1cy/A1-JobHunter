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
    // Existing abbreviations
    ['ml', ['machine learning']],
    ['ai', ['artificial intelligence']],
    ['dt', ['digital transformation']],
    ['genai', ['generative ai', 'generative artificial intelligence']],
    ['mlops', ['machine learning operations', 'ml operations']],
    ['api', ['application programming interface']],

    // NEW: Development & Engineering
    ['fe', ['frontend', 'front-end', 'front end']],
    ['be', ['backend', 'back-end', 'back end']],
    ['fullstack', ['full stack', 'full-stack']],
    ['devops', ['development operations', 'dev ops']],
    ['qa', ['quality assurance', 'quality analyst']],
    ['sre', ['site reliability engineer', 'site reliability engineering']],
    ['ci/cd', ['continuous integration', 'continuous deployment', 'continuous delivery']],
    ['cicd', ['continuous integration', 'continuous deployment', 'continuous delivery']],

    // NEW: Technologies & Frameworks
    ['js', ['javascript']],
    ['ts', ['typescript']],
    ['py', ['python']],
    ['k8s', ['kubernetes']],
    ['aws', ['amazon web services']],
    ['gcp', ['google cloud platform']],
    ['db', ['database']],
    ['nosql', ['non-relational database']],
    ['rest', ['restful api', 'rest api']],
    ['graphql', ['graph query language']],

    // NEW: HR & Business (for Hamad)
    ['hr', ['human resources']],
    ['hris', ['human resource information system']],
    ['od', ['organization development', 'organizational development']],
    ['l&d', ['learning and development', 'learning & development']],
    ['c&b', ['compensation and benefits', 'compensation & benefits']],

    // NEW: Product & Marketing (for Saud)
    ['pm', ['product manager', 'product management', 'project manager']],
    ['seo', ['search engine optimization']],
    ['ppc', ['pay per click', 'pay-per-click']],
    ['roi', ['return on investment']],
    ['kpi', ['key performance indicator', 'key performance indicators']],
    ['gtm', ['go to market', 'go-to-market']],
    ['b2b', ['business to business', 'business-to-business']],
    ['b2c', ['business to consumer', 'business-to-consumer']],
    ['saas', ['software as a service']],
  ]);

  constructor(profile: UserProfile) {
    this.profile = profile;
  }

  /**
   * STRICT DOMAIN WHITELIST: Job MUST contain domain-specific keywords to be considered
   * This is the PRIMARY filter for 100% accuracy
   * Returns true if job matches user's domain, false otherwise
   */
  private matchesUserDomain(job: Job): boolean {
    const titleLower = job.title.toLowerCase();
    const descLower = (job.description || '').toLowerCase();
    const combinedText = `${titleLower} ${descLower}`;

    const targetRolesStr = this.profile.target_roles.join(' ').toLowerCase();

    // Define domain-specific keywords with FLEXIBLE variations for better Google snippet matching
    // Issue: Google snippets might say "people management" instead of "hr manager"
    // Solution: Add single-word flexible terms to catch partial matches
    const hrKeywords = [
      // Strict role keywords (existing)
      'hr specialist', 'hr generalist', 'hr officer', 'hr manager', 'hr director',
      'human resources', 'recruitment', 'recruiter', 'talent acquisition',
      'headhunter', 'sourcing', 'staffing', 'hiring',
      'hris', 'hris analyst', 'hris specialist', 'hr systems',
      'payroll', 'compensation', 'benefits', 'c&b',
      'employee relations', 'organizational development', 'od specialist',
      'learning and development', 'l&d', 'training', 'trainer',
      'hr business partner', 'hrbp', 'hr consultant',
      'onboarding', 'offboarding', 'hr compliance', 'hr coordinator',
      // Saudi-specific
      'qiwa', 'gosi', 'saudi labor law', 'saudization', 'nitaqat',
      'mudad', 'mol', 'ministry of labor',
      // 🆕 FLEXIBLE variations (single words for partial matching in Google snippets)
      'personnel', 'workforce', 'employee', 'people management',
      'organizational', 'workplace', 'culture', 'engagement'
    ];

    const productKeywords = [
      // Strict role keywords (existing)
      'product manager', 'product owner', 'product specialist', 'product lead',
      'brand manager', 'brand specialist', 'brand director',
      'product marketing', 'product strategy', 'product analyst',
      'business development', 'bd manager', 'business analyst',
      'product consultant', 'product coordinator',
      // Skills
      'product management', 'product development', 'product lifecycle',
      'brand strategy', 'brand development', 'branding',
      'market research', 'marketing strategy', 'digital marketing',
      'e-commerce', 'ecommerce', 'online retail',
      'seo', 'ppc', 'sem', 'google ads', 'social media marketing',
      'growth hacking', 'go-to-market', 'gtm',
      'hubspot', 'google analytics', 'marketing automation',
      // 🆕 FLEXIBLE variations (single words for partial matching in Google snippets)
      'product', 'brand', 'marketing', 'growth', 'strategy',
      'market', 'customer', 'analytics', 'campaign', 'content'
    ];

    const itKeywords = [
      // Strict role keywords (existing)
      'software engineer', 'software developer', 'web developer', 'full stack',
      'backend developer', 'frontend developer', 'devops engineer',
      'ai engineer', 'ml engineer', 'machine learning', 'data scientist',
      'genai', 'artificial intelligence', 'deep learning',
      'digital transformation', 'transformation specialist', 'transformation manager',
      'cloud engineer', 'cloud architect', 'solutions architect',
      'mlops', 'data engineer', 'platform engineer',
      // Technologies
      'python', 'javascript', 'typescript', 'java', 'c++', 'golang', 'rust',
      'react', 'angular', 'vue', 'node.js', 'django', 'flask', 'fastapi',
      'tensorflow', 'pytorch', 'scikit-learn', 'langchain',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s',
      'git', 'ci/cd', 'jenkins', 'terraform',
      // 🆕 FLEXIBLE variations (single words for partial matching in Google snippets)
      'software', 'developer', 'engineer', 'programming', 'coding',
      'technical', 'technology', 'digital', 'data', 'cloud',
      'api', 'database', 'automation', 'infrastructure', 'architecture'
    ];

    // Determine user's domain
    let userDomain: 'hr' | 'product' | 'it' = 'it'; // default

    if (targetRolesStr.includes('hr') || targetRolesStr.includes('recruitment') ||
        targetRolesStr.includes('human resources') || targetRolesStr.includes('payroll')) {
      userDomain = 'hr';
    } else if (targetRolesStr.includes('product') || targetRolesStr.includes('brand') ||
               targetRolesStr.includes('marketing')) {
      userDomain = 'product';
    }

    // STRICT WHITELIST: Job MUST contain at least ONE domain keyword
    let requiredKeywords: string[] = [];
    switch (userDomain) {
      case 'hr':
        requiredKeywords = hrKeywords;
        break;
      case 'product':
        requiredKeywords = productKeywords;
        break;
      case 'it':
        requiredKeywords = itKeywords;
        break;
    }

    // Check if job contains ANY of the required domain keywords
    let hasMatch = requiredKeywords.some(keyword => combinedText.includes(keyword));

    // 🆕 FALLBACK: If no domain keyword match, check if job title contains user's target roles
    // This catches cases where Google snippets don't contain domain keywords but title has exact role
    if (!hasMatch) {
      const targetRoles = this.profile.target_roles.map(r => r.toLowerCase());
      hasMatch = targetRoles.some(role => {
        const roleWords = role.split(' ').filter(w => w.length > 2); // Skip short words like "of", "in"
        // Check if ALL significant words of the role appear in combined text
        const allWordsPresent = roleWords.every(word => combinedText.includes(word));

        if (allWordsPresent) {
          logger.debug(`[Domain Whitelist] PASSED (fallback): "${job.title}" - Matched target role: "${role}"`);
        }

        return allWordsPresent;
      });
    }

    if (!hasMatch) {
      logger.debug(`[Domain Whitelist] REJECTED: "${job.title}" - No ${userDomain} keywords or target roles found`);
    }

    return hasMatch;
  }

  /**
   * Check if job contains cross-domain keywords that conflict with profile
   * NOW CHECKS BOTH TITLE AND DESCRIPTION for maximum accuracy
   */
  private hasCrossDomainConflict(job: Job): boolean {
    const titleLower = job.title.toLowerCase();
    const descLower = (job.description || '').toLowerCase();
    const combinedText = `${titleLower} ${descLower}`; // Check BOTH title and description
    const targetRolesStr = this.profile.target_roles.join(' ').toLowerCase();

    // Define domain-specific keywords (COMPREHENSIVE LIST - FIX FOR CROSS-DOMAIN FILTERING)
    const itKeywords = [
      // Original keywords
      'software', 'developer', 'programming', 'ai engineer', 'ml engineer',
      'data scientist', 'devops', 'full stack', 'frontend', 'backend',
      'digital transformation', 'machine learning', 'artificial intelligence',

      // Web development (ALL VARIANTS)
      'web developer', 'web engineer', 'web dev', 'web application', 'webdev',
      'website developer', 'web programmer',

      // Backend development (ALL VARIANTS)
      'backend developer', 'backend engineer', 'back end', 'back-end',
      'backend programmer', 'server side developer',

      // Frontend development (ALL VARIANTS)
      'frontend developer', 'frontend engineer', 'front end', 'front-end',
      'ui developer', 'frontend programmer',

      // Full stack (ALL VARIANTS)
      'full stack developer', 'fullstack', 'full-stack', 'full stack engineer',
      'full-stack engineer', 'fullstack developer',

      // API and cloud
      'api developer', 'api engineer', 'rest api', 'graphql', 'api designer',
      'cloud engineer', 'cloud architect', 'cloud developer',
      'aws', 'azure', 'gcp', 'cloud infrastructure', 'cloud specialist',

      // Database and infrastructure
      'database administrator', 'database engineer', 'dba', 'sql developer',
      'database developer', 'database specialist',
      'infrastructure engineer', 'systems engineer', 'network engineer',
      'system administrator', 'devops engineer',

      // Mobile development
      'mobile developer', 'android developer', 'ios developer',
      'mobile engineer', 'app developer', 'mobile app',
      'react native', 'flutter developer', 'swift developer', 'kotlin developer',

      // QA and testing
      'qa engineer', 'quality assurance', 'test engineer', 'automation engineer',
      'software tester', 'qa analyst', 'testing engineer',

      // Security
      'security engineer', 'cybersecurity', 'penetration tester',
      'security analyst', 'infosec', 'appsec',

      // Blockchain and emerging tech
      'blockchain developer', 'smart contract', 'web3 developer',
      'cryptocurrency', 'solidity developer',

      // Generic IT roles
      'software engineer', 'coding', 'programmer', 'coder',
      'tech lead', 'engineering manager', 'technical lead',
      'it specialist', 'it engineer', 'technology',

      // Platform and operations
      'platform engineer', 'sre', 'site reliability', 'operations engineer',
      'kubernetes', 'docker', 'containerization'
    ];

    const hrKeywords = ['hr specialist', 'hr generalist', 'hr officer', 'recruitment',
                       'payroll', 'hris', 'employee relations', 'hr business partner'];

    // If profile is HR-focused but job has IT keywords → reject
    if (targetRolesStr.includes('hr') && !targetRolesStr.includes('software')) {
      if (itKeywords.some(k => combinedText.includes(k))) {  // ✅ Check BOTH title and description
        logger.debug(`[Cross-Domain Blacklist] REJECTED: "${job.title}" - HR profile getting IT job`);
        return true; // HR profile getting IT job
      }
    }

    // If profile is IT-focused but job has HR keywords → reject
    if ((targetRolesStr.includes('software') || targetRolesStr.includes('developer') ||
         targetRolesStr.includes('ai') || targetRolesStr.includes('engineer')) &&
        !targetRolesStr.includes('hr')) {
      if (hrKeywords.some(k => combinedText.includes(k))) {  // ✅ Check BOTH title and description
        logger.debug(`[Cross-Domain Blacklist] REJECTED: "${job.title}" - IT profile getting HR job`);
        return true; // IT profile getting HR job
      }
    }

    // If profile is Marketing-focused but job has IT/HR keywords → reject
    if ((targetRolesStr.includes('product') || targetRolesStr.includes('marketing') ||
         targetRolesStr.includes('brand')) &&
        !targetRolesStr.includes('software') && !targetRolesStr.includes('hr')) {
      if (itKeywords.some(k => combinedText.includes(k)) ||  // ✅ Check BOTH title and description
          hrKeywords.some(k => combinedText.includes(k))) {
        logger.debug(`[Cross-Domain Blacklist] REJECTED: "${job.title}" - Product/Marketing profile getting IT/HR job`);
        return true; // Marketing profile getting IT/HR job
      }
    }

    return false; // No conflict
  }

  /**
   * Score a job based on keyword matching + semantic similarity + TF-IDF (0-100)
   *
   * Scoring breakdown:
   * - Keyword matching: 0-100 points (title, skills, tech, location)
   * - Semantic similarity: 0-15 bonus points (BERT-based)
   * - TF-IDF weighting: 0-10 bonus points (keyword importance)
   * Total: 0-125 points (capped at 100)
   *
   * IMPORTANT: Title match is MANDATORY - jobs with poor title matches are rejected
   * to prevent cross-domain contamination (e.g., HR profiles getting IT jobs)
   */
  scoreJob(job: Job): { score: number; matchReasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 0A. STRICT DOMAIN WHITELIST (FIRST CHECK - PRIMARY FILTER FOR 100% ACCURACY)
    if (!this.matchesUserDomain(job)) {
      return { score: 0, matchReasons: ['Not in user domain (missing required HR/Product/IT keywords)'] };
    }

    // 0B. Cross-Domain Blacklist (SECOND CHECK - DOUBLE-CHECK FOR CONFLICTS)
    if (this.hasCrossDomainConflict(job)) {  // ✅ Now passes full job object
      return { score: 0, matchReasons: ['Job domain does not match profile (IT/HR/Marketing conflict)'] };
    }

    // 1. Title Match (40 points max) - MANDATORY FILTER
    const titleResult = this.scoreTitleMatch(job.title);
    score += titleResult.score;

    // 🚨 MANDATORY: Reject jobs with poor title match (<62.5% = <25 points)
    // This prevents cross-domain contamination (HR getting IT jobs, etc.)
    // Requires at least 60%+ word match ratio between job title and target roles
    const MIN_TITLE_SCORE = 25; // 62.5% of 40 points
    if (titleResult.score < MIN_TITLE_SCORE) {
      // Job title doesn't match any target role - reject immediately
      return { score: 0, matchReasons: ['Title does not match any target role'] };
    }

    if (titleResult.matchedRole) {
      reasons.push(`Role matches ${titleResult.matchedRole}`);
    }

    // 2. Skills Match (30 points max)
    const skillsFound = this.findSkills(job.description || '');
    score += skillsFound.length * 6;
    if (skillsFound.length > 0) {
      reasons.push(`Requires ${skillsFound.join(', ')} (matches your expertise)`);
    }

    // 3. Technology Match (20 points max)
    const techsFound = this.findTechnologies(job.description || '');
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

    // 5. Semantic Similarity Bonus (0-15 points) - added by semantic matcher
    if (job.semanticScore && job.semanticScore > 0) {
      score += job.semanticScore;
      reasons.push(`Strong semantic match (+${job.semanticScore} pts)`);
    }

    // 6. TF-IDF Bonus (0-10 points) - added by TF-IDF scorer
    if (job.tfidfScore && job.tfidfScore > 0) {
      score += job.tfidfScore;
      reasons.push(`Rare, important keywords (+${job.tfidfScore} pts)`);
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
   * Levenshtein distance for fuzzy string matching
   * Allows 2-character differences for typos and variations
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,      // insertion
          matrix[j - 1][i] + 1,      // deletion
          matrix[j - 1][i - 1] + indicator  // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Score job title match with fuzzy logic (0-40 points)
   * Improved to handle partial matches and typos
   */
  private scoreTitleMatch(title: string): { score: number; matchedRole: string | null } {
    // Expand both title and roles for matching (handles ML ↔ Machine Learning, etc.)
    const expandedTitle = this.expandWithAbbreviations(title);
    let bestScore = 0;
    let bestRole = null;

    for (const role of this.profile.target_roles) {
      const expandedRole = this.expandWithAbbreviations(role);
      // Filter out short words (a, in, or, etc.) that don't add meaning
      const roleWords = expandedRole.split(' ').filter(w => w.length > 2);
      const titleWords = expandedTitle.split(' ').filter(w => w.length > 2);

      // NEW: Fuzzy matching - count partial word matches
      const matchingWords = roleWords.filter(word =>
        titleWords.some(titleWord =>
          titleWord.includes(word) ||
          word.includes(titleWord) ||
          this.levenshteinDistance(word, titleWord) <= 2  // Allow 2 char difference
        )
      );

      // Use original role length for ratio calculation (not expanded)
      const originalRoleLength = role.split(' ').filter(w => w.length > 2).length;
      const matchRatio = originalRoleLength > 0 ? matchingWords.length / originalRoleLength : 0;

      // NEW: More generous scoring
      // Exact match: 40 points
      // 80%+ match: 35 points
      // 60%+ match: 30 points
      // 40%+ match: 20 points
      let score = 0;
      if (matchRatio >= 1.0) score = 40;
      else if (matchRatio >= 0.8) score = 35;
      else if (matchRatio >= 0.6) score = 30;
      else if (matchRatio >= 0.4) score = 20;
      else score = Math.floor(matchRatio * 15);

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
 * LEGACY FUNCTIONS REMOVED:
 * - loadUserProfile() - Loaded from legacy config/a1_profile.json (single-user)
 * - matchJobs() - Used single user profile instead of multi-user profiles
 *
 * Multi-user system now uses KeywordJobMatcher class directly with user-specific profiles
 * See multi-user-matcher.ts for the current implementation
 */
