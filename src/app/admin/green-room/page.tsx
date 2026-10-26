'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { db, auth } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { GreenRoomScanner } from '@/components/domain/GreenRoomScanner';
import { GreenRoomCodeSlip } from '@/components/domain/GreenRoomCodeSlip';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { FirestoreGreenRoomAssignment, GreenRoomContestantStatus } from '@/types/firestore';
import {
  DoorOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Edit2,
  Clock,
  UserCheck,
  UserX,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  ShieldCheck,
  Plus
} from 'lucide-react';

export default function GreenRoomPage() {
  const { competitions, registrations } = useFest();

  const [selectedCompId, setSelectedCompId] = useState<string>('');
  const [roster, setRoster] = useState<FirestoreGreenRoomAssignment[]>([]);
  const [loadingRoster, setLoadingRoster] = useState<boolean>(false);
  const [canProvisionStaff, setCanProvisionStaff] = useState(false);

  // Manual search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [isCheckingIn, setIsCheckingIn] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [slipModalOpen, setSlipModalOpen] = useState<boolean>(false);
  const [selectedAssignmentForSlip, setSelectedAssignmentForSlip] = useState<FirestoreGreenRoomAssignment | null>(null);

  const [reassignModalOpen, setReassignModalOpen] = useState<boolean>(false);
  const [reassignTarget, setReassignTarget] = useState<FirestoreGreenRoomAssignment | null>(null);
  const [newCodeInput, setNewCodeInput] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState<boolean>(false);

  const [provisionStaffModalOpen, setProvisionStaffModalOpen] = useState<boolean>(false);
  const [staffEmail, setStaffEmail] = useState<string>('');
  const [staffDisplayName, setStaffDisplayName] = useState<string>('');
  const [staffPassword, setStaffPassword] = useState<string>('');
  const [isProvisioningStaff, setIsProvisioningStaff] = useState<boolean>(false);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Restrict staff provisioning UI to Chief Administrator. The API separately
  // enforces this permission using authoritative Firestore role validation.
  useEffect(() => {
    if (!auth) return;
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        if (active) setCanProvisionStaff(false);
        return;
      }
      try {
        const token = await user.getIdTokenResult();
        if (active) setCanProvisionStaff(token.claims.role === 'ADMIN');
      } catch {
        if (active) setCanProvisionStaff(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  // Keep the selected competition valid after live Firestore updates/deletions.
  useEffect(() => {
    if (!competitions.length) {
      if (selectedCompId) setSelectedCompId('');
      return;
    }
    if (!competitions.some(comp => comp.id === selectedCompId)) {
      setSelectedCompId(competitions[0].id);
    }
  }, [competitions, selectedCompId]);

  const selectedCompetition = useMemo(() => {
    return competitions.find(c => c.id === selectedCompId) || competitions[0] || null;
  }, [competitions, selectedCompId]);

  // Approved registrations for current competition
  const currentCompRegistrations = useMemo(() => {
    if (!selectedCompetition) return [];
    return registrations.filter(r => r.competitionId === selectedCompetition.id && r.status === 'APPROVED');
  }, [registrations, selectedCompetition]);

  // Realtime subscription to greenRoomAssignments for selected competition
  useEffect(() => {
    if (!selectedCompId || !db) return;

    setLoadingRoster(true);
    setRoster([]);
    const q = query(
      collection(db, 'greenRoomAssignments'),
      where('competitionId', '==', selectedCompId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(doc => doc.data() as FirestoreGreenRoomAssignment);
        items.sort((a, b) => (a.codeIndex ?? 0) - (b.codeIndex ?? 0));
        setRoster(items);
        setLoadingRoster(false);
      },
      (error) => {
        console.warn('[GreenRoomPage] onSnapshot error:', error);
        setRoster([]);
        setLoadingRoster(false);
        setFeedbackMessage({ type: 'error', text: `Could not load the Green Room lineup: ${error.message}` });
      }
    );

    return () => unsubscribe();
  }, [selectedCompId]);

  // Candidate matches for manual search
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !selectedCompetition) return [];

    return currentCompRegistrations.filter(r => {
      const matchName = (r.participantName || '').toLowerCase().includes(q);
      const matchChest = (r.chestNumber || '').toLowerCase().includes(q);
      const matchCode = (r.code || '').toLowerCase().includes(q);
      const matchTeam = (r.teamName || '').toLowerCase().includes(q) || (r.teamCode || '').toLowerCase().includes(q);
      return matchName || matchChest || matchCode || matchTeam;
    }).slice(0, 5);
  }, [searchQuery, currentCompRegistrations, selectedCompetition]);

  // Helper to get auth ID token
  const getIdToken = async (): Promise<string> => {
    if (!auth?.currentUser) throw new Error('Not authenticated.');
    return auth.currentUser.getIdToken();
  };

  // Perform check-in via API
  const handlePerformCheckIn = async (
    identifier: string,
    manualCode?: string,
    method: 'QR_SCAN' | 'MANUAL_LOOKUP' = 'MANUAL_LOOKUP'
  ) => {
    if (!selectedCompetition) return;
    setIsCheckingIn(true);
    setFeedbackMessage(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/green-room/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          competitionId: selectedCompetition.id,
          participantIdentifier: identifier,
          checkInMethod: method,
          manualCodeLetter: manualCode || undefined
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to check in contestant.');
      }

      const isQrVerified = data.qrVerified === true;
      const successText = isQrVerified
        ? `QR Verified: Code Letter ${data.assignment?.codeLetter} Assigned to ${data.assignment?.participantName || 'Contestant'}`
        : (data.message || `Code Letter ${data.assignment?.codeLetter} Assigned!`);

      setFeedbackMessage({
        type: 'success',
        text: successText
      });

      setSearchQuery('');
      setManualCodeInput('');

      // Auto-open print slip
      if (data.assignment) {
        setSelectedAssignmentForSlip(data.assignment);
        setSlipModalOpen(true);
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Check-in failed.'
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Status transition handler
  const handleUpdateStatus = async (registrationId: string, newStatus: GreenRoomContestantStatus) => {
    if (!selectedCompetition) return;
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/green-room/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          competitionId: selectedCompetition.id,
          registrationId,
          status: newStatus
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Status update failed.');
    } catch (err: any) {
      alert(`Could not update contestant status: ${err?.message}`);
    }
  };

  // Reassignment handler
  const handleReassignSubmit = async () => {
    if (!selectedCompetition || !reassignTarget) return;
    setIsReassigning(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/green-room/reassign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          competitionId: selectedCompetition.id,
          registrationId: reassignTarget.registrationId,
          newCodeLetter: newCodeInput.trim().toUpperCase(),
          reason: reassignReason.trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Reassignment failed.');

      setReassignModalOpen(false);
      setReassignTarget(null);
      setNewCodeInput('');
      setReassignReason('');

      setFeedbackMessage({
        type: 'success',
        text: `Successfully reassigned to Code Letter ${data.assignment?.codeLetter}`
      });
    } catch (err: any) {
      alert(`Reassignment failed: ${err?.message}`);
    } finally {
      setIsReassigning(false);
    }
  };

  // Staff provisioning handler
  const handleProvisionStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProvisioningStaff(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/green-room/provision-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: staffEmail.trim(),
          password: staffPassword,
          displayName: staffDisplayName.trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Staff provisioning failed.');

      alert(`Green Room Staff account provisioned successfully for ${staffEmail}!`);
      setProvisionStaffModalOpen(false);
      setStaffEmail('');
      setStaffDisplayName('');
      setStaffPassword('');
    } catch (err: any) {
      alert(`Error provisioning staff: ${err?.message}`);
    } finally {
      setIsProvisioningStaff(false);
    }
  };

  // Stats calculation
  const totalEnrolled = currentCompRegistrations.length;
  const checkedInCount = roster.length;
  const awaitingCount = Math.max(0, totalEnrolled - checkedInCount);
  const onStageCount = roster.filter(r => r.status === 'ON_STAGE').length;
  const completedCount = roster.filter(r => r.status === 'COMPLETED').length;

  const filteredRoster = useMemo(() => {
    if (statusFilter === 'ALL') return roster;
    return roster.filter(r => r.status === statusFilter);
  }, [roster, statusFilter]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header & Competition Selector */}
        <div className="bg-white rounded-2xl border border-[#E1E7EF] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-200 flex items-center justify-center font-bold">
              <DoorOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-[#111111]">Green Room Management</h1>
                <Badge variant="blue" size="sm">
                  Live Stage Desk
                </Badge>
              </div>
              <p className="text-xs text-[#526070] mt-0.5">
                Accreditation, camera QR check-in, anonymous Code Letter assignment, and stage lineup.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col text-right">
              <label htmlFor="comp-selector" className="text-[10px] uppercase font-bold text-[#526070] mb-1">
                Active Competition Desk:
              </label>
              <select
                id="comp-selector"
                value={selectedCompId}
                onChange={(e) => setSelectedCompId(e.target.value)}
                className="px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-bold text-[#111111] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]"
              >
                {competitions.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.code} - {comp.name} ({comp.categoryName})
                  </option>
                ))}
              </select>
            </div>

            {canProvisionStaff && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setProvisionStaffModalOpen(true)}
                title="Provision Green Room Staff Account"
              >
                Add Staff
              </Button>
            )}
          </div>
        </div>

        {/* Selected Competition Metadata Bar */}
        {selectedCompetition && (
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 rounded-2xl p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-white/20 rounded backdrop-blur-xs">
                  {selectedCompetition.code}
                </span>
                <h2 className="text-base font-extrabold">{selectedCompetition.name}</h2>
              </div>
              <p className="text-xs text-blue-200 mt-1">
                Category: <strong>{selectedCompetition.categoryName}</strong> · Stage: <strong>{selectedCompetition.stageName}</strong> · Format: <strong>{selectedCompetition.type}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                {selectedCompetition.status}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-blue-100 font-medium">
                {selectedCompetition.type === 'GROUP' ? 'Group entries / team: Unlimited' : `Max ${selectedCompetition.maxEntriesPerTeam} entries / team`}
              </span>
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#526070] block">Enrolled Total</span>
            <span className="text-2xl font-black text-[#111111] mt-1 block">{totalEnrolled}</span>
            <span className="text-[10px] text-[#526070]">Official contestants</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Checked In</span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block">{checkedInCount}</span>
            <span className="text-[10px] text-emerald-600">Codes assigned (A-ZZ)</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-amber-600 block">Awaiting Check-in</span>
            <span className="text-2xl font-black text-amber-700 mt-1 block">{awaitingCount}</span>
            <span className="text-[10px] text-amber-600">Not in green room yet</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-blue-600 block">On Stage</span>
            <span className="text-2xl font-black text-blue-700 mt-1 block">{onStageCount}</span>
            <span className="text-[10px] text-blue-600">Performing right now</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] shadow-xs col-span-2 md:col-span-1">
            <span className="text-[10px] uppercase font-bold text-purple-600 block">Completed</span>
            <span className="text-2xl font-black text-purple-700 mt-1 block">{completedCount}</span>
            <span className="text-[10px] text-purple-600">Performance sealed</span>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            role="alert"
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold animate-fade-in ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-xs opacity-60 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Work Area: Left Scanner & Search, Right Roster Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Scanner & Search (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Camera QR Scanner */}
            <GreenRoomScanner
              onScanSuccess={(code) => handlePerformCheckIn(code, undefined, 'QR_SCAN')}
              isProcessing={isCheckingIn}
            />

            {/* Manual Search & Check-in Card */}
            <div className="bg-white rounded-2xl border border-[#E1E7EF] p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E1E7EF]">
                <Search className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-bold text-[#111111]">Manual Participant Lookup</h3>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Input
                    label="Search Contestant or Group"
                    placeholder="Search by Name, Bib #, Chest #, or Team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  {/* Autocomplete dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#CBD5E1] rounded-xl shadow-lg z-30 overflow-hidden divide-y divide-[#E1E7EF]">
                      {searchResults.map((reg) => {
                        const isAssigned = roster.some(r => r.registrationId === reg.id);
                        return (
                          <div
                            key={reg.id}
                            onClick={() => {
                              handlePerformCheckIn(reg.id, manualCodeInput, 'MANUAL_LOOKUP');
                            }}
                            className="p-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#111111]">{reg.participantName}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-[#526070]">
                                  {reg.chestNumber || reg.code}
                                </span>
                              </div>
                              <span className="text-[11px] text-[#526070]">{reg.teamName} ({reg.teamCode})</span>
                            </div>

                            <div>
                              {isAssigned ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Already Assigned
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#2563EB] border border-blue-200">
                                  Check In &rarr;
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-1/2">
                    <Input
                      label="Manual Code Letter (Optional)"
                      placeholder="e.g. D (Auto if empty)"
                      value={manualCodeInput}
                      onChange={(e) => setManualCodeInput(e.target.value.toUpperCase())}
                      maxLength={2}
                    />
                  </div>

                  <div className="w-1/2 flex items-end">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      disabled={isCheckingIn || !searchQuery.trim()}
                      onClick={() => handlePerformCheckIn(searchQuery, manualCodeInput, 'MANUAL_LOOKUP')}
                    >
                      Check In
                    </Button>
                  </div>
                </div>

                {searchQuery.trim() && searchResults.length === 0 && (
                  <p className="text-xs text-amber-700" role="status">
                    No approved registrations match this competition. Verify competition selection, registration status and participant code.
                  </p>
                )}

                <p className="text-[11px] text-[#526070]">
                  Leave manual code empty to randomly assign one unused letter within the approved competition roster (3 entries: A-C; 5 entries: A-E). Codes cannot repeat.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Checked-In Roster Queue (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-[#E1E7EF] p-5 shadow-xs">
              {/* Table Header & Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E1E7EF]">
                <div>
                  <h3 className="text-base font-extrabold text-[#111111]">Stage Entry Lineup</h3>
                  <p className="text-xs text-[#526070] mt-0.5">
                    {roster.length} contestants checked into green room
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#111111]"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="CHECKED_IN">Waiting (Checked In)</option>
                    <option value="ON_STAGE">On Stage</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ABSENT">Absent / Disqualified</option>
                  </select>
                </div>
              </div>

              {/* Contestants Table */}
              <div className="mt-4 overflow-x-auto">
                {loadingRoster ? (
                  <div className="py-12 text-center text-xs text-[#526070]">
                    <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Synchronizing Green Room Queue...
                  </div>
                ) : filteredRoster.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#526070] bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                    <DoorOpen className="w-8 h-8 text-[#526070] mx-auto mb-2 opacity-50" />
                    <p className="font-bold text-[#111111]">No contestants in green room yet</p>
                    <p className="text-[11px] mt-0.5">
                      Scan QR badges or use manual search on the left to check in contestants.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E1E7EF] text-[10px] uppercase font-bold text-[#526070] tracking-wider">
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Contestant / Team</th>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Stage Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E7EF]">
                      {filteredRoster.map((item) => {
                        const statusColors: Record<GreenRoomContestantStatus, string> = {
                          CHECKED_IN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          ON_STAGE: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse',
                          COMPLETED: 'bg-neutral-100 text-neutral-600 border-neutral-200',
                          ABSENT: 'bg-red-50 text-red-700 border-red-200'
                        };

                        return (
                          <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors">
                            {/* Code Letter Badge */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center font-mono font-black text-lg shadow-xs">
                                  {item.codeLetter}
                                </div>
                                <span className="text-[10px] text-[#526070] font-semibold">
                                  #{item.codeIndex + 1}
                                </span>
                              </div>
                            </td>

                            {/* Contestant & Team */}
                            <td className="py-3 px-3">
                              <div className="font-extrabold text-[#111111]">{item.participantName}</div>
                              <div className="text-[11px] text-[#526070] flex items-center gap-1.5 mt-0.5">
                                <span>{item.teamName} ({item.teamCode})</span>
                                <span>·</span>
                                <span className="font-mono text-[10px]">
                                  {item.chestNumber ? `#${item.chestNumber}` : item.registrationCode}
                                </span>
                              </div>
                            </td>

                            {/* Check-In Timestamp */}
                            <td className="py-3 px-3 text-[#526070] font-mono text-[11px]">
                              {new Date(item.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            {/* Status Selector */}
                            <td className="py-3 px-3">
                              <select
                                value={item.status}
                                onChange={(e) => handleUpdateStatus(item.registrationId, e.target.value as GreenRoomContestantStatus)}
                                className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-hidden ${statusColors[item.status]}`}
                              >
                                <option value="CHECKED_IN">Waiting (Checked In)</option>
                                <option value="ON_STAGE">On Stage</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="ABSENT">Absent</option>
                              </select>
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAssignmentForSlip(item);
                                    setSlipModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg border border-[#E1E7EF] bg-white text-[#526070] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                                  title="Print Anonymous Code Slip"
                                  aria-label="Print Anonymous Code Slip"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setReassignTarget(item);
                                    setNewCodeInput('');
                                    setReassignReason('');
                                    setReassignModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg border border-[#E1E7EF] bg-white text-[#526070] hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                  title="Reassign Code Letter"
                                  aria-label="Reassign Code Letter"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal 1: Code Slip Modal */}
        <GreenRoomCodeSlip
          isOpen={slipModalOpen}
          onClose={() => setSlipModalOpen(false)}
          assignment={selectedAssignmentForSlip}
        />

        {/* Modal 2: Reassignment Modal */}
        <Modal
          isOpen={reassignModalOpen}
          onClose={() => setReassignModalOpen(false)}
          title={`Reassign Code Letter (${reassignTarget?.participantName})`}
          description={`Current Code Letter: ${reassignTarget?.codeLetter}. Enter new unoccupied Code Letter and audit reason.`}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setReassignModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isReassigning || !newCodeInput.trim() || reassignReason.trim().length < 5}
                onClick={handleReassignSubmit}
              >
                {isReassigning ? 'Reassigning...' : 'Confirm Reassignment'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-2">
            <Input
              label="New Code Letter (A-Z, AA-ZZ)"
              placeholder="e.g. E"
              value={newCodeInput}
              onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
              maxLength={2}
            />

            <div>
              <label className="text-xs font-bold text-[#111111] block mb-1">
                Mandatory Reason for Reassignment:
              </label>
              <textarea
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="Explain why this code is being changed (e.g. Misplaced slip, Stage manager request, Entry swap)..."
                rows={3}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#111111] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]"
              />
              <span className="text-[10px] text-[#526070] mt-0.5 block">
                Minimum 5 characters. This action is permanently logged to the audit trail.
              </span>
            </div>
          </div>
        </Modal>

        {/* Modal 3: Chief Admin Staff Provisioning Modal */}
        <Modal
          isOpen={provisionStaffModalOpen}
          onClose={() => setProvisionStaffModalOpen(false)}
          title="Provision Green Room Staff Account"
          description="Create a scoped GREEN_ROOM_STAFF credential restricted strictly to Green Room operations."
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setProvisionStaffModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isProvisioningStaff || !staffEmail.trim() || !staffPassword || !staffDisplayName.trim()}
                onClick={handleProvisionStaff}
              >
                {isProvisioningStaff ? 'Provisioning...' : 'Provision Staff'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleProvisionStaff} className="space-y-3 py-2">
            <Input
              label="Staff Display Name"
              placeholder="e.g. Backstage Coordinator 1"
              value={staffDisplayName}
              onChange={(e) => setStaffDisplayName(e.target.value)}
              required
            />
            <Input
              label="Staff Email Address"
              type="email"
              placeholder="greenroom@sahithyolsav.com"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              required
            />
            <Input
              label="Temporary Password"
              type="password"
              placeholder="Minimum 8 characters"
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
              required
            />
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-tight">
              <strong>Role Scoping:</strong> This account receives the <code>GREEN_ROOM_STAFF</code> custom claim. They have access to QR scanning and code assignment, but are strictly prohibited from editing results, reading judge scorecards, or managing admin settings.
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
