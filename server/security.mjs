import { isAbsolute } from 'node:path';
export class HttpError extends Error {
  constructor(status, code, message = code) { super(message); this.status = status; this.code = code; }
}
export function readConfig(env = process.env) {
  const port = Number(env.HERDR_MOBILE_PORT || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid HERDR_MOBILE_PORT');
  const mode = env.HERDR_MOBILE_MODE || 'demo';
  if (!['demo', 'herdr-readonly'].includes(mode)) throw new Error('Only demo and herdr-readonly are implemented. Live writes are not available.');
  const url = new URL(env.HERDR_MOBILE_ORIGIN || `http://127.0.0.1:${port}`);
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Origin must contain only scheme, hostname and optional port');
  const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === String(port);
  const remote = url.protocol === 'https:' && url.hostname.endsWith('.ts.net') && url.port === '';
  if (!local && !remote) throw new Error('Use exact loopback HTTP or private Tailscale HTTPS origin');
  const logins = (env.HERDR_MOBILE_ALLOWED_LOGINS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (remote && !logins.length) throw new Error('Remote access requires HERDR_MOBILE_ALLOWED_LOGINS');
  if (mode !== 'demo' && (!env.HERDR_BIN_PATH || !isAbsolute(env.HERDR_BIN_PATH))) throw new Error('Read-only mode requires an absolute HERDR_BIN_PATH');
  return { port, mode, origin:url.origin, host:url.host, remote, logins, hostId:env.HERDR_MOBILE_HOST_ID || 'desktop', hostLabel:env.HERDR_MOBILE_HOST_LABEL || 'Desktop', herdrBin:env.HERDR_BIN_PATH, apiKey:env.OPENAI_API_KEY || '', transcriptionModel:env.HERDR_MOBILE_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe', configPath:env.HERDR_MOBILE_CONFIG || '' };
}
export function authorize(req, cfg) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) throw new HttpError(403,'not_loopback');
  if (req.headers.host !== cfg.host) throw new HttpError(403,'invalid_host');
  const origin = req.headers.origin;
  if (origin && origin !== cfg.origin) throw new HttpError(403,'invalid_origin');
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403,'cross_site');
  if (cfg.remote) {
    // Trust only the local Serve proxy, never an exposed bind address or arbitrary proxy.
    const login = req.headers['tailscale-user-login'];
    if (typeof login !== 'string' || !cfg.logins.includes(login.toLowerCase())) throw new HttpError(403,'unauthorized_user');
  }
  if (!['GET','HEAD'].includes(req.method)) {
    if (origin !== cfg.origin || req.headers['x-herdr-mobile'] !== '1') throw new HttpError(403,'csrf_rejected');
  }
}
export function commonHeaders(res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Permissions-Policy','microphone=(self), camera=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; worker-src 'self'");
}
export async function readBody(req, max) {
  const declared = req.headers['content-length'];
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > max)) throw new HttpError(413,'body_too_large');
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new HttpError(413,'body_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function validateHosts(value) {
  if (!Array.isArray(value) || value.length > 8) throw new Error('hosts must be an array of at most eight entries');
  const ids=new Set();
  return value.map(h=>{
    if (!h || typeof h.id !== 'string' || !/^[\w-]{1,60}$/.test(h.id) || ids.has(h.id) || typeof h.label !== 'string' || h.label.length > 60) throw new Error('Invalid or duplicate host');
    const url=new URL(h.url);
    if(url.protocol!=='https:' || !url.hostname.endsWith('.ts.net') || url.port || url.username || url.password || url.pathname!=='/' || url.search || url.hash) throw new Error('Hosts must be private Tailscale HTTPS origins');
    ids.add(h.id); return {id:h.id,label:h.label,url:url.origin};
  });
}
