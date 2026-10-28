import type { Category, Participant } from '@/types/fest';

const normalize = (value: string | undefined): string => (value || '').trim().toLocaleLowerCase();

/**
 * Determines if a participant belongs to the selected registration category.
 *
 * A General/open tier is intentionally available to all participants. For every
 * other tier, a non-empty participant category name is treated as an explicit
 * category assignment and must not be overridden by a legacy ID alias. This
 * prevents records such as { categoryId: "cat-3", categoryName: "Test CAT 26" }
 * from being incorrectly accepted as Senior just because "cat-3" is a legacy
 * Senior identifier.
 */
export function isParticipantEligibleForCategory(
  participant: Participant,
  targetCategory: Category | undefined,
  allCategories?: Category[]
): boolean {
  if (!targetCategory) return false;

  const targetName = normalize(targetCategory.name);
  const targetCode = normalize(targetCategory.code).toUpperCase();

  const isGeneralTier =
    targetCode === 'CAT-GEN' ||
    targetCode === 'GEN' ||
    targetName === 'general' ||
    targetName.includes('general') ||
    normalize(targetCategory.id) === 'cat-4' ||
    normalize(targetCategory.id) === 'cat-gen' ||
    normalize(targetCategory.id).includes('gen') ||
    normalize(targetCategory.eligibility).includes('all') ||
    normalize(targetCategory.classRange).includes('campus');

  if (isGeneralTier) return true;

  const participantName = normalize(participant.categoryName);
  const participantId = (participant.categoryId || '').trim();

  // If the stored display name explicitly belongs to another category, never
  // let the legacy category-ID aliases silently override that assignment.
  if (participantName && targetName && participantName !== targetName) {
    return false;
  }

  // Prefer a real category record when one exists. This avoids treating
  // unrelated custom category IDs as equivalent just because names/aliases
  // happen to overlap.
  const participantCategory = participantId
    ? allCategories?.find(category => category.id === participantId)
    : undefined;

  if (participantCategory) {
    const sameId = participantCategory.id === targetCategory.id;
    const participantCode = normalize(participantCategory.code).toUpperCase();
    const sameCode = Boolean(participantCode && targetCode && participantCode === targetCode);
    return sameId || sameCode;
  }

  // Legacy records can have IDs such as cat-3 while the current category uses
  // cat-sr. Use an explicit participant category name for those unresolved IDs.
  if (participantName && targetName) {
    return participantName === targetName;
  }

  // Older records without a categoryName can still use known legacy identifiers.
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
