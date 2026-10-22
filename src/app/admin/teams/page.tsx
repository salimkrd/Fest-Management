'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Team } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Plus,
  Search,
  Edit2,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  UserPlus,
  ShieldAlert,
  Send,
  MessageSquare,
  ExternalLink,
  Ban,
  CheckCheck
} from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';

export default function TeamsPage() {
  const { teams, updateTeam } = useFest();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [invitationModalOpen, setInvitationModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Form State for Add / Edit
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState('#2563EB');
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [zone, setZone] = useState('');

  // Replace Manager Form State
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerPhone, setNewManagerPhone] = useState('');

  // WhatsApp Invitation Modal State
  const [invitationTeamId, setInvitationTeamId] = useState('');
  const [invitationTeamName, setInvitationTeamName] = useState('');
  const [invitationManagerEmail, setInvitationManagerEmail] = useState('');
  const [invitationManagerPhone, setInvitationManagerPhone] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [invitationMessage, setInvitationMessage] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [invitationStatus, setInvitationStatus] = useState<string>('READY_TO_SEND');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [markSentLoading, setMarkSentLoading] = useState(false);

  // Status & Loading State
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Dynamic server-synced teams list
  const [dynamicTeams, setDynamicTeams] = useState<Team[]>(teams);

  // Helper to ensure Firebase Auth initialization completes
  const waitForAuthReady = async (): Promise<any> => {
    if (!auth) return null;
    if (auth.currentUser) return auth.currentUser;
    if (typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
      return auth.currentUser;
    }
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth!, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  };

  const getAdminToken = async (): Promise<string> => {
    if (!auth) {
      throw new Error('Authentication service unavailable. Please check your network connection.');
    }

    const user = await waitForAuthReady();
    if (!user) {
      throw new Error('Unauthorized: You must be signed in as Chief Administrator to perform this action.');
    }

    try {
      const token = await user.getIdToken();
      if (!token || typeof token !== 'string') {
        throw new Error('Unauthorized: Invalid or empty ID token received.');
      }
      return token;
    } catch (tokenErr: any) {
      if (tokenErr.code === 'auth/user-token-expired' || tokenErr.code === 'auth/user-disabled') {
        throw new Error('Unauthorized: Your session has expired. Please log in again.');
      }
      throw new Error('Unauthorized: Authentication token retrieval failed.');
    }
  };

  // Sync initial teams or fetch from backend
  const refreshTeams = async () => {
    try {
      let token = '';
      try {
        token = await getAdminToken();
      } catch {
        // If unauthenticated during initial background refresh, fetch without token or use state
      }
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/admin/teams', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.teams) && data.teams.length > 0) {
          const merged: Team[] = data.teams.map((dt: any, idx: number) => {
            const existing = teams.find(t => t.id === dt.id);
            return {
              id: dt.id,
              name: dt.name,
              code: dt.code,
              color: dt.color || '#2563EB',
              managerName: dt.managerName || '',
              managerEmail: dt.managerEmail || '',
              managerPhone: dt.managerPhone || '',
              zone: dt.zone || '',
              contestantsCount: existing?.contestantsCount || 0,
              eventsCount: existing?.eventsCount || 0,
              totalPoints: existing?.totalPoints || 0,
              soloPoints: existing?.soloPoints || 0,
              groupPoints: existing?.groupPoints || 0,
              rank: existing?.rank || idx + 1,
              firstCount: existing?.firstCount || 0,
              secondCount: existing?.secondCount || 0,
              thirdCount: existing?.thirdCount || 0,
              portalAccess: dt.portalAccess !== false,
              status: dt.status || 'ACTIVE',
              provisioningStatus: dt.provisioningStatus || (dt.managerEmail ? 'PROVISIONED' : 'AWAITING_MANAGER'),
              invitationStatus: dt.invitationStatus || 'PENDING',
              invitationSentAt: dt.invitationSentAt || '',
              invitationExpiresAt: dt.invitationExpiresAt || ''
            };
          });
          setDynamicTeams(merged);
          return;
        }
      }
    } catch (e) {
      console.warn('[TeamsPage] Fetch error:', e);
    }
    setDynamicTeams(teams);
  };

  useEffect(() => {
    refreshTeams();
  }, [teams]);

  const filteredTeams = dynamicTeams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.code.toLowerCase().includes(search.toLowerCase()) ||
    t.managerName.toLowerCase().includes(search.toLowerCase()) ||
    t.managerEmail.toLowerCase().includes(search.toLowerCase()) ||
    t.managerPhone.includes(search)
  );

  const handleOpenAdd = () => {
    setEditingTeam(null);
    setName('');
    setCode('');
    setColor('#2563EB');
    setManagerName('');
    setManagerEmail('');
    setManagerPhone('');
    setZone('');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (t: Team) => {
    setEditingTeam(t);
    setName(t.name);
    setCode(t.code);
    setColor(t.color);
    setManagerName(t.managerName);
    setManagerEmail(t.managerEmail);
    setManagerPhone(t.managerPhone);
    setZone(t.zone);
    setError('');
    setModalOpen(true);
  };

  const handleOpenReplace = (t: Team) => {
    setSelectedTeam(t);
    setNewManagerEmail('');
    setNewManagerName('');
    setNewManagerPhone('');
    setError('');
    setReplaceModalOpen(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide a team name.');
      return;
    }

    if (!editingTeam && (!managerEmail.trim() || !managerPhone.trim())) {
      setError('Both Manager Email and Manager WhatsApp Number are required.');
      return;
    }

    setLoading(true);

    try {
      const token = await getAdminToken();

      if (editingTeam) {
        // Edit existing team
        const res = await fetch(`/api/admin/teams/${editingTeam.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: name.trim(),
            code: code.trim().toUpperCase(),
            color,
            zone: zone.trim(),
            managerName: managerName.trim(),
            managerPhone: managerPhone.trim()
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update team.');
        }

        updateTeam(editingTeam.id, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          color,
          zone: zone.trim(),
          managerName: managerName.trim(),
          managerPhone: managerPhone.trim()
        });

        setSuccessBanner(`Team "${name}" successfully updated.`);
        setModalOpen(false);
        await refreshTeams();
      } else {
        // Create new team with dynamic manager provisioning & WhatsApp invitation
        const res = await fetch('/api/admin/teams', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: name.trim(),
            code: code.trim().toUpperCase() || undefined,
            color,
            zone: zone.trim(),
            managerEmail: managerEmail.trim(),
            managerName: managerName.trim() || undefined,
            managerPhone: managerPhone.trim()
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create team.');
        }

        setModalOpen(false);
        await refreshTeams();

        if (data.invitation) {
          setInvitationTeamId(data.team.id);
          setInvitationTeamName(data.team.name);
          setInvitationManagerEmail(data.team.managerEmail);
          setInvitationManagerPhone(data.team.managerPhone);
          setInvitationCode(data.invitation.code);
          setInvitationMessage(data.invitation.message);
          setWhatsappUrl(data.invitation.whatsappUrl);
          setInvitationStatus('READY_TO_SEND');
          setCopiedCode(false);
          setCopiedMessage(false);
          setInvitationModalOpen(true);
        } else {
          setSuccessBanner(`Team "${data.team.name}" created successfully.`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;

    if (!newManagerEmail.trim() || !newManagerPhone.trim()) {
      setError('Please provide both the new manager email address and WhatsApp number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = await getAdminToken();
      const res = await fetch(`/api/admin/teams/${selectedTeam.id}/replace-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          newManagerEmail: newManagerEmail.trim(),
          newManagerName: newManagerName.trim() || undefined,
          newManagerPhone: newManagerPhone.trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to replace team manager.');
      }

      setReplaceModalOpen(false);
      await refreshTeams();

      if (data.invitation) {
        setInvitationTeamId(data.team.id);
        setInvitationTeamName(data.team.name);
        setInvitationManagerEmail(data.team.managerEmail);
        setInvitationManagerPhone(data.team.managerPhone);
        setInvitationCode(data.invitation.code);
        setInvitationMessage(data.invitation.message);
        setWhatsappUrl(data.invitation.whatsappUrl);
        setInvitationStatus('READY_TO_SEND');
        setCopiedCode(false);
        setCopiedMessage(false);
        setInvitationModalOpen(true);
      }
    } catch (err: any) {
      setError(err.message || 'Replacement failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvitation = async (team: Team) => {
    if (!team.managerEmail || !team.managerPhone) {
      alert('This team requires both an assigned manager email and WhatsApp number to generate an invitation.');
      return;
    }
 
    setActionLoadingId(team.id);
    setError('');

    try {
      const token = await getAdminToken();
      const res = await fetch(`/api/admin/teams/${team.id}/generate-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate invitation.');
      }

      setInvitationTeamId(team.id);
      setInvitationTeamName(team.name);
      setInvitationManagerEmail(data.managerEmail || team.managerEmail);
      setInvitationManagerPhone(data.managerPhone || team.managerPhone);
      setInvitationCode(data.invitationCode);
      setInvitationMessage(data.message);
      setWhatsappUrl(data.whatsappUrl);
      setInvitationStatus('READY_TO_SEND');
      setCopiedCode(false);
      setCopiedMessage(false);
      setInvitationModalOpen(true);
      await refreshTeams();
    } catch (err: any) {
      const msg = err.message || 'Error generating invitation.';
      setError(msg);
      alert(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkSent = async (teamId: string) => {
    setMarkSentLoading(true);
    setError('');
    try {
      const token = await getAdminToken();
      const res = await fetch(`/api/admin/teams/${teamId}/mark-sent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update invitation status.');
      }

      setInvitationStatus('MANUALLY_SENT');
      setSuccessBanner('Invitation marked as manually sent via WhatsApp.');
      await refreshTeams();
    } catch (err: any) {
      const msg = err.message || 'Failed to mark as sent.';
      setError(msg);
      alert(msg);
    } finally {
      setMarkSentLoading(false);
    }
  };

  const handleRevokeInvitation = async (team: Team) => {
    if (!confirm(`Are you sure you want to revoke the active invitation for ${team.name}? The invitation code will become permanently invalid.`)) {
      return;
    }

    setActionLoadingId(team.id);
    setError('');
    try {
      const token = await getAdminToken();
      const res = await fetch(`/api/admin/teams/${team.id}/revoke-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke invitation.');
      }

      setSuccessBanner(`Invitation for ${team.name} has been revoked.`);
      await refreshTeams();
    } catch (err: any) {
      const msg = err.message || 'Failed to revoke invitation.';
      setError(msg);
      alert(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyCode = () => {
    if (invitationCode) {
      navigator.clipboard.writeText(invitationCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCopyMessage = () => {
    if (invitationMessage) {
      navigator.clipboard.writeText(invitationMessage);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    }
  };

  const handleOpenWhatsApp = () => {
    if (whatsappUrl) {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleAccess = async (team: Team) => {
    const isCurrentlyActive = team.portalAccess && (team as any).status !== 'DISABLED';
    const newTarget = !isCurrentlyActive;

    setActionLoadingId(team.id);
    setError('');

    try {
      const token = await getAdminToken();
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'SET_STATUS',
          enabled: newTarget
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle team status.');
      }

      updateTeam(team.id, { portalAccess: newTarget });
      setSuccessBanner(`Team "${team.name}" status updated to ${newTarget ? 'ACTIVE' : 'DISABLED'}.`);
      await refreshTeams();
    } catch (err: any) {
      const msg = err.message || 'Error toggling team status.';
      setError(msg);
      alert(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVATED':
        return <Badge variant="success" size="sm">ACTIVATED</Badge>;
      case 'MANUALLY_SENT':
        return <Badge variant="info" size="sm">MANUALLY SENT</Badge>;
      case 'READY_TO_SEND':
        return <Badge variant="info" size="sm">READY TO SEND</Badge>;
      case 'REVOKED':
        return <Badge variant="error" size="sm">REVOKED</Badge>;
      case 'EXPIRED':
        return <Badge variant="warning" size="sm">EXPIRED</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="default" size="sm">PENDING</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111111] tracking-tight">
              House Contingents &amp; Team Managers
            </h1>
            <p className="text-xs text-[#526070] mt-0.5">
              Dynamic team creation, secure WhatsApp onboarding, and manager session administration.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={refreshTeams}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenAdd}
            >
              Create Team &amp; Provision Manager
            </Button>
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner('')}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Championship Highlights */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#111111] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Championship Leaderboard Highlights
            </h3>
            <span className="text-xs text-[#526070] font-medium">
              {dynamicTeams.length} Registered House Contingents
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dynamicTeams.slice(0, 4).map((team, idx) => (
              <div
                key={team.id}
                className="bg-white rounded-xl border border-[#E1E7EF] p-5 shadow-xs relative overflow-hidden flex flex-col justify-between"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: team.color }}
                />

                <div>
                  <div className="flex items-start justify-between">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-extrabold text-xs shadow-xs"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.code}
                    </div>
                    <span className="text-xs font-extrabold text-[#526070]">
                      #{idx + 1}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-[#111111] mt-3">{team.name}</h4>
                  <p className="text-[11px] text-[#526070] mt-0.5">
                    {team.managerName || 'Pending Manager'} · {team.zone || 'Campus'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E1E7EF] flex items-center justify-between">
                  <div>
                    <span className="text-xl font-black text-[#111111]">{team.totalPoints || 0}</span>
                    <span className="text-[10px] text-[#526070] ml-1 uppercase font-semibold">pts</span>
                  </div>
                  <div className="text-right text-[10px] text-[#526070]">
                    <span>{team.contestantsCount || 0} Contestants</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Directory Table */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E1E7EF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search team name, code, manager, or WhatsApp number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[#E1E7EF] rounded-lg text-xs bg-white text-[#111111] placeholder:text-[#526070] focus:outline-hidden focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-semibold">
                  <th className="py-3 px-6">Contingent</th>
                  <th className="py-3 px-6">Assigned Team Manager</th>
                  <th className="py-3 px-6 text-center">Onboarding Status</th>
                  <th className="py-3 px-6 text-center">Team Access</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#526070]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-6 h-6 text-[#526070]" />
                        <p className="font-medium">No team contingents match your query.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center text-white font-extrabold text-[10px] shrink-0"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.code}
                          </div>
                          <div>
                            <span className="font-bold text-[#111111] block">{t.name}</span>
                            <span className="text-[#526070] text-[11px]">
                              {t.zone || 'Campus Center'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {t.managerEmail ? (
                          <div>
                            <span className="font-semibold text-[#111111] block">
                              {t.managerName || 'Team Manager'}
                            </span>
                            <span className="text-[#526070] text-[11px] font-mono">{t.managerEmail}</span>
                            {t.managerPhone && (
                              <span className="text-[10px] text-emerald-700 font-medium block">
                                WhatsApp: {t.managerPhone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-700 italic text-[11px] font-medium">
                            No manager assigned
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-center">
                        {renderStatusBadge(t.invitationStatus)}
                      </td>

                      <td className="py-4 px-6 text-center">
                        <button
                          type="button"
                          disabled={actionLoadingId === t.id}
                          onClick={() => handleToggleAccess(t)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                            t.portalAccess && (t as any).status !== 'DISABLED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                          }`}
                        >
                          {actionLoadingId === t.id
                            ? 'UPDATING...'
                            : t.portalAccess && (t as any).status !== 'DISABLED'
                            ? 'ACTIVE'
                            : 'DISABLED'}
                        </button>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Generate / View WhatsApp Invitation */}
                          {t.managerEmail && (
                            <button
                              type="button"
                              disabled={actionLoadingId === t.id}
                              onClick={() => handleGenerateInvitation(t)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                              title="Generate / Open WhatsApp Invitation"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}

                          {/* Revoke Invitation */}
                          {t.invitationStatus === 'READY_TO_SEND' && (
                            <button
                              type="button"
                              disabled={actionLoadingId === t.id}
                              onClick={() => handleRevokeInvitation(t)}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                              title="Revoke Invitation Code"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {/* Replace Manager */}
                          <button
                            type="button"
                            onClick={() => handleOpenReplace(t)}
                            className="p-1.5 rounded-lg text-[#526070] hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Replace Assigned Team Manager"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>

                          {/* Edit Team Info */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            className="p-1.5 rounded-lg text-[#526070] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                            title="Edit Team Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create / Edit Team Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingTeam ? 'Edit Contingent Team' : 'Create Team & Provision Manager'}
          description={
            editingTeam
              ? 'Update public identity and contact metadata.'
              : 'Create a unique team and automatically provision a unique Team Manager account.'
          }
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveTeam} isLoading={loading}>
                {editingTeam ? 'Save Changes' : 'Create Team & Generate Invitation'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveTeam} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Team Name *"
                placeholder="e.g. Qurtuba Contingent"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingTeam && !code) {
                    setCode(e.target.value.slice(0, 3).toUpperCase());
                  }
                }}
                required
              />
              <Input
                label="3-Letter Team Code"
                placeholder="e.g. QRT"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={4}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Contingent Theme Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-9 p-0.5 border border-[#E1E7EF] rounded-lg cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[#E1E7EF] rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <Input
                label="Assigned Campus Zone"
                placeholder="e.g. North Zone / Campus Center"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
            </div>

            {!editingTeam && (
              <div className="pt-3 border-t border-[#E1E7EF] space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-[#2563EB]" />
                    <span>Automatic Team Manager Provisioning</span>
                  </h4>
                  <p className="text-[11px] text-[#526070] mt-0.5">
                    Provisions a dedicated Manager identity. You will receive a copyable WhatsApp invitation code.
                  </p>
                </div>

                <div className="space-y-3 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E1E7EF]">
                  <Input
                    label="Manager Login Email *"
                    type="email"
                    placeholder="manager.team@domain.com"
                    value={managerEmail}
                    onChange={(e) => setManagerEmail(e.target.value)}
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Manager Full Name"
                      placeholder="e.g. Ahmad Al-Mansoor"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                    />
                    <Input
                      label="Manager WhatsApp Number *"
                      placeholder="+91 98471 00000"
                      value={managerPhone}
                      onChange={(e) => setManagerPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            )}
          </form>
        </Modal>

        {/* Replace Manager Modal */}
        <Modal
          isOpen={replaceModalOpen}
          onClose={() => setReplaceModalOpen(false)}
          title={`Replace Team Manager: ${selectedTeam?.name}`}
          description="Assign a new manager account. The previous manager's active sessions will be revoked."
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setReplaceModalOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleReplaceManager} isLoading={loading}>
                Confirm Replacement &amp; Provision
              </Button>
            </div>
          }
        >
          <form onSubmit={handleReplaceManager} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Security Notice: Token Revocation</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Currently assigned: <span className="font-semibold">{selectedTeam?.managerEmail || 'None'}</span>.
                Replacing the manager will immediately revoke refresh tokens for the previous user and generate a new WhatsApp invitation for the replacement.
              </p>
            </div>

            <div className="space-y-3">
              <Input
                label="New Manager Email *"
                type="email"
                placeholder="new.manager@domain.com"
                value={newManagerEmail}
                onChange={(e) => setNewManagerEmail(e.target.value)}
                required
              />
              <Input
                label="New Manager Full Name"
                placeholder="e.g. Tariq Ibn Ziyad"
                value={newManagerName}
                onChange={(e) => setNewManagerName(e.target.value)}
              />
              <Input
                label="New Manager WhatsApp Number *"
                placeholder="+91 98471 11111"
                value={newManagerPhone}
                onChange={(e) => setNewManagerPhone(e.target.value)}
                required
              />
            </div>
          </form>
        </Modal>

        {/* Secure WhatsApp Invitation Modal */}
        <Modal
          isOpen={invitationModalOpen}
          onClose={() => setInvitationModalOpen(false)}
          title={`WhatsApp Invitation: ${invitationTeamName}`}
          description="Send this confidential invitation code to the Team Manager through WhatsApp."
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs">
                {invitationStatus === 'MANUALLY_SENT' ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                    <CheckCheck className="w-4 h-4" />
                    <span>Confirmed as Sent</span>
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">
                    Status: {invitationStatus}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {invitationStatus === 'READY_TO_SEND' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkSent(invitationTeamId)}
                    isLoading={markSentLoading}
                  >
                    Mark as Sent
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={() => setInvitationModalOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* One-Time Code Highlight Card */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                  One-Time Invitation Code
                </span>
                <span className="text-[10px] text-blue-700 font-semibold bg-blue-100/60 px-2 py-0.5 rounded-full">
                  Expires in 24 Hours
                </span>
              </div>
              <div className="flex items-center justify-between bg-white border border-blue-200 rounded-lg p-2.5">
                <span className="font-mono text-xl font-black text-blue-700 tracking-wider">
                  {invitationCode}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  leftIcon={copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedCode ? 'Copied' : 'Copy Code'}
                </Button>
              </div>
              <p className="text-[11px] text-slate-600">
                This code is shown only once and stored securely as a cryptographic hash.
              </p>
            </div>

            {/* Formatted WhatsApp Message Preview */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-900">
                Official WhatsApp Invitation Message
              </label>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all max-h-56 overflow-y-auto border border-slate-800">
                {invitationMessage}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Button
                variant="primary"
                size="md"
                className="w-full justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleCopyMessage}
                leftIcon={copiedMessage ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              >
                {copiedMessage ? 'Message Copied!' : 'Copy Invitation Message'}
              </Button>

              <Button
                variant="outline"
                size="md"
                className="w-full justify-center gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                onClick={handleOpenWhatsApp}
                leftIcon={<MessageSquare className="w-4 h-4 text-emerald-600" />}
              >
                <span>Open WhatsApp ({invitationManagerPhone || 'Direct'})</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </Button>
            </div>

            {/* Security Explanation */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Security Guidance for Administrators</span>
              </div>
              <p className="leading-relaxed">
                Click <strong>"Copy Invitation Message"</strong> and paste it directly into WhatsApp with the manager.
                The <strong>"Open WhatsApp"</strong> button strictly opens the recipient&apos;s phone number without transmitting any secret token in URL query parameters.
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
