// src/utils.ts (最终修复版 - 强制写入)

import { spawn } from 'bun';
import { exists } from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger';

export async function run(cmd: string, args: string[], options: { cwd?: string; sudo?: boolean } = {}): Promise<void> {
    const commandToRun = options.sudo ? ['sudo', cmd, ...args] : [cmd, ...args];
    const displayCmd = commandToRun.join(' ');

    logger.info(`Executing: ${displayCmd}`);

    const proc = spawn(commandToRun, {
        cwd: options.cwd,
        stdio: ['inherit', 'inherit', 'inherit'],
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
        throw new Error(`Command "${displayCmd}" failed with exit code ${exitCode}`);
    }
}

export async function checkIfInstalled(checkCommand: string): Promise<boolean> {
  if (!checkCommand) return false;
  try {
    const proc = spawn(['sh', '-c', checkCommand], { stdout: 'ignore', stderr: 'ignore' });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch (error) { return false; }
}

export async function installAptPackage(packageName: string, sudo: boolean): Promise<void> {
  await run('apt-get', ['install', '-y', packageName], { sudo });
}

export async function installFlatpakPackage(packageName:string, sudo: boolean): Promise<void> {
  await run('flatpak', ['install', '--noninteractive', '-y', 'flathub', packageName], { sudo });
}

export async function runInstallScript(pkgPath: string, sudo: boolean): Promise<void> {
  const scriptPath = path.join(pkgPath, 'install.sh');
  await run('chmod', ['+x', scriptPath]); 
  await run(scriptPath, [], { cwd: pkgPath, sudo });
}

export async function runPreInstallHook(pkgPath: string, pkgName: string): Promise<void> {
  const hookPath = path.join(pkgPath, 'pre_install.ts');
  if (!(await exists(hookPath))) return;
  logger.info(`Running pre-install hook for [${pkgName}]...`);
  await run('bun', ['run', hookPath]);
}

export async function runPostInstallHook(pkgPath: string, pkgName: string): Promise<void> {
  const hookPath = path.join(pkgPath, 'post_install.ts');
  if (!(await exists(hookPath))) return;
  logger.info(`Running post-install hook for [${pkgName}]...`);
  await run('bun', ['run', hookPath]);
}