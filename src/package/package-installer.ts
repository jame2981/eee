// src/package/package-installer.ts

/**
 * Unified Package Installation Framework
 * 
 * Provides a base class that abstracts common installation patterns
 * and reduces code duplication across the pkgs directory.
 */

import { logger } from "../logger";
import { withLogging } from "../logging-utils";
import { ProgressTracker } from "./progress-tracker";
import { DependencyManager } from "./dependency-manager";
import { getCurrentUser, getUserHome } from "../user/user-env";
import { isCommandAvailable, checkPackageInstalled } from "../pkg-utils";

export interface PackageConfig {
  name: string;
  displayName: string;
  description?: string;
  version?: string;
  checkCommand?: string;
  dependencies?: string[];
  systemPackages?: string[];
  skipIfInstalled?: boolean;
}

export interface InstallationContext {
  user: string;
  userHome: string;
  isRoot: boolean;
  skipService?: boolean;
  containerMode?: boolean;
}

export interface InstallationResult {
  success: boolean;
  skipped: boolean;
  version?: string;
  message?: string;
  errors?: string[];
}

/**
 * Base class for all package installers
 * Provides common functionality and enforces consistent patterns
 */
export abstract class PackageInstaller {
  protected config: PackageConfig;
  protected context: InstallationContext;
  protected progress: ProgressTracker;
  protected dependencies: DependencyManager;

  constructor(config: PackageConfig) {
    this.config = config;
    this.context = this.createContext();
    this.progress = new ProgressTracker(config.displayName);
    this.dependencies = new DependencyManager();
  }

  /**
   * Main installation entry point
   */
  async install(): Promise<InstallationResult> {
    return await withLogging(
      { stepName: `Installing ${this.config.displayName}` },
      async () => {
        this.progress.start();
        
        try {
          // Check if already installed
          if (this.config.skipIfInstalled && await this.isAlreadyInstalled()) {
            this.progress.complete("Already installed");
            return { success: true, skipped: true };
          }

          // Install dependencies
          if (this.config.dependencies?.length) {
            await this.installDependencies();
          }

          // Install system packages
          if (this.config.systemPackages?.length) {
            await this.installSystemPackages();
          }

          // Execute main installation
          const result = await this.executeInstallation();
          
          // Post-installation setup
          await this.postInstallation();
          
          this.progress.complete("Installation completed");
          return result;
          
        } catch (error) {
          this.progress.fail(error.message);
          throw error;
        }
      }
    );
  }

  /**
   * Abstract methods that subclasses must implement
   */
  protected abstract executeInstallation(): Promise<InstallationResult>;

  /**
   * Optional hooks that subclasses can override
   */
  protected async preInstallation(): Promise<void> {
    // Override in subclasses if needed
  }

  protected async postInstallation(): Promise<void> {
    // Override in subclasses if needed
  }

  protected async isAlreadyInstalled(): Promise<boolean> {
    if (!this.config.checkCommand) return false;
    
    const { installed } = await checkPackageInstalled(this.config.checkCommand);
    return installed;
  }

  /**
   * Helper methods for common operations
   */
  protected async installDependencies(): Promise<void> {
    this.progress.updateStatus("Installing dependencies");
    await this.dependencies.installPackages(this.config.dependencies!);
  }

  protected async installSystemPackages(): Promise<void> {
    this.progress.updateStatus("Installing system packages");
    await this.dependencies.installSystemPackages(this.config.systemPackages!);
  }

  protected createContext(): InstallationContext {
    const user = getCurrentUser();
    return {
      user,
      userHome: getUserHome(user),
      isRoot: user === "root",
      skipService: process.env.EEE_SKIP_SERVICES === "1",
      containerMode: process.env.EEE_CONTAINER_MODE === "1"
    };
  }

  /**
   * Utility methods for common patterns
   */
  protected async ensureCommand(command: string, packageName?: string): Promise<boolean> {
    const available = await isCommandAvailable(command);
    if (!available && packageName) {
      logger.info(`Installing required command: ${command}`);
      await this.dependencies.installSystemPackages([packageName]);
      return await isCommandAvailable(command);
    }
    return available;
  }

  protected async validateInstallation(): Promise<boolean> {
    if (this.config.checkCommand) {
      return await this.isAlreadyInstalled();
    }
    return true;
  }
}

/**
 * Factory function to create package installers
 */
export function createPackageInstaller<T extends PackageInstaller>(
  installerClass: new (config: PackageConfig) => T,
  config: PackageConfig
): T {
  return new installerClass(config);
}
