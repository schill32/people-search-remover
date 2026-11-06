import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { AppConfigSchema, type AppConfig } from './types.js';

export const DEFAULT_CONFIG_FILE = 'config.yaml';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Parses and validates raw YAML string content against the AppConfigSchema.
 */
export function parseConfigYaml(content: string): AppConfig {
  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Failed to parse YAML configuration: ${errorMsg}`);
  }

  const result = AppConfigSchema.safeParse(parsed);
  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((e) => `  - [${e.path.join('.') || 'root'}]: ${e.message}`)
      .join('\n');
    throw new ConfigError(`Configuration validation errors:\n${formattedErrors}`);
  }

  return result.data;
}

/**
 * Loads configuration from a given file path (defaults to config.yaml in cwd).
 */
export async function loadConfig(customPath?: string): Promise<AppConfig> {
  const resolvedPath = path.resolve(process.cwd(), customPath || DEFAULT_CONFIG_FILE);

  if (!fs.existsSync(resolvedPath)) {
    throw new ConfigError(
      `Configuration file not found: "${resolvedPath}"\n\n` +
      `To get started, copy the template and edit it with your family details:\n` +
      `  cp config.example.yaml config.yaml\n`
    );
  }

  const content = await fs.promises.readFile(resolvedPath, 'utf-8');
  return parseConfigYaml(content);
}
