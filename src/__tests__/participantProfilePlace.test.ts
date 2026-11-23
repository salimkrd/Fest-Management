import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getParticipantSessionMock, updateMock } = vi.hoisted(() => ({
  getParticipantSessionMock: vi.fn(),
  updateMock: vi.fn()
}));

vi.mock('@/services/participantPortalAuth', () => ({
  getParticipantSession: getParticipantSessionMock
}));

import { PATCH } from '@/app/api/participant/profile/route';

const request = (
  body: unknown,
  requestOrigin = 'https://inspirath.example',
  headerOrigin = requestOrigin
) => new NextRequest(
  requestOrigin + '/api/participant/profile',
  {
    method: 'PATCH',
    headers: { origin: headerOrigin, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }
);

describe('Participant self-service Place profile field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getParticipantSessionMock.mockResolvedValue({
      id: 'part-current-user',
      db: {
        collection: (name: string) => ({
          doc: (id: string) => ({
            update: (data: Record<string, unknown>) => {
              if (name !== 'participants' || id !== 'part-current-user') {
                throw new Error("Participant update escaped the authenticated user record.");
              }
              return updateMock(data);
            }
          })
        })
      }
    });
    updateMock.mockResolvedValue(undefined);
  });

  afterEach(() => vi.clearAllMocks());

  it('saves a trimmed Place only to the authenticated participant record', async () => {
    const response = await PATCH(request({ place: '  Pattambi  ' }));
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      place: 'Pattambi',
      profileUpdatedBy: 'PARTICIPANT'
    }));
  });

  it('accepts an empty Place to let the participant clear it', async () => {
    const response = await PATCH(request({ place: '   ' }));
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ place: '' }));
  });

  it('rejects Place values longer than 100 characters', async () => {
    const response = await PATCH(request({ place: 'P'.repeat(101) }));
    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects attempts to edit protected participant fields', async () => {
    const response = await PATCH(request({ place: 'Pattambi', teamId: 'another-team' }));
    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("requires the participant own authenticated session", async () => {
    getParticipantSessionMock.mockResolvedValueOnce(null);
    const response = await PATCH(request({ place: 'Pattambi' }));
    expect(response.status).toBe(401);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects cross-origin profile updates', async () => {
    const response = await PATCH(request({ place: 'Pattambi' }, 'https://inspirath.example', 'https://attacker.example'));
    expect(response.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
