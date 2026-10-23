import { Category, Participant } from '@/types/fest';

/**
 * Determines whether a participant is eligible to register for a given category/competition.
 * 
 * Rules:
 * 1. "General" tier is an Open / Campus-Wide tier ("All Eligible Students") where ANY enrolled
 *    participant from any academic category (Sub Junior, Junior, Senior) is eligible.
 * 2. For specific categories (Sub Junior, Junior, Senior), participants must match the category
 *    either by direct categoryId, normalized categoryName ("Senior" === "Senior"), or standard aliases.
 */
export function isParticipantEligibleForCategory(
  participant: Participant,
  targetCategory: Category | undefined,
  allCategories?: Category[]
): boolean {
  if (!targetCategory) return true;

  // 1. General tier is open to ALL students across the institution / campus
  const isGeneralTier =
    targetCategory.code?.toUpperCase() === 'CAT-GEN' ||
    targetCategory.code?.toUpperCase() === 'GEN' ||
    targetCategory.name?.trim().toLowerCase() === 'general' ||
    targetCategory.name?.trim().toLowerCase().includes('general') ||
    targetCategory.id?.toLowerCase() === 'cat-4' ||
    targetCategory.id?.toLowerCase() === 'cat-gen' ||
    targetCategory.id?.toLowerCase().includes('gen') ||
    targetCategory.eligibility?.toLowerCase().includes('all') ||
    targetCategory.classRange?.toLowerCase().includes('campus');

  if (isGeneralTier) {
    return true;
  }

  // 2. Direct ID match
  if (participant.categoryId && participant.categoryId === targetCategory.id) {
    return true;
  }

  // 3. Name normalization match (e.g. "Senior" === "Senior")
  const partName = participant.categoryName?.trim().toLowerCase();
  const targetName = targetCategory.name?.trim().toLowerCase();
  if (partName && targetName && partName === targetName) {
    return true;
  }

  // 4. Resolve participant's category from allCategories if participant has categoryId
  if (allCategories && participant.categoryId) {
    const partCat = allCategories.find(c => c.id === participant.categoryId);
    if (partCat) {
      if (partCat.name?.trim().toLowerCase() === targetName) return true;
      if (partCat.code && targetCategory.code && partCat.code.toUpperCase() === targetCategory.code.toUpperCase()) return true;
    }
  }

  // 5. Standard tier code and name aliases
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
