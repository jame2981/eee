// src/package/templates/download-installer.ts

/**
 * Template for download-based package installations
 * 
 * Handles packages that need to be downloaded and installed from URLs
 */

import { PackageInstaller, PackageConfig, InstallationResult } from "../package-installer";
import { downloadFile, downloadGithubRelease } from "../../network/download-utils";
import { execBash, execCommand } from "../../shell/shell-executor";
import { logger } from "../../logger";
import path from "path";

export interface DownloadConfig extends PackageConfig {
  /** Download source configuration */
  download: {
    /** Download URL or GitHub release info */
    url?: string;
    github?: {
      repo: string;
      tag: string;
      asset: string;
    };
    /** Target filename */
    filename?: string;
    /** Download directory */
    downloadDir?: string;
  };
  /** Installation configuration */
  installation: {
    /** Installation type */
    type: 'script' | 'binary' | 'archive' | 'deb' | 'custom';
    /** Target installation directory */
    targetDir?: string;
    /** Binary name (for binary type) */
    binaryName?: string;
    /** Custom installation commands */
    commands?: string[];
    /** Make executable after download */
    makeExecutable?: boolean;
  };
  /** Verification configuration */
  verification?: {
    /** Command to verify installation */
    command: string;
    /** Expected output pattern */
    expectedOutput?: string;
  };
}

/**
 * Download-based package installer
 */
export class DownloadInstaller extends PackageInstaller {
  protected downloadConfig: DownloadConfig;
  private downloadedFile?: string;

  constructor(config: DownloadConfig) {
    super(config);
    this.downloadConfig = config;
    
    // Define installation steps
    this.progress.defineSteps([
      { name: "Download package", weight: 2 },
      { name: "Install package", weight: 2 },
      { name: "Verify installation", weight: 1 }
    ]);
  }

  protected async executeInstallation(): Promise<InstallationResult> {
    try {
      // Step 1: Download the package
      this.progress.nextStep();
      await this.downloadPackage();

      // Step 2: Install the package
      this.progress.nextStep();
      await this.installPackage();

      // Step 3: Verify installation
      if (this.downloadConfig.verification) {
        this.progress.nextStep();
        await this.verifyInstallation();
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

  private async downloadPackage(): Promise<void> {
    const { download } = this.downloadConfig;
    const downloadDir = download.downloadDir || "/tmp";
    
    let filename: string;
    let downloadUrl: string;

    if (download.github) {
      // GitHub release download
      const { repo, tag, asset } = download.github;
      filename = download.filename || asset;
      const targetPath = path.join(downloadDir, filename);
      
      this.progress.updateStatus(`Downloading from GitHub: ${repo}@${tag}/${asset}`);
      this.downloadedFile = await downloadGithubRelease(repo, tag, asset, {
        output: targetPath,
        onProgress: (downloaded, total, speed) => {
          const percent = Math.round((downloaded / total) * 100);
          this.progress.updateStatus(`Downloading: ${percent}% (${this.formatBytes(speed)}/s)`);
        }
      });
    } else if (download.url) {
      // Direct URL download
      downloadUrl = download.url;
      filename = download.filename || path.basename(downloadUrl);
      const targetPath = path.join(downloadDir, filename);
      
      this.progress.updateStatus(`Downloading from: ${downloadUrl}`);
      this.downloadedFile = await downloadFile(downloadUrl, {
        output: targetPath,
        onProgress: (downloaded, total, speed) => {
          const percent = Math.round((downloaded / total) * 100);
          this.progress.updateStatus(`Downloading: ${percent}% (${this.formatBytes(speed)}/s)`);
        }
      });
    } else {
      throw new Error("No download source specified");
    }

    // Make executable if requested
    if (this.downloadConfig.installation.makeExecutable) {
      await execCommand("chmod", ["+x", this.downloadedFile!]);
    }

    logger.success(`Downloaded: ${this.downloadedFile}`);
  }

  private async installPackage(): Promise<void> {
    if (!this.downloadedFile) {
      throw new Error("No file downloaded");
    }

    const { installation } = this.downloadConfig;
    const { type, targetDir, binaryName, commands } = installation;

    switch (type) {
      case 'script':
        this.progress.updateStatus("Executing installation script");
        await execBash(this.downloadedFile);
        break;

      case 'binary':
        const target = targetDir || "/usr/local/bin";
        const finalName = binaryName || path.basename(this.downloadedFile);
        const targetPath = path.join(target, finalName);
        
        this.progress.updateStatus(`Installing binary to: ${targetPath}`);
        await execCommand("sudo", ["cp", this.downloadedFile, targetPath]);
        await execCommand("sudo", ["chmod", "+x", targetPath]);
        break;

      case 'deb':
        this.progress.updateStatus("Installing .deb package");
        await execCommand("sudo", ["dpkg", "-i", this.downloadedFile]);
        break;

      case 'archive':
        const extractDir = targetDir || "/opt";
        this.progress.updateStatus(`Extracting to: ${extractDir}`);
        
        if (this.downloadedFile.endsWith('.tar.gz') || this.downloadedFile.endsWith('.tgz')) {
          await execCommand("sudo", ["tar", "-xzf", this.downloadedFile, "-C", extractDir]);
        } else if (this.downloadedFile.endsWith('.zip')) {
          await execCommand("sudo", ["unzip", this.downloadedFile, "-d", extractDir]);
        } else {
          throw new Error(`Unsupported archive format: ${this.downloadedFile}`);
        }
        break;

      case 'custom':
        if (commands) {
          for (const command of commands) {
            this.progress.updateStatus(`Running: ${command}`);
            await execBash(command.replace('${DOWNLOADED_FILE}', this.downloadedFile));
          }
        }
        break;

      default:
        throw new Error(`Unsupported installation type: ${type}`);
    }
  }

  private async verifyInstallation(): Promise<void> {
    const { verification } = this.downloadConfig;
    if (!verification) return;

    this.progress.updateStatus("Verifying installation");
    
    try {
      const result = await execBash(verification.command);
      
      if (verification.expectedOutput) {
        if (!result.includes(verification.expectedOutput)) {
          throw new Error(`Verification failed: expected "${verification.expectedOutput}" in output`);
        }
      }
      
      logger.success("Installation verified successfully");
    } catch (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

/**
 * Factory function for creating download installers
 */
export function createDownloadInstaller(config: DownloadConfig): DownloadInstaller {
  return new DownloadInstaller(config);
}

/**
 * Helper function for simple download installations
 */
export async function installFromDownload(config: DownloadConfig): Promise<InstallationResult> {
  const installer = createDownloadInstaller(config);
  return await installer.install();
}
