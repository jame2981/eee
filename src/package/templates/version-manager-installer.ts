// src/package/templates/version-manager-installer.ts

/**
 * Template for version manager installations (NVM, UV, Goup, etc.)
 * 
 * Simplifies the complex version manager installation patterns
 */

import { PackageInstaller, PackageConfig, InstallationResult } from "../package-installer";
import { downloadFile } from "../../network/download-utils";
import { runAsUserScript } from "../../shell/script-executor";
import { initializeEeeEnv, insertPath, addEnvironmentVariable } from "../../env-utils";
import { logger } from "../../logger";

export interface VersionManagerConfig extends PackageConfig {
  /** Version manager configuration */
  manager: {
    /** Manager name (nvm, uv, goup, etc.) */
    name: string;
    /** Installation script URL */
    installUrl: string;
    /** Installation directory */
    installDir: string;
    /** Binary paths to add to PATH */
    binPaths: string[];
    /** Environment variables to set */
    envVars?: Record<string, string>;
    /** Source script path */
    sourceScript?: string;
  };
  /** Target language/runtime configuration */
  target: {
    /** Language name (node, python, go) */
    language: string;
    /** Version to install */
    version: string;
    /** Installation command template */
    installCommand: string;
    /** Verification command */
    verifyCommand: string;
  };
}

/**
 * Version manager installer template
 */
export class VersionManagerInstaller extends PackageInstaller {
  protected vmConfig: VersionManagerConfig;

  constructor(config: VersionManagerConfig) {
    super(config);
    this.vmConfig = config;
    
    // Define installation steps
    this.progress.defineSteps([
      { name: `Install ${config.manager.name}`, weight: 2 },
      { name: `Install ${config.target.language} ${config.target.version}`, weight: 3 },
      { name: "Configure environment", weight: 1 },
      { name: "Verify installation", weight: 1 }
    ]);
  }

  protected async executeInstallation(): Promise<InstallationResult> {
    try {
      // Step 1: Install version manager
      this.progress.nextStep();
      await this.installVersionManager();

      // Step 2: Install target language/runtime
      this.progress.nextStep();
      await this.installTargetVersion();

      // Step 3: Configure environment
      this.progress.nextStep();
      await this.configureEnvironment();

      // Step 4: Verify installation
      this.progress.nextStep();
      await this.verifyInstallation();

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
    try {
      // Check if version manager is installed
      const checkScript = `
        if [ -d "${this.vmConfig.manager.installDir}" ]; then
          echo "MANAGER_INSTALLED"
        else
          echo "MANAGER_NOT_INSTALLED"
        fi
      `;
      
      const result = await runAsUserScript(checkScript, this.context.user);
      return result.trim() === "MANAGER_INSTALLED";
    } catch {
      return false;
    }
  }

  private async installVersionManager(): Promise<void> {
    const { manager } = this.vmConfig;
    
    // Check if already installed
    if (await this.isAlreadyInstalled()) {
      this.progress.updateStatus(`${manager.name} already installed`);
      return;
    }

    this.progress.updateStatus(`Downloading ${manager.name} installer`);
    
    // Download and execute installation script
    const installScript = await downloadFile(manager.installUrl, {
      onProgress: (downloaded, total, speed) => {
        const percent = Math.round((downloaded / total) * 100);
        this.progress.updateStatus(`Downloading installer: ${percent}%`);
      }
    });

    this.progress.updateStatus(`Installing ${manager.name}`);
    await runAsUserScript(installScript, this.context.user);
    
    logger.success(`${manager.name} installed to ${manager.installDir}`);
  }

  private async installTargetVersion(): Promise<void> {
    const { manager, target } = this.vmConfig;
    
    this.progress.updateStatus(`Installing ${target.language} ${target.version}`);
    
    // Build installation script
    const installScript = `
      # Load version manager
      export ${manager.name.toUpperCase()}_DIR="${manager.installDir}"
      ${manager.sourceScript ? `[ -s "${manager.sourceScript}" ] && source "${manager.sourceScript}"` : ''}
      
      # Add manager to PATH
      ${manager.binPaths.map(path => `export PATH="${path}:$PATH"`).join('\n')}
      
      # Install target version
      ${target.installCommand.replace('${VERSION}', target.version)}
    `;

    const result = await runAsUserScript(installScript, this.context.user);
    this.progress.addOutput(result);
    
    logger.success(`${target.language} ${target.version} installed`);
  }

  private async configureEnvironment(): Promise<void> {
    const { manager } = this.vmConfig;
    
    this.progress.updateStatus("Configuring environment variables");
    
    // Initialize EEE environment
    await initializeEeeEnv();
    
    // Add binary paths
    for (const binPath of manager.binPaths) {
      await insertPath(binPath, `${manager.name} - ${this.config.displayName}`);
    }
    
    // Add environment variables
    if (manager.envVars) {
      for (const [key, value] of Object.entries(manager.envVars)) {
        await addEnvironmentVariable(key, value, `${manager.name} environment`);
      }
    }
    
    logger.success("Environment configured");
  }

  private async verifyInstallation(): Promise<void> {
    const { manager, target } = this.vmConfig;
    
    this.progress.updateStatus("Verifying installation");
    
    const verifyScript = `
      # Load version manager
      export ${manager.name.toUpperCase()}_DIR="${manager.installDir}"
      ${manager.sourceScript ? `[ -s "${manager.sourceScript}" ] && source "${manager.sourceScript}"` : ''}
      
      # Add manager to PATH
      ${manager.binPaths.map(path => `export PATH="${path}:$PATH"`).join('\n')}
      
      # Verify installation
      ${target.verifyCommand}
    `;

    try {
      const result = await runAsUserScript(verifyScript, this.context.user);
      this.progress.addOutput(result);
      logger.success("Installation verified successfully");
    } catch (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
  }
}

/**
 * Factory function for creating version manager installers
 */
export function createVersionManagerInstaller(config: VersionManagerConfig): VersionManagerInstaller {
  return new VersionManagerInstaller(config);
}

/**
 * Helper function for simple version manager installations
 */
export async function installVersionManager(config: VersionManagerConfig): Promise<InstallationResult> {
  const installer = createVersionManagerInstaller(config);
  return await installer.install();
}
