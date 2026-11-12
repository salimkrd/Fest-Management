import { Category, CategoryParticipantEligibility, Participant } from '@/types/fest';

const normalize = (value: string | undefined): string => (value || '').trim().toLocaleLowerCase();

/**
 * Resolves the category eligibility policy, falling back to legacy General/Open heuristics
 * for existing category documents in Firestore that pre-date the explicit participantEligibility property.
 */
export function resolveCategoryEligibilityPolicy(category?: Category): CategoryParticipantEligibility {
  if (!category) return 'CATEGORY_ONLY';

  if (category.participantEligibility === 'OPEN_TO_ALL') {
    return 'OPEN_TO_ALL';
  }
  if (category.participantEligibility === 'CATEGORY_ONLY') {
    return 'CATEGORY_ONLY';
  }

  // Backward-compatibility fallback for existing/legacy categories without explicit participantEligibility
  const code = (category.code || '').trim().toUpperCase();
  const id = normalize(category.id);
  const name = normalize(category.name);

  const isLegacyGeneral =
    code === 'CAT-GEN' ||
    code === 'GEN' ||
    id === 'cat-4' ||
    id === 'cat-gen' ||
    name === 'general' ||
    name === 'general category' ||
    name === 'campus wide' ||
    name === 'campus-wide';

  return isLegacyGeneral ? 'OPEN_TO_ALL' : 'CATEGORY_ONLY';
}

/**
 * Determines whether a participant is eligible to register for a given category/competition.
 * 
 * Rules:
 * 1. If targetCategory is missing, returns false.
 * 2. OPEN_TO_ALL: Open to ANY enrolled participant from any academic category (Sub Junior, Junior, Senior, etc.).
 * 3. CATEGORY_ONLY: Restricted to participants whose assigned category matches the target category
 *    either by direct categoryId, normalized categoryName ("Senior" === "Senior"), or verified aliases.
 *    Explicit participant category name is authoritative and cannot be overridden by a stale legacy ID alias.
 */
export function isParticipantEligibleForCategory(
  participant: Participant,
  targetCategory: Category | undefined,
  allCategories?: Category[]
): boolean {
  if (!targetCategory) return false;

  // 1. If category policy is OPEN_TO_ALL, all participants are eligible regardless of category
  const policy = resolveCategoryEligibilityPolicy(targetCategory);
  if (policy === 'OPEN_TO_ALL') {
    return true;
  }

  const targetName = normalize(targetCategory.name);
  const targetCode = normalize(targetCategory.code).toUpperCase();

  // 2. Direct categoryId exact match
  if (participant.categoryId && participant.categoryId === targetCategory.id) {
    return true;
  }

  const participantName = normalize(participant.categoryName);
  const participantId = (participant.categoryId || '').trim();

  // Some imported/older participant records have an empty categoryName, while
  // the UI displays their classGrade as the category (e.g. "Test CAT 26").
  // Only infer that assignment when classGrade exactly matches a real category
  // name/code, so academic grades like "Grade 12" or "UG" are not misread.
  const classGrade = normalize(participant.classGrade);
  const classGradeCategory = classGrade
    ? allCategories?.find(category =>
        normalize(category.name) === classGrade ||
        normalize(category.code) === classGrade
      )
    : undefined;
  const assignedCategoryName = participantName || normalize(classGradeCategory?.name);

  // The explicit category name (or a classGrade that exactly maps to a known
  // category) is authoritative. A reused/stale legacy ID must not override it.
  if (assignedCategoryName && targetName) {
    return assignedCategoryName === targetName;
  }

  // Only fall back to category IDs when the participant record has no explicit
  // category name. This keeps legacy IDs useful without allowing them to
  // override a known category assignment.
  const participantCategory = participantId
    ? allCategories?.find(category => category.id === participantId)
    : undefined;

  if (participantCategory) {
    const sameId = participantCategory.id === targetCategory.id;
    const participantCode = normalize(participantCategory.code).toUpperCase();
    const sameCode = Boolean(participantCode && targetCode && participantCode === targetCode);
    if (sameId || sameCode) return true;
    if (participantCategory.name && normalize(participantCategory.name) === targetName) return true;
  }

  // Standard tier code and name aliases for older records without a categoryName
  const isTargetSJ =
    targetCode === 'CAT-SJ' || targetName.includes('sub') ||
    normalize(targetCategory.id) === 'cat-1' || normalize(targetCategory.id) === 'cat-sj';
  const isTargetJR =
    !isTargetSJ && (targetCode === 'CAT-JR' || targetName === 'junior' ||
    normalize(targetCategory.id) === 'cat-2' || normalize(targetCategory.id) === 'cat-jr');
  const isTargetSR =
    targetCode === 'CAT-SR' || targetName === 'senior' ||
    normalize(targetCategory.id) === 'cat-3' || normalize(targetCategory.id) === 'cat-sr';

  const id = normalize(participantId);
  const isPartSJ = id === 'cat-1' || id === 'cat-sj';
  const isPartJR = id === 'cat-2' || id === 'cat-jr';
  const isPartSR = id === 'cat-3' || id === 'cat-sr';

  if (isTargetSJ && isPartSJ) return true;
  if (isTargetJR && isPartJR) return true;
  if (isTargetSR && isPartSR) return true;

  return false;
}
