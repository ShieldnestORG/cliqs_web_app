/**
 * BYODB Host Validation (SSRF guard)
 *
 * File: lib/byodb/hostValidation.ts
 *
 * Client-supplied MongoDB connection URIs make the server open outbound
 * connections. Before connecting, every host in the URI is resolved via DNS
 * and rejected if any resolved address is private, loopback, link-local, or
 * otherwise reserved — this stops the BYODB endpoints being used to reach
 * internal infrastructure.
 *
 * mongodb+srv:// URIs are handled by resolving the same SRV record the driver
 * uses (`_mongodb._tcp.<host>`) and validating every SRV target's resolved
 * addresses. Atlas SRV targets resolve to public IPs, so legitimate Atlas
 * URIs pass.
 *
 * Known residual risks, both tracked as follow-up L4 in
 * docs/security/SOC2-GAP-ASSESSMENT.md:
 *   - DNS rebinding: the driver re-resolves after this check.
 *   - Replica-set discovery: a validated public mongod may advertise private
 *     member addresses in its hello response, which the driver then connects
 *     to without re-validation.
 */

import { promises as dns } from "dns";
import { isIP } from "net";

export class HostValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostValidationError";
  }
}

// ---------------------------------------------------------------------------
// IP parsing and range checks
// ---------------------------------------------------------------------------

function parseIpv4(addr: string): number[] | null {
  const match = addr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  return (
    a === 0 || // 0.0.0.0/8 ("this network")
    a === 10 || // 10.0.0.0/8 (RFC 1918)
    a === 127 || // 127.0.0.0/8 (loopback)
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT)
    (a === 169 && b === 254) || // 169.254.0.0/16 (link-local / cloud metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 (RFC 1918)
    (a === 192 && b === 168) // 192.168.0.0/16 (RFC 1918)
  );
}

/** Parse an IPv6 address into its 8 hextets. Returns null if malformed. */
function parseIpv6(addr: string): number[] | null {
  const zoneIdx = addr.indexOf("%");
  const bare = zoneIdx === -1 ? addr : addr.slice(0, zoneIdx);
  const halves = bare.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const group of part.split(":")) {
      if (group.includes(".")) {
        // Embedded IPv4, e.g. ::ffff:127.0.0.1
        const v4 = parseIpv4(group);
        if (!v4) return null;
        out.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
        out.push(parseInt(group, 16));
      }
    }
    return out;
  };

  const head = parseGroups(halves[0]);
  const tail = halves.length === 2 ? parseGroups(halves[1]) : [];
  if (!head || !tail) return null;

  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }
  // "::" must stand for at least one zero group
  if (head.length + tail.length > 7) return null;
  return [...head, ...new Array(8 - head.length - tail.length).fill(0), ...tail];
}

function isPrivateIpv6(hextets: number[]): boolean {
  const allZeroUpTo = (n: number) => hextets.slice(0, n).every((h) => h === 0);

  // :: (unspecified) and ::1 (loopback)
  if (allZeroUpTo(7) && (hextets[7] === 0 || hextets[7] === 1)) return true;
  // ::ffff:a.b.c.d (IPv4-mapped) and ::a.b.c.d (deprecated IPv4-compatible)
  if (allZeroUpTo(5) && (hextets[5] === 0xffff || hextets[5] === 0)) {
    return isPrivateIpv4([hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff]);
  }
  if ((hextets[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 (unique local)
  if ((hextets[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  return false;
}

// ---------------------------------------------------------------------------
// Hostname checks
// ---------------------------------------------------------------------------

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "local" ||
    host.endsWith(".local") ||
    host === "internal" ||
    host.endsWith(".internal")
  );
}

// ---------------------------------------------------------------------------
// Mongo URI host extraction
// ---------------------------------------------------------------------------

/**
 * Extract the host list from a MongoDB connection string.
 * Handles credentials, comma-separated replica-set host lists, ports,
 * and bracketed IPv6 literals.
 */
export function extractMongoHosts(uri: string): { srv: boolean; hosts: string[] } {
  const schemeMatch = uri.match(/^mongodb(\+srv)?:\/\//i);
  if (!schemeMatch) {
    throw new HostValidationError("URI must start with mongodb:// or mongodb+srv://");
  }
  const srv = Boolean(schemeMatch[1]);
  const rest = uri.slice(schemeMatch[0].length);
  const authorityEnd = rest.search(/[/?]/);
  const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  const atIdx = authority.lastIndexOf("@");
  const hostPart = atIdx === -1 ? authority : authority.slice(atIdx + 1);

  const hosts = hostPart
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();
      if (trimmed.startsWith("[")) {
        // Bracketed IPv6 literal, e.g. [::1]:27017
        const close = trimmed.indexOf("]");
        return close === -1 ? "" : trimmed.slice(1, close);
      }
      const colon = trimmed.lastIndexOf(":");
      return colon === -1 ? trimmed : trimmed.slice(0, colon);
    })
    .filter((host) => host.length > 0);

  if (hosts.length === 0) {
    throw new HostValidationError("Connection string contains no host");
  }
  return { srv, hosts };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Validate a single host: blocklisted names fail; IP literals are checked
 *  directly; hostnames are DNS-resolved and every address checked (fail closed). */
async function assertHostAllowed(host: string): Promise<void> {
  if (isBlockedHostname(host)) {
    throw new HostValidationError(`Host "${host}" is not allowed`);
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4 || ipVersion === 6) {
    const parsed = ipVersion === 4 ? parseIpv4(host) : parseIpv6(host);
    const isPrivate = parsed && (ipVersion === 4 ? isPrivateIpv4(parsed) : isPrivateIpv6(parsed));
    if (!parsed || isPrivate) {
      throw new HostValidationError(`IP address "${host}" is in a private or reserved range`);
    }
    return;
  }

  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new HostValidationError(`Could not resolve host "${host}"`);
  }
  if (records.length === 0) {
    throw new HostValidationError(`Could not resolve host "${host}"`);
  }
  for (const record of records) {
    const parsed = record.family === 4 ? parseIpv4(record.address) : parseIpv6(record.address);
    const isPrivate =
      parsed && (record.family === 4 ? isPrivateIpv4(parsed) : isPrivateIpv6(parsed));
    if (!parsed || isPrivate) {
      throw new HostValidationError(`Host "${host}" resolves to a private or reserved address`);
    }
  }
}

/**
 * Reject a MongoDB connection URI whose target is private, reserved, or
 * unresolvable. Throws {@link HostValidationError}; resolves silently when
 * every target is public.
 */
export async function assertPublicMongoTarget(connectionUri: string): Promise<void> {
  const { srv, hosts } = extractMongoHosts(connectionUri);

  if (!srv) {
    await Promise.all(hosts.map(assertHostAllowed));
    return;
  }

  // mongodb+srv://: a single seed hostname; the driver looks up
  // _mongodb._tcp.<host> SRV records and connects to those targets, so
  // validate every SRV target's resolved addresses rather than the seed name.
  const seedHost = hosts[0];
  if (isBlockedHostname(seedHost)) {
    throw new HostValidationError(`Host "${seedHost}" is not allowed`);
  }
  let srvRecords: { name: string }[];
  try {
    srvRecords = await dns.resolveSrv(`_mongodb._tcp.${seedHost}`);
  } catch {
    throw new HostValidationError(`Could not resolve SRV record for "${seedHost}"`);
  }
  if (srvRecords.length === 0) {
    throw new HostValidationError(`Could not resolve SRV record for "${seedHost}"`);
  }
  await Promise.all(srvRecords.map((record) => assertHostAllowed(record.name)));
}
