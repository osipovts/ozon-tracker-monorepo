import { BlockList, isIP } from 'node:net';

const excludedAddresses = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] satisfies Array<[string, number]>) {
  excludedAddresses.addSubnet(network, prefix);
}

export class ProxyEndpointEntity {
  readonly server: string;
  readonly username: string;
  readonly password: string;

  constructor(input: string) {
    const url = new URL(input);
    const port =
      url.port || (url.protocol === 'http:' ? '80' : url.protocol === 'https:' ? '443' : '');
    if (
      !['http:', 'https:', 'socks5:'].includes(url.protocol) ||
      isIP(url.hostname) !== 4 ||
      excludedAddresses.check(url.hostname) ||
      port === '' ||
      !['', '/'].includes(url.pathname) ||
      url.search !== '' ||
      url.hash !== '' ||
      (url.protocol === 'socks5:' && (url.username !== '' || url.password !== ''))
    ) {
      throw new Error(
        'Proxy must use HTTP(S) or SOCKS5 with a public IPv4 and port; SOCKS5 authentication is unsupported',
      );
    }

    this.server = `${url.protocol}//${url.hostname}:${port}`;
    this.username = decodeURIComponent(url.username);
    this.password = decodeURIComponent(url.password);
  }
}
