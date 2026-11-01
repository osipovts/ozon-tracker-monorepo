import { BlockList, isIP } from 'node:net';

const reserved = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] satisfies Array<[string, number]>) {
  reserved.addSubnet(network, prefix, 'ipv4');
}
reserved.addAddress('::', 'ipv6');
reserved.addAddress('::1', 'ipv6');
reserved.addSubnet('fc00::', 7, 'ipv6');
reserved.addSubnet('fe80::', 10, 'ipv6');
reserved.addSubnet('ff00::', 8, 'ipv6');

const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

/** Whether the address is one of the open internet: not the machine itself, nor a private network, nor a reserved range. */
export function isPublicAddress(address: string): boolean {
  const mapped = mappedIpv4.exec(address)?.[1];
  const checked = mapped ?? address;
  const family = isIP(checked);
  if (family === 0) return false;

  return !reserved.check(checked, family === 4 ? 'ipv4' : 'ipv6');
}
