import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE as deleteCompetitionHandler } from '../competitions/[id]/route';
import { POST as cleanupOrphanedHandler } from '../judge-assignments/cleanup-orphaned/route';
import { DELETE as deleteCategoryHandler } from '../categories/[id]/route';
import { AuthService } from '@/services/authService';

vi.mock('@/services/authService', () => ({
  AuthService: {
    assertAdmin: vi.fn()
  }
}));

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: vi.fn().mockReturnValue({
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
        delete: vi.fn().mockResolvedValue(true)
      }),
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [], size: 0 })
      }),
      get: vi.fn().mockResolvedValue({ docs: [], size: 0 })
    }),
    batch: vi.fn().mockReturnValue({
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue([])
    })
  })
}));

describe('Admin Endpoints Authentication and Authorization Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. DELETE /api/admin/competitions/[id] rejects unauthorized requests (no token) with 401', async () => {
    const req = new NextRequest('http://localhost/api/admin/competitions/cmp-1', {
      method: 'DELETE'
    });

    const res = await deleteCompetitionHandler(req, { params: Promise.resolve({ id: 'cmp-1' }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('2. POST /api/admin/judge-assignments/cleanup-orphaned rejects unauthorized requests (no token) with 401', async () => {
    const req = new NextRequest('http://localhost/api/admin/judge-assignments/cleanup-orphaned', {
      method: 'POST'
    });

    const res = await cleanupOrphanedHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('3. DELETE /api/admin/categories/[id] rejects unauthorized requests (no token) with 401', async () => {
    const req = new NextRequest('http://localhost/api/admin/categories/cat-1', {
      method: 'DELETE'
    });

    const res = await deleteCategoryHandler(req, { params: Promise.resolve({ id: 'cat-1' }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('4. Rejects non-admin token with 403 Forbidden or authorization failure', async () => {
    vi.mocked(AuthService.assertAdmin).mockRejectedValueOnce(
      new Error('Forbidden: Insufficient privileges. Administrator access required.')
    );

    const req = new NextRequest('http://localhost/api/admin/competitions/cmp-1', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer non-admin-token'
      }
    });

    const res = await deleteCompetitionHandler(req, { params: Promise.resolve({ id: 'cmp-1' }) });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toContain('Forbidden');
  });
});
