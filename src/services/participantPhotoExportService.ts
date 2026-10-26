import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

// Restrict outbound requests to HTTPS on publicly routable IPv4 addresses.
// A pinned DNS lookup prevents a second lookup from redirecting the request
// to localhost, link-local infrastructure or private internal services.
export function isPublicIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0));
}

/**
 * Node.js 22 may request all DNS candidates while auto-selecting address families.
 * In that mode, lookup MUST return [{address,family}], not a plain IPv4 string;
 * otherwise net.connect throws "Invalid IP address: undefined".
 */
export function pinnedLookupAnswer(address: string, all: boolean):
  string | Array<{ address: string; family: number }> {
  if (!isPublicIpv4(address)) throw new Error('Unsafe resolved participant-photo IP.');
  return all ? [{ address, family: 4 }] : address;
}

export function validatePhotoSource(source: string): URL {
  if (!source || source.length > 4096) throw new Error('Invalid participant photo URL.');
  const url = new URL(source);
  if (url.protocol !== 'https:' || url.username || url.password ||
      (url.port && url.port !== '443') || isIP(url.hostname) !== 0 ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)) {
    throw new Error('Only public HTTPS participant photos can be exported.');
  }
  return url;
}

async function getPhoto(source: string, redirects: number): Promise<{ bytes: Buffer; contentType: string }> {
  const url = validatePhotoSource(source);
  const records = await lookup(url.hostname, { family: 4, all: true });
  if (!records.length || records.some(record => !isPublicIpv4(record.address))) {
    throw new Error('Participant photo host is not publicly reachable.');
  }
  const pinned = records[0].address;

  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'GET',
      timeout: 9000,
      headers: { Accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif' },
      // Pin to the already-validated public address; do not re-resolve during TLS.
      // Node 22's default family auto-selection can ask for an array of DNS
      // candidates, so handle both lookup callback shapes correctly.
      autoSelectFamily: false,
      lookup: (_host, options, callback) => {
        const answer = pinnedLookupAnswer(pinned, Boolean(options.all));
        if (typeof answer === 'string') callback(null, answer, 4);
        else callback(null, answer);
      }
    }, response => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400 && response.headers.location && redirects < 2) {
        const next = new URL(response.headers.location, url).toString();
        response.resume();
        getPhoto(next, redirects + 1).then(resolve, reject);
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new Error('Participant photo source returned HTTP ' + status));
        return;
      }
      const type = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_TYPES.has(type)) {
        response.resume();
        reject(new Error('Participant photo URL did not return a supported image.'));
        return;
      }
      const declared = Number(response.headers['content-length']);
      if (Number.isFinite(declared) && declared > MAX_PHOTO_BYTES) {
        response.resume();
        reject(new Error('Participant photo exceeds the 6MB export limit.'));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_PHOTO_BYTES) {
          req.destroy(new Error('Participant photo exceeds the 6MB export limit.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ bytes: Buffer.concat(chunks), contentType: type }));
      response.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Participant photo download timed out.')));
    req.on('error', reject);
    req.end();
  });
}

export async function loadParticipantPhotoForExport(source: string): Promise<{ bytes: Buffer; contentType: string }> {
  return getPhoto(source, 0);
}
