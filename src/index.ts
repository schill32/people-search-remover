#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { StateManager } from './state.js';
import { launchBrowser } from './browser.js';
import {
  TerminalUI,
  displayCandidatesTable,
  promptSelectCandidates,
  displayStatusTable,
  displayProvidersTable,
} from './ui.js';
import { ProviderRegistry } from './providers/registry.js';
import { WhitepagesProvider } from './providers/whitepages/index.js';
import { SpokeoProvider } from './providers/spokeo/index.js';
import { BeenVerifiedProvider } from './providers/beenverified/index.js';
import { TruthFinderProvider } from './providers/peopleconnect/truthfinder.js';
import { InteliusProvider } from './providers/peopleconnect/intelius.js';
import { TruePeopleSearchProvider } from './providers/truepeoplesearch/index.js';
import { isLocationMatch } from './location.js';
import type { AppConfig, ProviderContext, SearchCandidate } from './types.js';

function buildRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new WhitepagesProvider());
  registry.register(new SpokeoProvider());
  registry.register(new TruePeopleSearchProvider());
  registry.register(new TruthFinderProvider());
  registry.register(new InteliusProvider());
  registry.register(new BeenVerifiedProvider());
  return registry;
}

const program = new Command();
const ui = new TerminalUI();

program
  .name('people-search-remover')
  .description('Interactive CLI utility to search and remove personal records from Whitepages, Spokeo, TruePeopleSearch, TruthFinder, Intelius, and BeenVerified')
  .version('1.0.0');

