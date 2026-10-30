const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

/**
 * The key an address is counted by. A client of IPv6 holds a whole /64 (billions of addresses), so
 * its attempts are counted per /64, not per address; IPv4 and its IPv6 form count as one.
 */
export function addressKeyOf(ip: string): string {
  const mapped = mappedIpv4.exec(ip)?.[1];
  if (mapped !== undefined) return mapped;
  if (!ip.includes(':')) return ip;

  const [head = '', tail = ''] = ip.replace(/%.*$/, '').split('::');
  const headGroups = head === '' ? [] : head.split(':');
  const tailGroups = tail === '' ? [] : tail.split(':');
  const gap = ip.includes('::')
    ? Array.from({ length: 8 - headGroups.length - tailGroups.length }, (): string => '0')
    : [];
  const prefix = [...headGroups, ...gap, ...tailGroups]
    .slice(0, 4)
    .map((group): number => Number.parseInt(group, 16));
  if (prefix.length < 4 || prefix.some(Number.isNaN)) return ip;

  return `${prefix.map((group): string => group.toString(16)).join(':')}::/64`;
}
