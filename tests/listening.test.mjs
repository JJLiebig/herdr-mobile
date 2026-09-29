import test from 'node:test';
import assert from 'node:assert/strict';
import { listeningAddresses } from '../server/listening.mjs';

test('wildcard bind lists actual IPv4 adapters without claiming IPv6', () => {
  const interfaces = {
    loopback: [{ family: 'IPv4', address: '127.0.0.1' }, { family: 'IPv6', address: '::1' }],
    tailscale: [{ family: 'IPv4', address: '100.92.118.17' }],
    alias: [{ family: 'IPv4', address: '100.92.118.17' }],
  };
  assert.deepEqual(listeningAddresses('0.0.0.0', interfaces), ['127.0.0.1', '100.92.118.17']);
  assert.deepEqual(listeningAddresses('127.0.0.1', interfaces), ['127.0.0.1']);
});
