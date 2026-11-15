import { auth } from '@/lib/firebase/client';

export async function uploadParticipantPhoto(
  participantId: string,
  file: File,
  authMode: 'firebase' | 'participant' = 'firebase'
): Promise<string> {
  if (!participantId) throw new Error('Participant ID is required.');
  const form = new FormData();
  form.append('photo', file);

  const headers: Record<string, string> = {};
  if (authMode === 'firebase') {
    const user = auth?.currentUser;
    if (!user) throw new Error('Please sign in again before uploading a photo.');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  const response = await fetch(`/api/participants/${encodeURIComponent(participantId)}/photo`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers,
    body: form
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.photoUrl !== 'string' || !payload.photoUrl) {
    throw new Error(payload.error || 'Photo upload failed.');
  }
  return payload.photoUrl;
}
