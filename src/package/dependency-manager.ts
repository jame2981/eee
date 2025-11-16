// src/package/dependency-manager.ts

/**
 * Smart Dependency Resolution Engine
 * 
 * Automatically handles package prerequisites and dependencies
 * with intelligent caching and conflict resolution.
 */

import { logger } from "../logger";
import { withLogging } from "../logging-utils";
import { aptInstall, isCommandAvailable, checkPackageInstalled } from "../pkg-utils";
import { execCommand } from "../shell/shell-executor";

export interface DependencyInfo {
  name: string;
  type: 'system' | 'command' | 'package';
  checkCommand?: string;
  installCommand?: string;
  systemPackage?: string;
  required: boolean;
  description?: string;
}

export interface DependencyResult {
  name: string;
  installed: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Manages package dependencies with smart resolution
 */
export class DependencyManager {
  private installedCache = new Set<string>();
  private failedCache = new Set<string>();

  /**
   * Install system packages with dependency resolution
   */
  async installSystemPackages(packages: string[]): Promise<DependencyResult[]> {
    return await withLogging(
      { stepName: `Installing system packages: ${packages.join(', ')}` },
      async () => {
        const results: DependencyResult[] = [];
        const toInstall: string[] = [];

        // Check which packages need installation
        for (const pkg of packages) {
          if (this.installedCache.has(pkg)) {
            results.push({ name: pkg, installed: true, skipped: true });
            continue;
          }

          if (this.failedCache.has(pkg)) {
            results.push({ name: pkg, installed: false, skipped: true, error: "Previously failed" });
            continue;
          }

          // Check if already installed
          const checkResult = await this.checkSystemPackage(pkg);
          if (checkResult.installed) {
            this.installedCache.add(pkg);
            results.push({ name: pkg, installed: true, skipped: true });
          } else {
            toInstall.push(pkg);
          }
        }

        // Install packages that need installation
        if (toInstall.length > 0) {
          try {
            await aptInstall(toInstall);
            
            // Mark as installed
            toInstall.forEach(pkg => {
              this.installedCache.add(pkg);
              results.push({ name: pkg, installed: true, skipped: false });
            });
          } catch (error) {
            // Mark as failed
            toInstall.forEach(pkg => {
              this.failedCache.add(pkg);
              results.push({ name: pkg, installed: false, skipped: false, error: error.message });
            });
            throw error;
          }
        }

        return results;
      }
    );
  }

  /**
   * Install packages with complex dependencies
   */
  async installPackages(dependencies: string[]): Promise<DependencyResult[]> {
    const results: DependencyResult[] = [];
    
    for (const dep of dependencies) {
      try {
        const result = await this.installSingleDependency(dep);
        results.push(result);
      } catch (error) {
        results.push({
          name: dep,
          installed: false,
          skipped: false,
          error: error.message
        });
        
        // Continue with other dependencies unless this is critical
        logger.warn(`⚠️ Failed to install dependency ${dep}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Resolve and install dependencies for a specific package type
   */
  async resolveDependencies(packageType: string, packageName: string): Promise<DependencyInfo[]> {
    const dependencies = this.getDependenciesForPackage(packageType, packageName);
    
    for (const dep of dependencies) {
      await this.ensureDependency(dep);
    }

    return dependencies;
  }

  /**
   * Check if a command is available and install if needed
   */
  async ensureCommand(command: string, systemPackage?: string): Promise<boolean> {
    if (await isCommandAvailable(command)) {
      return true;
    }

    if (systemPackage) {
      logger.info(`Installing required command: ${command} (package: ${systemPackage})`);
      await this.installSystemPackages([systemPackage]);
      return await isCommandAvailable(command);
    }

    return false;
  }

  /**
   * Get common dependencies for package types
   */
  private getDependenciesForPackage(packageType: string, packageName: string): DependencyInfo[] {
    const commonDeps: Record<string, DependencyInfo[]> = {
      'nodejs': [
        {
          name: 'curl',
          type: 'command',
          checkCommand: 'curl --version',
          systemPackage: 'curl',
          required: true,
          description: 'Required for downloading Node.js'
        },
        {
          name: 'build-essential',
          type: 'system',
          systemPackage: 'build-essential',
          required: true,
          description: 'Required for compiling native modules'
        }
      ],
      'python': [
        {
          name: 'curl',
          type: 'command',
          checkCommand: 'curl --version',
          systemPackage: 'curl',
          required: true,
          description: 'Required for downloading Python packages'
        },
        {
          name: 'build-essential',
          type: 'system',
          systemPackage: 'build-essential',
          required: true,
          description: 'Required for compiling Python packages'
        },
        {
          name: 'libssl-dev',
          type: 'system',
          systemPackage: 'libssl-dev',
          required: true,
          description: 'SSL development libraries'
        }
      ],
      'docker': [
        {
          name: 'ca-certificates',
          type: 'system',
          systemPackage: 'ca-certificates',
          required: true,
          description: 'Certificate authorities'
        },
        {
          name: 'gnupg',
          type: 'system',
          systemPackage: 'gnupg',
          required: true,
          description: 'GNU Privacy Guard'
        },
        {
          name: 'lsb-release',
          type: 'system',
          systemPackage: 'lsb-release',
          required: true,
          description: 'LSB release information'
        }
      ]
    };

    return commonDeps[packageType] || [];
  }

  /**
   * Install a single dependency
   */
  private async installSingleDependency(dependency: string): Promise<DependencyResult> {
    // Try to parse dependency string (e.g., "curl:curl", "build-essential")
    const [name, systemPackage] = dependency.includes(':') ? 
      dependency.split(':') : [dependency, dependency];

    if (this.installedCache.has(name)) {
      return { name, installed: true, skipped: true };
    }

    // Check if it's a command
    if (await isCommandAvailable(name)) {
      this.installedCache.add(name);
      return { name, installed: true, skipped: true };
    }

    // Try to install as system package
    try {
      await this.installSystemPackages([systemPackage]);
      return { name, installed: true, skipped: false };
    } catch (error) {
      throw new Error(`Failed to install dependency ${name}: ${error.message}`);
    }
  }

  /**
   * Ensure a specific dependency is available
   */
  private async ensureDependency(dep: DependencyInfo): Promise<void> {
    if (dep.type === 'command' && dep.checkCommand) {
      const available = await isCommandAvailable(dep.name);
      if (!available && dep.systemPackage) {
        await this.installSystemPackages([dep.systemPackage]);
      }
    } else if (dep.type === 'system' && dep.systemPackage) {
      await this.installSystemPackages([dep.systemPackage]);
    }
  }

  /**
   * Check if a system package is installed
   */
  private async checkSystemPackage(packageName: string): Promise<{ installed: boolean; version?: string }> {
    try {
      const result = await execCommand("dpkg", ["-s", packageName], { silent: true });
      if (result.includes("Status: install ok installed")) {
        // Extract version if available
        const versionMatch = result.match(/Version: (.+)/);
        return {
          installed: true,
          version: versionMatch ? versionMatch[1] : undefined
        };
      }
    } catch {
      // Package not installed
    }
    
    return { installed: false };
  }

  /**
   * Clear caches (useful for testing or forced reinstalls)
   */
  clearCache(): void {
    this.installedCache.clear();
    this.failedCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { installed: number; failed: number } {
    return {
      installed: this.installedCache.size,
      failed: this.failedCache.size
    };
  }
}
