import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readProjectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('Green Room Fortune Wheel check-in reveal', () => {
  const pageSrc = readProjectFile('src/app/admin/green-room/page.tsx');
  const revealSrc = readProjectFile('src/components/domain/GreenRoomCodeReveal.tsx');
  const scannerSrc = readProjectFile('src/components/domain/GreenRoomScanner.tsx');
  const serviceSrc = readProjectFile('src/services/greenRoomService.ts');

  it('routes QR scans and Manual Lookup through the same check-in handler', () => {
    expect(pageSrc).toContain("onScanSuccess={(code) => void handlePerformCheckIn(code, 'QR_SCAN')}");
    expect(pageSrc).toContain("handlePerformCheckIn(selectedManualRegistration.id, 'MANUAL_LOOKUP')");
    expect(pageSrc).toContain('checkInMethod: method');
  });

  it('requires an explicit Manual Lookup selection before check-in', () => {
    expect(pageSrc).toContain('selectedManualRegistrationId');
    expect(pageSrc).toContain('disabled={isCheckingIn || Boolean(codeReveal) || !selectedManualRegistration}');
    expect(pageSrc).toContain('Check In & Assign Random Code');
    expect(pageSrc).not.toContain('manualCodeInput');
    expect(pageSrc).not.toContain('manualCodeLetter:');
  });

  it('renders a segmented Fortune Wheel with an exact five-second spin', () => {
    expect(revealSrc).toContain('SEGMENT_COUNT = 12');
    expect(revealSrc).toContain('SPIN_DURATION_MS = 5_000');
    expect(revealSrc).toContain('`transform ${SPIN_DURATION_MS}ms cubic-bezier');
    expect(revealSrc).toContain('Wheel Spinning · 5 Seconds');
    expect(revealSrc).toContain('SEGMENT_COLORS');
    expect(revealSrc).toContain('describeSegment(index)');
  });

  it('uses one unique alphabet character per wheel slot while retaining the full assigned code', () => {
    expect(revealSrc).toContain("const WHEEL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')");
    expect(revealSrc).toContain("const targetLetter = (targetCode.trim().toUpperCase()[0] || 'A')");
    expect(revealSrc).toContain('const available = WHEEL_LETTERS.filter(letter => letter !== targetLetter)');
    expect(revealSrc).toContain('fontSize={31}');
    expect(revealSrc).toContain('{assignment.codeLetter}');
    expect(revealSrc).not.toContain('ROLLING_CODES');
  });

  it('stops the wheel on the exact Code Letter returned by the server', () => {
    expect(revealSrc).toContain('assignment.codeLetter');
    expect(revealSrc).toContain('setRotation(finalRotation)');
    expect(revealSrc).toContain('Wheel stopped · Code Letter assigned');
    expect(revealSrc).toContain('This Code Letter is saved in the competition roster.');
    expect(revealSrc).toContain('SPIN_DURATION_MS + 700');
  });

  it('does not spin or reassign a participant who already has a Code Letter', () => {
    expect(revealSrc).toMatch(/if \(isExisting\) \{[\s\S]*?setRotation\(finalRotation\);[\s\S]*?setIsSpinning\(false\);[\s\S]*?setPhase\('complete'\);[\s\S]*?return;/);
    expect(revealSrc).toContain('Original Code Letter retained');
  });

  it('locks the scanner while check-in/reveal is active to prevent duplicate scans', () => {
    expect(pageSrc).toContain('isPaused={isCheckingIn || Boolean(codeReveal)}');
    expect(scannerSrc).toContain('scanLockedRef');
    expect(scannerSrc).toContain('isPausedRef.current');
    expect(scannerSrc).toContain('onScanSuccessRef.current(decodedText)');
  });

  it('keeps authoritative random allocation in the transactional server service', () => {
    expect(serviceSrc).toContain('getRandomAvailableCodeLetter(assignedCodes, eligibleCount)');
    expect(serviceSrc).toContain('transaction.set(assignmentRef, finalAssignment)');
    expect(serviceSrc).toContain('if (existingDoc.exists)');
  });
});
