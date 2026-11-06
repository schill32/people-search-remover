import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { StateManager } from '../src/state.js';

describe('StateManager', () => {
  let tmpDir: string;
  let tmpStateFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'psr-test-'));
    tmpStateFile = path.join(tmpDir, 'test-state.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes with an empty store when file does not exist', () => {
    const manager = new StateManager(tmpStateFile);
    expect(manager.getAllRecords()).toEqual([]);
  });

  it('records a new candidate profile', async () => {
    const manager = new StateManager(tmpStateFile);
    const record = await manager.recordCandidate({
      id: 'https://whitepages.com/name/Jane-Doe/Austin-TX/PX123',
      providerId: 'whitepages',
      providerName: 'Whitepages',
      name: 'Jane Doe',
      location: 'Austin, TX',
      profileUrl: 'https://whitepages.com/name/Jane-Doe/Austin-TX/PX123',
    });

    expect(record.status).toBe('pending');
    expect(record.name).toBe('Jane Doe');
    expect(manager.getAllRecords()).toHaveLength(1);
    expect(manager.isAlreadyProcessed('whitepages', 'https://whitepages.com/name/Jane-Doe/Austin-TX/PX123')).toBe(false);
  });

  it('updates record status and marks as processed when submitted or verified', async () => {
    const manager = new StateManager(tmpStateFile);
    const candidateId = 'https://spokeo.com/Jane-Doe/TX/Austin/p123';
    await manager.recordCandidate({
      id: candidateId,
      providerId: 'spokeo',
      providerName: 'Spokeo',
      name: 'Jane Doe',
      location: 'Austin, TX',
      profileUrl: candidateId,
    });

    await manager.updateStatus('spokeo', candidateId, 'submitted', 'Form submitted, check email');
    expect(manager.isAlreadyProcessed('spokeo', candidateId)).toBe(true);

    const reloaded = new StateManager(tmpStateFile);
    const record = reloaded.getRecord('spokeo', candidateId);
    expect(record?.status).toBe('submitted');
    expect(record?.notes).toBe('Form submitted, check email');
  });
});
