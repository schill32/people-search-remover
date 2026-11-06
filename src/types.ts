import { z } from 'zod';
import type { Page, BrowserContext } from 'playwright';

// --- Configuration Schemas ---

export const LocationSchema = z.object({
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State must be a 2-letter US abbreviation (e.g., TX)').toUpperCase(),
});

export type Location = z.infer<typeof LocationSchema>;

export const PersonSchema = z.object({
  name: z.string().min(1, 'Person name is required'),
  dob: z.string().optional(),
  locations: z.array(LocationSchema).min(1, 'At least one location is required'),
  aliases: z.array(z.string()).default([]),
});

export type Person = z.infer<typeof PersonSchema>;

export const VerificationConfigSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional(),
});

export type VerificationConfig = z.infer<typeof VerificationConfigSchema>;

export const BrowserConfigSchema = z.object({
  headless: z.boolean().default(false),
  slow_mo_ms: z.number().int().nonnegative().default(100),
});

export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;

export const AppConfigSchema = z.object({
  verification: VerificationConfigSchema.default({}),
  browser: BrowserConfigSchema.default({}),
  enabled_providers: z.array(z.string()).default([
    'whitepages',
    'spokeo',
    'truthfinder',
    'intelius',
    'beenverified',
  ]),
  opt_out_reason: z.string().default('I just want to keep my information private'),
  people: z.array(PersonSchema).min(1, 'At least one person must be configured in people list'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// --- Search & Suppression Types ---

export interface SearchCandidate {
  providerId: string;
  providerName: string;
  id: string; // Unique profile URL or canonical record ID
  targetPerson: string; // The person queried
  name: string;
  age?: string | number;
  locations: string[];
  relatives?: string[];
  profileUrl: string;
  metadata?: Record<string, unknown>;
}

export type SuppressionStatus =
  | 'pending'
  | 'submitted'
  | 'verified'
  | 'requires_action'
  | 'failed';

export interface SuppressionResult {
  providerId: string;
  recordId: string;
  status: SuppressionStatus;
  message: string;
  actionDetails?: string; // e.g., 'Verification PIN: 5821' or 'Check email inbox for link'
}

// --- Provider Contract ---

export interface TerminalUI {
  log(msg: string): void;
  info(msg: string): void;
  success(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  showPin(pin: string, provider: string): void;
  showEmailNotice(email: string, provider: string): void;
  waitForKeypress(promptMessage?: string): Promise<void>;
}

export interface ProviderContext {
  page: Page;
  browserContext: BrowserContext;
  config: AppConfig;
  ui: TerminalUI;
}

export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly network?: string;
  readonly description: string;
  readonly verificationType: 'phone' | 'email' | 'none' | 'hybrid';

  search(person: Person, location: Location, ctx: ProviderContext): Promise<SearchCandidate[]>;
  suppress(candidate: SearchCandidate, ctx: ProviderContext): Promise<SuppressionResult>;
}

// --- State Tracking Schema ---

export interface StateRecord {
  id: string;
  providerId: string;
  providerName: string;
  name: string;
  location: string;
  profileUrl: string;
  status: SuppressionStatus;
  firstSeen: string;
  lastAttempt: string;
  notes?: string;
}

export interface StateStore {
  version: number;
  records: Record<string, StateRecord>; // Key: `${providerId}:${recordId}`
}
