/**
 * Shared CLI Helper Utilities for FieldOps IT Setup Scripts
 */

import readline from 'readline';
import dotenv from 'dotenv';
import { SystemSetupService } from '../services/systemSetupService';

export interface ParsedCliArgs {
  flags: Record<string, string | boolean>;
  positional: string[];
}

export function loadLocalEnv(): void {
  dotenv.config({ path: SystemSetupService.getEnvFilePath(), quiet: true });
}

export function parseCliArgs(argv: string[] = process.argv.slice(2)): ParsedCliArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
      continue;
    }

    if (arg.startsWith('--')) {
      const stripped = arg.slice(2);
      const eqIdx = stripped.indexOf('=');
      if (eqIdx !== -1) {
        const key = stripped.slice(0, eqIdx).trim();
        const val = stripped.slice(eqIdx + 1);
        flags[key] = val;
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[stripped] = next;
          i++;
        } else {
          flags[stripped] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

export function printBanner(title: string, subtitle?: string): void {
  console.log('================================================================');
  console.log(`  FIELDOPS IT - ${title}`);
  if (subtitle) {
    console.log(`  ${subtitle}`);
  }
  console.log('================================================================\n');
}

export async function promptText(question: string, defaultValue = ''): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed !== '' ? trimmed : defaultValue);
    });
  });
}

export async function promptSecret(question: string, hasExisting: boolean): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const hint = hasExisting ? ' (kosongkan untuk pertahankan nilai saat ini)' : '';
  return new Promise((resolve) => {
    rl.question(`${question}${hint}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const label = defaultYes ? '(Y/n)' : '(y/N)';
  return new Promise((resolve) => {
    rl.question(`${question} ${label}: `, (answer) => {
      rl.close();
      const clean = answer.trim().toLowerCase();
      if (!clean) return resolve(defaultYes);
      resolve(clean === 'y' || clean === 'yes' || clean === 'ya');
    });
  });
}
