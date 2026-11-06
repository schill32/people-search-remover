import chalk from 'chalk';
import Table from 'cli-table3';
import { checkbox } from '@inquirer/prompts';
import readline from 'node:readline';
import type {
  SearchCandidate,
  StateRecord,
  Provider,
  TerminalUI as ITerminalUI,
} from './types.js';

export class TerminalUI implements ITerminalUI {
  public log(msg: string): void {
    console.log(msg);
  }

  public info(msg: string): void {
    console.log(chalk.cyan('ℹ ') + msg);
  }

  public success(msg: string): void {
    console.log(chalk.green('✔ ') + msg);
  }

  public warn(msg: string): void {
    console.log(chalk.yellow('⚠ ') + msg);
  }

  public error(msg: string): void {
    console.log(chalk.red('✖ ') + msg);
  }

  public showPin(pin: string, provider: string): void {
    const banner = [
      '',
      chalk.bgYellow.black.bold(' 📞 INCOMING VERIFICATION CALL: ' + provider.toUpperCase() + ' '),
      chalk.yellow('┌────────────────────────────────────────────────────────────┐'),
      chalk.yellow('│                                                            │'),
      chalk.yellow('│  An automated call from Whitepages is dialing your phone.  │'),
      chalk.yellow('│  Answer and enter this 4-digit PIN on your phone keypad:   │'),
      chalk.yellow('│                                                            │'),
      chalk.yellow('│              ') + chalk.bgWhite.black.bold(`    ${pin}    `) + chalk.yellow('              │'),
      chalk.yellow('│                                                            │'),
      chalk.yellow('└────────────────────────────────────────────────────────────┘'),
      '',
    ].join('\n');
    console.log(banner);
  }

  public showEmailNotice(email: string, provider: string): void {
    const banner = [
      '',
      chalk.bgCyan.black.bold(' ✉ OPT-OUT VERIFICATION EMAIL SENT: ' + provider.toUpperCase() + ' '),
      chalk.cyan('┌────────────────────────────────────────────────────────────┐'),
      chalk.cyan('│                                                            │'),
      chalk.cyan('│  A confirmation email was dispatched to:                   │'),
      chalk.cyan('│  ') + chalk.bold.white(email.padEnd(56)) + chalk.cyan('  │'),
      chalk.cyan('│                                                            │'),
      chalk.cyan('│  Please open your inbox and click the verification link    │'),
      chalk.cyan('│  to complete the suppression request!                      │'),
      chalk.cyan('│                                                            │'),
      chalk.cyan('└────────────────────────────────────────────────────────────┘'),
      '',
    ].join('\n');
    console.log(banner);
  }

  public async waitForKeypress(promptMessage = 'Press [Enter] to continue...'): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(chalk.magenta(`▶ ${promptMessage} `), () => {
        rl.close();
        resolve();
      });
    });
  }
}

/**
 * Renders a formatted CLI table of search candidate records.
 */
export function displayCandidatesTable(candidates: SearchCandidate[]): void {
  const table = new Table({
    head: [
      chalk.bold('Idx'),
      chalk.bold('Provider'),
      chalk.bold('Target Name'),
      chalk.bold('Matched Profile'),
      chalk.bold('Age'),
      chalk.bold('Locations'),
      chalk.bold('Relatives'),
    ],
    colWidths: [5, 14, 18, 22, 6, 26, 24],
    wordWrap: true,
  });

  candidates.forEach((c, idx) => {
    table.push([
      idx + 1,
      c.providerName,
      c.targetPerson,
      c.name,
      c.age ? String(c.age) : '-',
      c.locations.slice(0, 3).join(', ') || '-',
      c.relatives?.slice(0, 3).join(', ') || '-',
    ]);
  });

  console.log(table.toString());
}

/**
 * Interactive prompt allowing the user to select which profiles belong to their family.
 */
export async function promptSelectCandidates(
  candidates: SearchCandidate[]
): Promise<SearchCandidate[]> {
  if (candidates.length === 0) return [];

  const choices = candidates.map((c, index) => {
    const locs = c.locations.slice(0, 2).join('; ') || 'No location';
    const rels = c.relatives && c.relatives.length > 0 ? ` (Rel: ${c.relatives.slice(0, 2).join(', ')})` : '';
    const age = c.age ? ` [Age ${c.age}]` : '';

    return {
      name: `[${c.providerName}] ${c.name}${age} - ${locs}${rels}`,
      value: index,
      description: c.profileUrl,
    };
  });

  const selectedIndexes = await checkbox({
    message: 'Select the profiles that match your family to submit for removal (Space to toggle, Enter to confirm):',
    choices,
    pageSize: 15,
  });

  return selectedIndexes.map((i) => candidates[i]);
}

/**
 * Displays status table of tracked records from state.json
 */
export function displayStatusTable(records: StateRecord[]): void {
  if (records.length === 0) {
    console.log(chalk.gray('\nNo records currently tracked in state.json.\n'));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('Provider'),
      chalk.bold('Name'),
      chalk.bold('Location'),
      chalk.bold('Status'),
      chalk.bold('Last Attempt'),
      chalk.bold('Notes'),
    ],
    colWidths: [14, 20, 20, 16, 24, 30],
    wordWrap: true,
  });

  for (const r of records) {
    let coloredStatus: string = r.status;
    if (r.status === 'verified') coloredStatus = chalk.green.bold('VERIFIED');
    else if (r.status === 'submitted') coloredStatus = chalk.blue.bold('SUBMITTED');
    else if (r.status === 'requires_action') coloredStatus = chalk.yellow.bold('ACTION REQ');
    else if (r.status === 'failed') coloredStatus = chalk.red.bold('FAILED');
    else coloredStatus = chalk.gray('PENDING');

    table.push([
      r.providerName,
      r.name,
      r.location,
      coloredStatus,
      new Date(r.lastAttempt).toLocaleString(),
      r.notes || '-',
    ]);
  }

  console.log(table.toString());
}

/**
 * Displays registered providers and their details
 */
export function displayProvidersTable(providers: Provider[]): void {
  const table = new Table({
    head: [
      chalk.bold('Provider ID'),
      chalk.bold('Name'),
      chalk.bold('Network / Owner'),
      chalk.bold('Verification'),
      chalk.bold('Description'),
    ],
    colWidths: [16, 20, 22, 16, 45],
    wordWrap: true,
  });

  for (const p of providers) {
    table.push([
      chalk.cyan(p.id),
      p.name,
      p.network || 'Independent',
      p.verificationType.toUpperCase(),
      p.description,
    ]);
  }

  console.log(table.toString());
}
