import { randomBytes } from 'node:crypto';

/** Short prefixed ids for demo readability (m_*, asg_*, blk_*).
 *  48 bits entropy — fine for a single-file demo, not for prod
 *  (prod: UUIDv7/ULID + real tokens). Skills stay deterministic sk_<org>_<name>.
 */
export function newId(prefix: string): string {
  return `${prefix}${randomBytes(6).toString('hex')}`;
}
