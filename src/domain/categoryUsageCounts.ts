import type { Category, Competition, Participant } from '@/types/fest';

export interface CategoryUsageCounts {
  participants: number;
  competitions: number;
}

/**
 * Counts records assigned to each category from the live source collections.
 *
 * The category document's enrolledCount/competitionsCount fields are legacy
 * cached counters and are not reliably maintained by every write path. Source
 * documents are authoritative: each participant is counted once by category,
 * and each competition is counted once by its assigned category.
 */
export function buildCategoryUsageCounts(
  categories: Category[],
  participants: Participant[],
  competitions: Competition[]
): Map<string, CategoryUsageCounts> {
  const counts = new Map<string, CategoryUsageCounts>();

  for (const category of categories) {
    const normalizedName = category.name.trim().toLocaleLowerCase();
    const normalizedCode = category.code.trim().toLocaleLowerCase();

    const enrolledParticipants = participants.filter(participant => {
      const assignedCategoryId = participant.categoryId?.trim();
      if (assignedCategoryId) return assignedCategoryId === category.id;

      const assignedCategoryName = participant.categoryName?.trim().toLocaleLowerCase();
      if (assignedCategoryName) return assignedCategoryName === normalizedName;

      // Compatibility for older participant records that stored the tier in
      // classGrade but did not persist categoryId/categoryName.
      const legacyTier = participant.classGrade?.trim().toLocaleLowerCase();
      return Boolean(legacyTier && (legacyTier === normalizedName || legacyTier === normalizedCode));
    }).length;

    const assignedCompetitions = competitions.filter(competition => {
      const assignedCategoryId = competition.categoryId?.trim();
      if (assignedCategoryId) return assignedCategoryId === category.id;

      // Older competition records may contain the category name only.
      return competition.categoryName.trim().toLocaleLowerCase() === normalizedName;
    }).length;

    counts.set(category.id, {
      participants: enrolledParticipants,
      competitions: assignedCompetitions
    });
  }

  return counts;
}
