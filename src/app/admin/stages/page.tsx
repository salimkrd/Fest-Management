'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Stage } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Edit2, Trash2, MapPin, Users, Radio, Phone, Music, CheckCircle2 } from 'lucide-react';

export default function StagesPage() {
  const { stages, addStage, updateStage, deleteStage } = useFest();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState(500);
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [audioVisualStatus, setAudioVisualStatus] = useState<Stage['audioVisualStatus']>('OPERATIONAL');
  const [currentEvent, setCurrentEvent] = useState('');
  const [nextEvent, setNextEvent] = useState('');
  const [error, setError] = useState('');

  const handleOpenAdd = () => {
    setEditingStage(null);
    setName('');
    setCode('STG-0' + (stages.length + 1));
    setVenue('');
    setCapacity(500);
    setManagerName('');
    setManagerPhone('+91 98472 ');
    setAudioVisualStatus('OPERATIONAL');
    setCurrentEvent('');
    setNextEvent('');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (stage: Stage) => {
    setEditingStage(stage);
    setName(stage.name);
    setCode(stage.code);
    setVenue(stage.venue);
    setCapacity(stage.capacity);
    setManagerName(stage.managerName);
    setManagerPhone(stage.managerPhone);
    setAudioVisualStatus(stage.audioVisualStatus);
    setCurrentEvent(stage.currentEvent || '');
    setNextEvent(stage.nextEvent || '');
    setError('');
    setModalOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !venue) {
      setError('Please provide venue name, code and location.');
      return;
    }

    const stageData = {
      name,
      code: code.toUpperCase(),
      venue,
      capacity: Number(capacity),
      managerName,
      managerPhone,
      audioVisualStatus,
      currentEvent,
      nextEvent
    };

    setSaving(true);
    try {
      if (editingStage) {
        await updateStage(editingStage.id, stageData);
      } else {
        await addStage(stageData);
      }
      setModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save stage.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove stage venue "${name}"?`)) {
      try {
        await deleteStage(id);
      } catch (err: any) {
        alert(err?.message || 'Failed to delete stage.');
      }
    }
  };

  const getAudioBadge = (st: Stage['audioVisualStatus']) => {
    switch (st) {
      case 'OPERATIONAL':
        return <Badge variant="success" size="sm" dot>A/V OPERATIONAL</Badge>;
      case 'STANDBY':
        return <Badge variant="warning" size="sm" dot>STANDBY</Badge>;
      case 'MAINTENANCE':
      default:
        return <Badge variant="error" size="sm" dot>MAINTENANCE</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Stage Management &amp; Venue Operations
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Active physical stages, sound setup status, seating capacities, and stage manager coordination
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Add Stage Venue
          </Button>
        </div>

        {/* Stage Venues Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stages.map((stg) => (
            <div
              key={stg.id}
              className="bg-white rounded-xl border border-[#E1E7EF] p-6 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#2563EB] flex items-center justify-center font-bold text-sm">
                      {stg.code}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#111111]">{stg.name}</h3>
                      <p className="text-xs text-[#526070] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" /> {stg.venue}
                      </p>
                    </div>
                  </div>
                  {getAudioBadge(stg.audioVisualStatus)}
                </div>

                {/* Stage Context: Live & Next */}
                <div className="mt-5 space-y-2.5">
                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E1E7EF]">
                    <div className="flex items-center justify-between text-[11px] text-[#526070]">
                      <span className="font-bold uppercase tracking-wider text-[#2563EB]">Current Stage Contest</span>
                      <span className="flex items-center gap-1 font-semibold text-red-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" /> LIVE
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-[#111111]">
                      {stg.currentEvent || 'No contest currently on stage'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E1E7EF]">
                    <div className="flex items-center justify-between text-[11px] text-[#526070]">
                      <span className="font-bold uppercase tracking-wider">Up Next On Schedule</span>
                      <span className="text-[10px] font-semibold">LINEUP</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#111111]">
                      {stg.nextEvent || 'Awaiting schedule queue'}
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs border-t border-[#E1E7EF] pt-4">
                  <div>
                    <span className="text-[#526070] font-medium block">Seating Capacity</span>
                    <span className="font-bold text-[#111111]">{stg.capacity} Spectators</span>
                  </div>
                  <div>
                    <span className="text-[#526070] font-medium block">Stage Manager</span>
                    <span className="font-bold text-[#111111]">{stg.managerName}</span>
                    <span className="text-[11px] text-[#526070] block">{stg.managerPhone}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-[#E1E7EF] flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => handleOpenEdit(stg)}
                >
                  Edit Venue
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#DC2626] hover:bg-red-50"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => handleDelete(stg.id, stg.name)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Add/Edit Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingStage ? `Edit Venue (${editingStage.name})` : 'Add New Stage Venue'}
          description="Define physical stage venue parameters, acoustic equipment status and coordinator contact"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave}>
                {editingStage ? 'Update Venue' : 'Save Venue'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <p className="text-xs text-[#DC2626] font-semibold">{error}</p>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  label="Stage Venue Title"
                  placeholder="e.g. Main Auditorium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <Input
                label="Code"
                placeholder="STG-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>

            <Input
              label="Campus Location / Building"
              placeholder="e.g. Central Academic Block Floor 1"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Audience Capacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
              <Select
                label="Audio / Visual Status"
                value={audioVisualStatus}
                onChange={(e) => setAudioVisualStatus(e.target.value as any)}
                options={[
                  { value: 'OPERATIONAL', label: 'Operational (Ready)' },
                  { value: 'STANDBY', label: 'Standby (Pre-check)' },
                  { value: 'MAINTENANCE', label: 'Maintenance (Offline)' }
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Stage Manager Name"
                placeholder="Dr. Tariq Jamil"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
              <Input
                label="Manager Phone"
                placeholder="+91 98472 00000"
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
              />
            </div>

            <Input
              label="Current Ongoing Event (Optional)"
              placeholder="e.g. Extempore Speech (English)"
              value={currentEvent}
              onChange={(e) => setCurrentEvent(e.target.value)}
            />

            <Input
              label="Next Scheduled Event (Optional)"
              placeholder="e.g. Classical Recitation"
              value={nextEvent}
              onChange={(e) => setNextEvent(e.target.value)}
            />
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
