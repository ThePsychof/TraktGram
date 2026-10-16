import { db } from 'sdk';
import { eq } from 'sdk/db';
import type { KeyValueStore } from '../services/storage';
import { keyValueEntries } from './schema.js';

export class DatabaseKeyValueStore implements KeyValueStore {
  async get(key: string, _type: 'json'): Promise<unknown> {
    const row = await db
      .select()
      .from(keyValueEntries)
      .where(eq(keyValueEntries.key, key))
      .get();
    if (!row) return null;

    const expiresAt = row.expiresAt;
    if (typeof expiresAt === 'number' && expiresAt <= Date.now()) {
      await this.delete(key);
      return null;
    }

    if (typeof row.value !== 'string') throw new Error('Stored key/value row is invalid');
    return JSON.parse(row.value);
  }

  async put(key: string, value: string, options?: { expirationTtl: number }): Promise<void> {
    const expiresAt = options
      ? Date.now() + options.expirationTtl * 1000
      : null;
    await db
      .insert(keyValueEntries)
      .values({ key, value, expiresAt })
      .onConflictDoUpdate({
        target: keyValueEntries.key,
        set: { value, expiresAt },
      })
      .run();
  }

  async delete(key: string): Promise<void> {
    await db
      .delete(keyValueEntries)
      .where(eq(keyValueEntries.key, key))
      .run();
  }
}
