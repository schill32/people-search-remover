import fs from 'node:fs';
import path from 'node:path';
import type { StateRecord, StateStore, SuppressionStatus } from './types.js';

export const DEFAULT_STATE_FILE = 'state.json';

export class StateManager {
  private filePath: string;
  private store: StateStore;

  constructor(customPath?: string) {
    this.filePath = path.resolve(process.cwd(), customPath || DEFAULT_STATE_FILE);
    this.store = this.loadSync();
  }

  private loadSync(): StateStore {
    if (!fs.existsSync(this.filePath)) {
      return { version: 1, records: {} };
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data) as StateStore;
      if (!parsed.records) {
        return { version: 1, records: {} };
      }
      return parsed;
    } catch {
      return { version: 1, records: {} };
    }
  }

  private async save(): Promise<void> {
    const tempPath = `${this.filePath}.tmp`;
    const json = JSON.stringify(this.store, null, 2);
    await fs.promises.writeFile(tempPath, json, 'utf-8');
    await fs.promises.rename(tempPath, this.filePath);
  }

  private makeKey(providerId: string, recordId: string): string {
    return `${providerId.toLowerCase()}:${recordId.trim()}`;
  }

  public getRecord(providerId: string, recordId: string): StateRecord | undefined {
    return this.store.records[this.makeKey(providerId, recordId)];
  }

  public isAlreadyProcessed(providerId: string, recordId: string): boolean {
    const record = this.getRecord(providerId, recordId);
    if (!record) return false;
    return record.status === 'verified' || record.status === 'submitted';
  }

  public async recordCandidate(candidate: {
    id: string;
    providerId: string;
    providerName: string;
    name: string;
    location: string;
    profileUrl: string;
  }): Promise<StateRecord> {
    const key = this.makeKey(candidate.providerId, candidate.id);
    const existing = this.store.records[key];
    const now = new Date().toISOString();

    if (existing) {
      existing.name = candidate.name;
      existing.location = candidate.location;
      existing.profileUrl = candidate.profileUrl;
      await this.save();
      return existing;
    }

    const newRecord: StateRecord = {
      id: candidate.id,
      providerId: candidate.providerId,
      providerName: candidate.providerName,
      name: candidate.name,
      location: candidate.location,
      profileUrl: candidate.profileUrl,
      status: 'pending',
      firstSeen: now,
      lastAttempt: now,
    };

    this.store.records[key] = newRecord;
    await this.save();
    return newRecord;
  }

  public async updateStatus(
    providerId: string,
    recordId: string,
    status: SuppressionStatus,
    notes?: string
  ): Promise<StateRecord | undefined> {
    const key = this.makeKey(providerId, recordId);
    const record = this.store.records[key];
    if (!record) return undefined;

    record.status = status;
    record.lastAttempt = new Date().toISOString();
    if (notes) record.notes = notes;

    await this.save();
    return record;
  }

  public getAllRecords(): StateRecord[] {
    return Object.values(this.store.records);
  }

  public getRecordsByProvider(providerId: string): StateRecord[] {
    const normalized = providerId.toLowerCase();
    return Object.values(this.store.records).filter((r) => r.providerId.toLowerCase() === normalized);
  }

  public getRecordsByStatus(status: SuppressionStatus): StateRecord[] {
    return Object.values(this.store.records).filter((r) => r.status === status);
  }
}
