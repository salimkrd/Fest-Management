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

  // General/open eligibility must be derived from category identity. Do not
  // treat descriptive fields (eligibility or classRange) as evidence that every
  // participant belongs to the category; broad metadata on a specific tier,
  // such as Senior, must not bypass category isolation.
  const isGeneralTier =
    targetCode === 'CAT-GEN' ||
    targetCode === 'GEN' ||
    targetName === 'general' ||
    targetName.includes('general') ||
    normalize(targetCategory.id) === 'cat-4' ||
    normalize(targetCategory.id) === 'cat-gen' ||
    normalize(targetCategory.id).includes('gen');

  if (isGeneralTier) return true;

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
    return sameId || sameCode;
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
