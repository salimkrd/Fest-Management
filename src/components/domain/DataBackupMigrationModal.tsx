'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  BackupMigrationService,
  DryRunMigrationReport
} from '@/services/backupMigrationService';
import { db } from '@/lib/firebase/client';
import {
  Download,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  FileJson
} from 'lucide-react';

interface DataBackupMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataBackupMigrationModal: React.FC<DataBackupMigrationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<DryRunMigrationReport | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationSuccess, setMigrationSuccess] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleDownloadBackup = () => {
    try {
      const result = BackupMigrationService.downloadLocalBackup();
      setDownloadNotice(`Downloaded ${result.filename} (${(result.sizeBytes / 1024).toFixed(1)} KB) successfully.`);
      setTimeout(() => setDownloadNotice(null), 5000);
    } catch (e: any) {
      setError('Could not export local backup: ' + (e.message || String(e)));
    }
  };

  const handleRunDryRun = async () => {
    if (!db) {
      setError('Firestore client is not available to run dry-run inspection.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    setMigrationSuccess(null);
    try {
      const plan = await BackupMigrationService.planDryRunMigration(db);
      setReport(plan);
    } catch (e: any) {
      setError('Dry-run analysis failed: ' + (e.message || String(e)));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecuteMigration = async () => {
    if (!db || !report) return;
    if (confirmText.trim().toUpperCase() !== 'MIGRATE') {
      setError('Please type MIGRATE in the confirmation field to proceed.');
      return;
    }
    setMigrating(true);
    setError(null);
    try {
      const outcome = await BackupMigrationService.executeApprovedMigration(db, report);
      const totalMigrated = Object.values(outcome.migratedCounts).reduce((a, b) => a + b, 0);
      setMigrationSuccess(`Successfully migrated ${totalMigrated} items to live Firestore. Pre-migration snapshot saved as ${outcome.snapshotKey}.`);
      setReport(null);
      setConfirmText('');
    } catch (e: any) {
      setError('Migration execution failed: ' + (e.message || String(e)));
    } finally {
      setMigrating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Local Data Backup & Firestore Migration Desk"
      maxWidth="lg"
    >
      <div className="space-y-6">
        <p className="text-xs text-[#526070] leading-relaxed">
          Before altering local storage or performing data updates, use this desk to export a full JSON backup of your current browser records, perform a dry-run migration against live Firestore (with duplicate detection and schema validation), and explicitly migrate validated records.
        </p>

        {downloadNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadNotice}</span>
          </div>
        )}

        {migrationSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{migrationSuccess}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Export Local Backup */}
        <div className="p-4 bg-[#F8FAFC] border border-[#E1E7EF] rounded-2xl flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-[#2563EB]" />
              <h4 className="text-xs font-bold text-[#111111]">1. Export Full Local JSON Backup</h4>
            </div>
            <p className="text-[11px] text-[#526070] mt-0.5">
              Exports all local categories, teams, stages, schedules, participants and registrations to a downloadable JSON file.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadBackup}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export JSON
          </Button>
        </div>

        {/* Step 2: Run Dry-Run Analysis */}
        <div className="p-4 bg-[#F8FAFC] border border-[#E1E7EF] rounded-2xl space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-[#111111]">2. Run Dry-Run Migration Analysis</h4>
              </div>
              <p className="text-[11px] text-[#526070] mt-0.5">
                Inspects local records against live Firestore to detect existing duplicates, validate required fields, and show counts.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRunDryRun}
              isLoading={analyzing}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Analyze Differences
            </Button>
          </div>

          {report && (
            <div className="space-y-4 pt-2 border-t border-[#E1E7EF]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#111111]">Dry-Run Results</span>
                <span className="text-[11px] text-[#526070]">
                  Analyzed at {new Date(report.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Categories', data: report.categories },
                  { label: 'Teams', data: report.teams },
                  { label: 'Competitions', data: report.competitions },
                  { label: 'Stages', data: report.stages },
                  { label: 'Schedules', data: report.schedules },
                  { label: 'Participants', data: report.participants },
                  { label: 'Registrations', data: report.registrations }
                ].map(({ label, data }) => (
                  <div key={label} className="p-2.5 bg-white border border-[#E1E7EF] rounded-xl text-center">
                    <span className="text-[10px] text-[#526070] font-bold block uppercase">{label}</span>
                    <span className="text-xs font-black text-emerald-600 mt-1 block">
                      +{data.validToMigrate.length} New
                    </span>
                    <span className="text-[10px] text-[#526070]">
                      ({data.duplicates.length} duplicate{data.duplicates.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                ))}
              </div>

              {/* Step 3: Explicit Approval & Execution */}
              {report.hasItemsToMigrate ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Explicit Production Approval Required</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    A total of <strong>{report.totalToMigrateCount} non-duplicate records</strong> are validated and ready to write to live Firestore. Duplicate items will be preserved and skipped. Type <strong>MIGRATE</strong> to confirm:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={confirmText}
                      onChange={e => setConfirmText(e.target.value)}
                      placeholder="Type MIGRATE"
                      className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold w-40 uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleExecuteMigration}
                      isLoading={migrating}
                      disabled={confirmText.trim().toUpperCase() !== 'MIGRATE'}
                    >
                      Confirm &amp; Migrate
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>All local records already exist in live Firestore (0 new records to migrate).</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
