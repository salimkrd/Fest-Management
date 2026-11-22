import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readProjectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('Green Room rolling Code Letter reveal', () => {
  const pageSrc = readProjectFile('src/app/admin/green-room/page.tsx');
  const revealSrc = readProjectFile('src/components/domain/GreenRoomCodeReveal.tsx');
  const scannerSrc = readProjectFile('src/components/domain/GreenRoomScanner.tsx');
  const serviceSrc = readProjectFile('src/services/greenRoomService.ts');

  it('routes QR scans and Manual Lookup through the same check-in handler', () => {
    expect(pageSrc).toContain("onScanSuccess={(code) => void handlePerformCheckIn(code, 'QR_SCAN')}");
    expect(pageSrc).toContain("handlePerformCheckIn(selectedManualRegistration.id, 'MANUAL_LOOKUP')");
    expect(pageSrc).toContain("checkInMethod: method");
  });

  it('requires an explicit Manual Lookup selection before check-in', () => {
    expect(pageSrc).toContain('selectedManualRegistrationId');
    expect(pageSrc).toContain('disabled={isCheckingIn || Boolean(codeReveal) || !selectedManualRegistration}');
    expect(pageSrc).toContain('Check In & Assign Random Code');
    expect(pageSrc).not.toContain('manualCodeInput');
    expect(pageSrc).not.toContain('manualCodeLetter:');
  });

  it('reveals the exact Code Letter returned by the server assignment', () => {
    expect(pageSrc).toContain('<GreenRoomCodeReveal');
    expect(revealSrc).toContain('setDisplayedCode(assignment.codeLetter)');
    expect(revealSrc).toContain('isExisting');
    expect(revealSrc).toContain('Print Code Slip');
    expect(revealSrc).toContain('server-assigned');
  });

  it('does not spin or reassign a participant who already has a Code Letter', () => {
    expect(revealSrc).toMatch(/if \(isExisting\) \{[\s\S]*?setDisplayedCode\(assignment\.codeLetter\);[\s\S]*?setPhase\('complete'\);[\s\S]*?return;/);
    expect(revealSrc).toContain('This Code Letter is saved in the competition roster.');
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
