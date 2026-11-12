import { Category, CategoryParticipantEligibility, Participant } from '@/types/fest';

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
  const id = (category.id || '').trim().toLowerCase();
  const name = (category.name || '').trim().toLowerCase();

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
 * 1. OPEN_TO_ALL: Open to ANY enrolled participant from any academic category (Sub Junior, Junior, Senior, etc.).
 * 2. CATEGORY_ONLY: Restricted to participants whose assigned category matches the target category
 *    either by direct categoryId, normalized categoryName ("Senior" === "Senior"), or standard aliases.
 */
export function isParticipantEligibleForCategory(
  participant: Participant,
  targetCategory: Category | undefined,
  allCategories?: Category[]
): boolean {
  if (!targetCategory) return true;

  // 1. If category policy is OPEN_TO_ALL, all participants are eligible regardless of category
  const policy = resolveCategoryEligibilityPolicy(targetCategory);
  if (policy === 'OPEN_TO_ALL') {
    return true;
  }

  // 2. Policy is CATEGORY_ONLY: verify matching category
  // Direct ID match
  if (participant.categoryId && participant.categoryId === targetCategory.id) {
    return true;
  }

  // Name normalization match (e.g. "Senior" === "Senior")
  const partName = participant.categoryName?.trim().toLowerCase();
  const targetName = targetCategory.name?.trim().toLowerCase();
  if (partName && targetName && partName === targetName) {
    return true;
  }

  // Resolve participant's category from allCategories if participant has categoryId
  if (allCategories && participant.categoryId) {
    const partCat = allCategories.find(c => c.id === participant.categoryId);
    if (partCat) {
      if (partCat.name?.trim().toLowerCase() === targetName) return true;
      if (partCat.code && targetCategory.code && partCat.code.toUpperCase() === targetCategory.code.toUpperCase()) return true;
    }
  }

  // Standard tier code and name aliases
  const targetCode = targetCategory.code?.toUpperCase();
  const isTargetSJ = targetCode === 'CAT-SJ' || targetName?.includes('sub') || targetCategory.id === 'cat-1' || targetCategory.id === 'cat-sj';
  const isTargetJR = !isTargetSJ && (targetCode === 'CAT-JR' || targetName === 'junior' || targetCategory.id === 'cat-2' || targetCategory.id === 'cat-jr');
  const isTargetSR = targetCode === 'CAT-SR' || targetName === 'senior' || targetCategory.id === 'cat-3' || targetCategory.id === 'cat-sr';

  const isPartSJ = partName?.includes('sub') || participant.categoryId === 'cat-1' || participant.categoryId === 'cat-sj';
  const isPartJR = !isPartSJ && (partName === 'junior' || participant.categoryId === 'cat-2' || participant.categoryId === 'cat-jr');
  const isPartSR = partName === 'senior' || participant.categoryId === 'cat-3' || participant.categoryId === 'cat-sr';

  if (isTargetSJ && isPartSJ) return true;
  if (isTargetJR && isPartJR) return true;
  if (isTargetSR && isPartSR) return true;

  return false;
}
