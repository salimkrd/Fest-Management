import { describe, expect, it } from 'vitest';
import { isPublicIpv4, validatePhotoSource } from '@/services/participantPhotoExportService';

describe('Authenticated participant photo image source validation', () => {
  it('allows public HTTPS photo sources, including Firebase Storage', () => {
    expect(validatePhotoSource('https://firebasestorage.googleapis.com/v0/b/test/o/p.jpg?alt=media').hostname)
      .toBe('firebasestorage.googleapis.com');
    expect(isPublicIpv4('142.250.190.75')).toBe(true);
  });
  it('prevents localhost, credentials, non-HTTPS, IP-literal, private and metadata origins', () => {
    for (const source of [
      'http://example.com/p.jpg', 'https://127.0.0.1/p.jpg',
      'https://169.254.169.254/latest/meta-data/', 'https://user:pass@example.com/p.jpg',
      'https://localhost/p.jpg', 'https://private.internal/p.jpg', 'https://example.com:8080/p.jpg'
    ]) expect(() => validatePhotoSource(source)).toThrow();
    for (const ip of ['10.0.0.1', '127.0.0.1', '172.16.1.1', '192.168.1.1',
      '169.254.169.254', '100.100.100.200', '224.0.0.1', '0.0.0.0']) {
      expect(isPublicIpv4(ip)).toBe(false);
    }
  });
});
