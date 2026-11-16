import { redirect } from 'next/navigation';

/**
 * The standalone public poster gallery has been retired.
 * Result-specific poster downloads remain available from published result pages.
 * Redirect existing bookmarks and shared links to the public results directory.
 */
export default function PublicPostersRedirect(): never {
  redirect('/public/directory');
}
