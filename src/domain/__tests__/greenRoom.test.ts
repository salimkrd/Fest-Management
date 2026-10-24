import { describe, it, expect } from 'vitest';
import {
  indexToCodeLetter,
  codeLetterToIndex,
  isValidCodeLetter,
  getNextAvailableCodeLetter,
  encodeParticipantQrPayload,
  parseParticipantQrPayload,
  MAX_CODE_LETTER_INDEX
} from '../greenRoom';

describe('Green Room Domain: Code Letter Math & QR Payload Utilities', () => {
  describe('Bijective Code Letter Calculations (A-Z, AA-ZZ)', () => {
    it('correctly maps single-letter indices 0..25 to A..Z', () => {
      expect(indexToCodeLetter(0)).toBe('A');
      expect(indexToCodeLetter(1)).toBe('B');
      expect(indexToCodeLetter(24)).toBe('Y');
      expect(indexToCodeLetter(25)).toBe('Z');
    });

    it('correctly maps double-letter indices 26..701 to AA..ZZ', () => {
      expect(indexToCodeLetter(26)).toBe('AA');
      expect(indexToCodeLetter(27)).toBe('AB');
      expect(indexToCodeLetter(51)).toBe('AZ');
      expect(indexToCodeLetter(52)).toBe('BA');
      expect(indexToCodeLetter(701)).toBe('ZZ');
    });

    it('reverses code letters back to their exact index (round-trip bijection)', () => {
      for (let i = 0; i <= MAX_CODE_LETTER_INDEX; i += 17) {
        const letter = indexToCodeLetter(i);
        expect(codeLetterToIndex(letter)).toBe(i);
      }
      expect(codeLetterToIndex('A')).toBe(0);
      expect(codeLetterToIndex('Z')).toBe(25);
      expect(codeLetterToIndex('AA')).toBe(26);
      expect(codeLetterToIndex('ZZ')).toBe(701);
    });

    it('rejects out-of-range indices and invalid formats', () => {
      expect(() => indexToCodeLetter(-1)).toThrow();
      expect(() => indexToCodeLetter(702)).toThrow();
      expect(() => codeLetterToIndex('AAA')).toThrow();
      expect(() => codeLetterToIndex('12')).toThrow();
      expect(() => codeLetterToIndex('')).toThrow();
    });

    it('validates code letter strings correctly', () => {
      expect(isValidCodeLetter('A')).toBe(true);
      expect(isValidCodeLetter('Z')).toBe(true);
      expect(isValidCodeLetter('AA')).toBe(true);
      expect(isValidCodeLetter('ZZ')).toBe(true);
      expect(isValidCodeLetter('abc')).toBe(false);
      expect(isValidCodeLetter('123')).toBe(false);
      expect(isValidCodeLetter('')).toBe(false);
    });

    it('finds the lowest unoccupied code letter in order', () => {
      expect(getNextAvailableCodeLetter([])).toBe('A');
      expect(getNextAvailableCodeLetter(['A', 'B'])).toBe('C');
      // Gap filling
      expect(getNextAvailableCodeLetter(['A', 'C'])).toBe('B');
      // After Z -> AA
      const allSingle = Array.from({ length: 26 }, (_, i) => indexToCodeLetter(i));
      expect(getNextAvailableCodeLetter(allSingle)).toBe('AA');
    });
  });

  describe('QR Payload Encoding & Parsing', () => {
    it('encodes participant data into JSON payload containing verification hash', () => {
      const encoded = encodeParticipantQrPayload({
        id: 'p-1042',
        bib: '#1042',
        name: 'Zahra Fatima',
        teamCode: 'BSH'
      });

      const parsed = JSON.parse(encoded);
      expect(parsed.app).toBe('INSPIRATH');
      expect(parsed.type).toBe('PARTICIPANT_ID');
      expect(parsed.id).toBe('p-1042');
      expect(parsed.bib).toBe('#1042');
      expect(parsed.hash).toBe('#1042-2025-AUTH-V2');
    });

    it('parses JSON QR payload correctly', () => {
      const raw = encodeParticipantQrPayload({
        id: 'p-8821',
        bib: '#8821',
        name: 'Ahmad Bilal',
        teamCode: 'KAH'
      });

      const res = parseParticipantQrPayload(raw);
      expect(res.isValid).toBe(true);
      expect(res.format).toBe('JSON_PAYLOAD');
      expect(res.participantId).toBe('p-8821');
      expect(res.bib).toBe('#8821');
      expect(res.name).toBe('Ahmad Bilal');
    });

    it('parses URI string fallback format INSPIRATH:PARTICIPANT:id:bib', () => {
      const res = parseParticipantQrPayload('INSPIRATH:PARTICIPANT:part-44:#44');
      expect(res.isValid).toBe(true);
      expect(res.format).toBe('URI_STRING');
      expect(res.participantId).toBe('part-44');
      expect(res.bib).toBe('#44');
    });

    it('parses plain identifier fallback (#1042 or p-1042)', () => {
      const res1 = parseParticipantQrPayload('#1042');
      expect(res1.isValid).toBe(true);
      expect(res1.bib).toBe('#1042');

      const res2 = parseParticipantQrPayload('p-999');
      expect(res2.isValid).toBe(true);
      expect(res2.participantId).toBe('p-999');
    });

    it('handles empty input gracefully', () => {
      const res = parseParticipantQrPayload('');
      expect(res.isValid).toBe(false);
    });
  });
});
