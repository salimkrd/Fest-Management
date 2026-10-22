/**
 * Administrative Bootstrap & User Provisioning CLI (Security Hardened)
 * 
 * Provides secure administrator initialization and team manager provisioning
 * without exposing public registration endpoints or exposing secrets in process arguments.
 * 
 * Secure Usage (Recommended):
 *   ADMIN_BOOTSTRAP_PASSWORD="..." ADMIN_BOOTSTRAP_SECRET="..." npx tsx scripts/bootstrapAdmin.ts --bootstrap-admin <email> [displayName]
 *   ADMIN_ID_TOKEN="..." TEAM_MANAGER_PASSWORD="..." npx tsx scripts/bootstrapAdmin.ts --provision-manager <email> <teamId> [displayName]
 * 
 * Or run interactively (will prompt for secrets with masked terminal input).
 */

import * as readline from 'readline';
import { AuthService } from '../src/services/authService';

/**
 * Prompts user for sensitive secret with masked input on TTY.
 */
function promptSecret(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    process.stdout.write(promptText);
    const stdin = process.stdin;
    const isTTY = stdin.isTTY;

    if (isTTY) {
      (stdin as any).setRawMode(true);
      stdin.resume();
      let input = '';

      const onData = (char: Buffer) => {
        const c = char.toString('utf8');
        if (c === '\n' || c === '\r' || c === '\u0004') {
          stdin.removeListener('data', onData);
          (stdin as any).setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (c === '\u0003') { // Ctrl+C
          process.exit(1);
        } else if (c === '\b' || c === '\x7f') { // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += c;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
    } else {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

/**
 * Resolves a secret from environment variable, interactive prompt, or legacy CLI argument.
 */
async function resolveSecret(envVarName: string, promptText: string, cliArg?: string): Promise<string> {
  if (process.env[envVarName]) {
    return process.env[envVarName]!;
  }
  if (cliArg) {
    console.warn(
      `[SECURITY WARNING] Passing sensitive credentials as CLI arguments exposes them in process listings and shell history.\nSet ${envVarName} or use interactive prompt instead.`
    );
    return cliArg;
  }
  return await promptSecret(promptText);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help') {
    console.log(`
Fest Management - Administrative User Provisioning CLI (Hardened)
================================================================
Usage:
  --bootstrap-admin <email> [displayName]
      Initializes the primary Chief Administrator account if none exists.
      Permanently locked after initial creation.
      Pass ADMIN_BOOTSTRAP_PASSWORD and ADMIN_BOOTSTRAP_SECRET via environment variables
      or enter them via secure interactive prompt.

  --provision-manager <email> <teamId> [displayName]
      Provisions a new Team Manager with strict teamId binding.
      Pass ADMIN_ID_TOKEN and TEAM_MANAGER_PASSWORD via environment variables
      or enter them via secure interactive prompt.
`);
    return;
  }

  if (command === '--bootstrap-admin') {
    if (args.length > 2) {
      console.error('Security Violation: Passing passwords or secrets as command line arguments is strictly prohibited.');
      console.error('Usage: --bootstrap-admin <email> [displayName]');
      process.exit(1);
    }

    const email = args[1];
    const displayName = args[2] || 'Chief Administrator';

    if (!email) {
      console.error('Error: Missing required email argument.');
      console.error('Usage: --bootstrap-admin <email> [displayName]');
      process.exit(1);
    }

    // Always require masked terminal input for password and bootstrap secret
    const password = await promptSecret(`Enter Administrator Password for ${email}: `);
    const secret = await promptSecret('Enter Secure Bootstrap Secret Key: ');

    if (!password || !secret) {
      console.error('Error: Password and bootstrap secret are required.');
      process.exit(1);
    }

    try {
      const res = await AuthService.bootstrapInitialAdmin({
        email,
        password,
        displayName,
        bootstrapSecret: secret
      });
      console.log('✔ Chief Administrator successfully provisioned:', res);
    } catch (err: any) {
      console.error('✖ Bootstrap failed:', err.message);
      process.exit(1);
    }
    return;
  }

  if (command === '--provision-manager') {
    let email = '';
    let teamId = '';
    let displayName = '';
    let legacyToken = '';
    let legacyPassword = '';

    if (args.length >= 6) {
      // Legacy argument syntax: --provision-manager <adminToken> <email> <password> <displayName> <teamId>
      [, legacyToken, email, legacyPassword, displayName, teamId] = args;
    } else {
      // Modern secure syntax: --provision-manager <email> <teamId> [displayName]
      [, email, teamId, displayName] = args;
      if (!displayName) displayName = `${teamId} Manager`;
    }

    if (!email || !teamId) {
      console.error('Error: Missing required arguments.');
      console.error('Usage: --provision-manager <email> <teamId> [displayName]');
      process.exit(1);
    }

    const adminToken = await resolveSecret(
      'ADMIN_ID_TOKEN',
      'Enter Authenticated Admin ID Token: ',
      legacyToken
    );

    const password = await resolveSecret(
      'TEAM_MANAGER_PASSWORD',
      `Enter Password for Team Manager (${email}): `,
      legacyPassword
    );

    if (!adminToken || !password) {
      console.error('Error: Admin ID token and manager password are required.');
      process.exit(1);
    }

    try {
      const res = await AuthService.provisionTeamManager(adminToken, {
        email,
        password,
        displayName,
        teamId
      });
      console.log('✔ Team Manager successfully provisioned:', res);
    } catch (err: any) {
      console.error('✖ Provisioning failed:', err.message);
      process.exit(1);
    }
    return;
  }

  console.error('Unknown command:', command);
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
