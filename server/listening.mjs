import { networkInterfaces } from 'node:os';

export function listeningAddresses(bind, interfaces = networkInterfaces()) {
  if (bind !== '0.0.0.0') return [bind];
  const addresses = [...new Set(Object.values(interfaces).flat().filter(entry => entry?.family === 'IPv4').map(entry => entry.address))];
  return addresses.length ? addresses : [bind];
}