// Command: run (Default full interactive pipeline)
program
  .command('run', { isDefault: true })
  .description('Run interactive search and suppression pipeline')
  .option('-c, --config <path>', 'Path to YAML configuration file', 'config.yaml')
  .option('-p, --provider <id>', 'Run for a specific provider only (e.g. whitepages, spokeo)')
  .option('--dry-run', 'Search and review matching profiles only; do not submit suppression forms')
  .option('--headless', 'Run browser in headless mode (overrides config)')
  .action(async (options) => {
    let config: AppConfig;
    try {
      config = await loadConfig(options.config);
    } catch (err: unknown) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    if (options.headless) {
      config.browser.headless = true;
    }

    const registry = buildRegistry();
    const enabledProviders = options.provider
      ? registry.getEnabled([options.provider])
      : registry.getEnabled(config.enabled_providers);

    if (enabledProviders.length === 0) {
      ui.error(`No matching providers found for "${options.provider || 'enabled list'}".`);
      process.exit(1);
    }

    ui.log(chalk.bold.blue('\n======================================================'));
    ui.log(chalk.bold.blue('  PEOPLE SEARCH REMOVER - OPT-OUT PIPELINE'));
    ui.log(chalk.bold.blue('======================================================\n'));
    ui.info(`Loaded configuration with ${config.people.length} family member(s).`);
    ui.info(`Target providers: ${enabledProviders.map((p) => chalk.cyan(p.name)).join(', ')}`);

    const state = new StateManager();

    ui.info('Launching browser session...');
    const session = await launchBrowser(config);

    const ctx: ProviderContext = {
      page: session.page,
      browserContext: session.context,
      config,
      ui,
    };

    const discoveredCandidates: SearchCandidate[] = [];

    try {
      // 1. Search Phase
      ui.log(chalk.bold('\n--- Phase 1: Search & Discovery ---\n'));

      for (const person of config.people) {
        for (const loc of person.locations) {
          for (const provider of enabledProviders) {
            ui.info(`Querying ${chalk.cyan(provider.name)} for ${chalk.white.bold(person.name)} (${loc.city}, ${loc.state})...`);
            try {
              const matches = await provider.search(person, loc, ctx);
              for (const match of matches) {
                // Ensure candidate has verification email mapped from person or global config
                match.verificationEmail = person.verification_email || config.verification.email;

                // Ensure the result has a location that matches the query (or matched via exact email)
                if (!match.matchedEmail && !isLocationMatch(match.locations, loc.city, loc.state)) {
                  ui.log(
                    chalk.gray(
                      `  [Filtering out non-matching location: ${match.name} - ${match.locations.join(', ') || 'No location'}]`
                    )
                  );
                  continue;
                }

                // Check if already processed
                if (state.isAlreadyProcessed(provider.id, match.id)) {
                  ui.log(chalk.gray(`  [Skipping already processed: ${match.name} - ${match.profileUrl}]`));
                  continue;
                }
                if (!discoveredCandidates.some((c) => c.providerId === match.providerId && c.id === match.id)) {
                  discoveredCandidates.push(match);
                }
              }
            } catch (err: unknown) {
              ui.warn(`Error during ${provider.name} search: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }

      if (discoveredCandidates.length === 0) {
        ui.success('\nNo unsuppressed candidate profiles found across the target providers!');
        await session.close();
        return;
      }

      // 2. Review Phase
      ui.log(chalk.bold('\n--- Phase 2: Candidate Review ---\n'));
      displayCandidatesTable(discoveredCandidates);

      if (options.dryRun) {
        ui.info('\n--dry-run enabled: skipping suppression submissions.');
        await session.close();
        return;
      }

      const selected = await promptSelectCandidates(discoveredCandidates);

      if (selected.length === 0) {
        ui.info('No profiles selected for suppression. Exiting.');
        await session.close();
        return;
      }

      // 3. Suppression Phase
      ui.log(chalk.bold('\n--- Phase 3: Suppression Request Processing ---\n'));
      ui.info(`Starting suppression queue for ${selected.length} chosen profile(s)...\n`);

      for (let i = 0; i < selected.length; i++) {
        const candidate = selected[i];
        const provider = registry.get(candidate.providerId);
        if (!provider) continue;

        ui.log(chalk.bold(`[${i + 1}/${selected.length}] Processing ${candidate.providerName}: ${candidate.name}`));

        // Record initial pending state
        await state.recordCandidate({
          id: candidate.id,
          providerId: candidate.providerId,
          providerName: candidate.providerName,
          name: candidate.name,
          location: candidate.locations.join('; '),
          profileUrl: candidate.profileUrl,
        });

        const result = await provider.suppress(candidate, ctx);

        await state.updateStatus(
          candidate.providerId,
          candidate.id,
          result.status,
          result.actionDetails || result.message
        );

        if (result.status === 'verified' || result.status === 'submitted') {
          ui.success(`[${candidate.providerName}] ${result.message}`);
        } else if (result.status === 'requires_action') {
          ui.warn(`[${candidate.providerName}] ${result.message}`);
        } else {
          ui.error(`[${candidate.providerName}] ${result.message}`);
        }

        // Delay between queue items
        if (i < selected.length - 1) {
          ui.info('Pacing next submission (3s delay)...');
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      ui.log(chalk.bold.green('\n✔ Suppression requests completed!'));
      ui.info('Check `state.json` or run `npm run status` to view tracked records.');
    } finally {
      await session.close();
    }
  });

// Command: providers (List supported providers)
program
  .command('providers')
  .description('List all supported people search engines and their verification mechanisms')
  .action(() => {
    const registry = buildRegistry();
    ui.log(chalk.bold.blue('\nSupported Data Broker Providers:\n'));
    displayProvidersTable(registry.getAll());
    ui.log('');
  });

// Command: search (Scan only)
program
  .command('search')
  .description('Search all configured family members across providers without submitting opt-outs')
  .option('-c, --config <path>', 'Path to YAML configuration file', 'config.yaml')
  .option('-p, --provider <id>', 'Search a specific provider only')
  .action(async (options) => {
    // Delegate to run with --dry-run
    await program.parseAsync([
      process.argv[0],
      process.argv[1],
      'run',
      '--dry-run',
      ...(options.config ? ['--config', options.config] : []),
      ...(options.provider ? ['--provider', options.provider] : []),
    ]);
  });

// Command: suppress (Direct submission of known URL)
program
  .command('suppress <providerId> <url>')
  .description('Directly submit a specific known profile URL for suppression')
  .option('-c, --config <path>', 'Path to YAML configuration file', 'config.yaml')
  .action(async (providerId, url, options) => {
    const registry = buildRegistry();
    const provider = registry.get(providerId);
    if (!provider) {
      ui.error(`Unknown provider "${providerId}". Run "people-search-remover providers" to see valid IDs.`);
      process.exit(1);
    }

    const config = await loadConfig(options.config);
    const session = await launchBrowser(config);
    const state = new StateManager();

    const ctx: ProviderContext = {
      page: session.page,
      browserContext: session.context,
      config,
      ui,
    };

    try {
      const candidate: SearchCandidate = {
        providerId: provider.id,
        providerName: provider.name,
        id: url,
        targetPerson: 'Direct URL Request',
        name: 'Direct URL Request',
        locations: [],
        profileUrl: url,
      };

      await state.recordCandidate({
        id: url,
        providerId: provider.id,
        providerName: provider.name,
        name: 'Direct URL Request',
        location: '',
        profileUrl: url,
      });

      const result = await provider.suppress(candidate, ctx);
      await state.updateStatus(provider.id, url, result.status, result.actionDetails || result.message);

      if (result.status === 'submitted' || result.status === 'verified') {
        ui.success(result.message);
      } else {
        ui.warn(result.message);
      }
    } finally {
      await session.close();
    }
  });

// Command: status (View tracked records)
program
  .command('status')
  .description('Display status table of all tracked suppression requests from state.json')
  .option('-s, --state <path>', 'Path to state.json file', 'state.json')
  .action((options) => {
    const state = new StateManager(options.state);
    const records = state.getAllRecords();
    ui.log(chalk.bold.blue('\nTracked Suppression Requests:\n'));
    displayStatusTable(records);
    ui.log('');
  });

program.parse(process.argv);
