// src/package/templates/apt-package-installer.ts

/**
 * Template for simple APT package installations
 * 
 * Reduces typical APT package installers from 30-50 lines to 5-10 lines
 */

import { PackageInstaller, PackageConfig, InstallationResult } from "../package-installer";
import { aptInstall, checkPackageInstalled } from "../../pkg-utils";
import { logger } from "../../logger";

export interface AptPackageConfig extends PackageConfig {
  /** APT package names to install */
  aptPackages: string[];
  /** Additional repositories to add before installation */
  repositories?: Array<{
    key?: string;
    repo: string;
    keyserver?: string;
  }>;
  /** Services to enable/start after installation */
  services?: string[];
  /** User groups to add current user to */
  userGroups?: string[];
  /** Post-installation commands */
  postCommands?: string[];
}

/**
 * Simplified APT package installer
 * 
 * Handles the most common APT installation patterns:
 * - Repository setup
 * - Package installation
 * - Service management
 * - User group management
 */
export class AptPackageInstaller extends PackageInstaller {
  protected aptConfig: AptPackageConfig;

  constructor(config: AptPackageConfig) {
    super(config);
    this.aptConfig = config;
    
    // Define installation steps for progress tracking
    this.progress.defineSteps([
      { name: "Setup repositories", weight: 1 },
      { name: "Install packages", weight: 3 },
      { name: "Configure services", weight: 1 },
      { name: "Setup user permissions", weight: 1 }
    ]);
  }

  protected async executeInstallation(): Promise<InstallationResult> {
    try {
      // Step 1: Setup repositories
      if (this.aptConfig.repositories?.length) {
        this.progress.nextStep();
        await this.setupRepositories();
      }

      // Step 2: Install APT packages
      this.progress.nextStep();
      await this.installAptPackages();

      // Step 3: Configure services
      if (this.aptConfig.services?.length && !this.context.skipService) {
        this.progress.nextStep();
        await this.configureServices();
      }

      // Step 4: Setup user permissions
      if (this.aptConfig.userGroups?.length) {
        this.progress.nextStep();
        await this.setupUserGroups();
      }

      // Step 5: Run post-installation commands
      if (this.aptConfig.postCommands?.length) {
        this.progress.nextStep("Running post-installation commands");
        await this.runPostCommands();
      }

      return {
        success: true,
        skipped: false,
        message: `${this.config.displayName} installed successfully`
      };

    } catch (error) {
      return {
        success: false,
        skipped: false,
        errors: [error.message]
      };
    }
  }

  protected async isAlreadyInstalled(): Promise<boolean> {
    // Check if all required packages are installed
    for (const pkg of this.aptConfig.aptPackages) {
      const { installed } = await checkPackageInstalled(`dpkg -s ${pkg}`);
      if (!installed) {
        return false;
      }
    }
    return true;
  }

  private async setupRepositories(): Promise<void> {
    const { addGpgKey, addRepository } = await import("../../pkg-utils");
    
    for (const repo of this.aptConfig.repositories!) {
      if (repo.key) {
        this.progress.updateStatus(`Adding GPG key for ${repo.repo}`);
        await addGpgKey(repo.key, this.config.name);
      }
      
      this.progress.updateStatus(`Adding repository: ${repo.repo}`);
      await addRepository(repo.repo, this.config.name);
    }
  }

  private async installAptPackages(): Promise<void> {
    this.progress.updateStatus(`Installing packages: ${this.aptConfig.aptPackages.join(', ')}`);
    await aptInstall(this.aptConfig.aptPackages);
  }

  private async configureServices(): Promise<void> {
    const { enableService, startService } = await import("../../pkg-utils");
    
    for (const service of this.aptConfig.services!) {
      this.progress.updateStatus(`Configuring service: ${service}`);
      await enableService(service);
      await startService(service);
    }
  }

  private async setupUserGroups(): Promise<void> {
    const { addUserToGroup } = await import("../../pkg-utils");
    
    for (const group of this.aptConfig.userGroups!) {
      this.progress.updateStatus(`Adding user to group: ${group}`);
      await addUserToGroup(this.context.user, group);
    }
  }

  private async runPostCommands(): Promise<void> {
    const { execBash } = await import("../../shell/shell-executor");
    
    for (const command of this.aptConfig.postCommands!) {
      this.progress.updateStatus(`Running: ${command}`);
      await execBash(command);
    }
  }
}

/**
 * Factory function for creating APT package installers
 */
export function createAptPackageInstaller(config: AptPackageConfig): AptPackageInstaller {
  return new AptPackageInstaller(config);
}

/**
 * Helper function for simple APT package installations
 */
export async function installAptPackage(config: AptPackageConfig): Promise<InstallationResult> {
  const installer = createAptPackageInstaller(config);
  return await installer.install();
}
