import { createHash } from 'node:crypto';
import { HttpError } from './security.mjs';
/** In-memory draft ledger, not a durable exactly-once delivery guarantee. */
export class OperationLedger {
  #entries = new Map();
  constructor(limit=256) { this.limit=limit; }
  async execute(op, fn) {
    const fingerprint=createHash('sha256').update(JSON.stringify({target:op.target,text:op.text})).digest('hex');
    const previous=this.#entries.get(op.id);
    if(previous) {
      if(previous.fingerprint!==fingerprint) throw new HttpError(409,'operation_id_conflict');
      return previous.promise;
    }
    if(this.#entries.size>=this.limit) throw new HttpError(429,'operation_ledger_full');
    // Install before executing. A duplicate shares the promise, including failure.
    const entry={fingerprint,promise:Promise.resolve().then(fn)};
    this.#entries.set(op.id,entry);
    return entry.promise;
  }
}
