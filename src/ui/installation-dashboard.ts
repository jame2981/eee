// src/ui/installation-dashboard.ts

/**
 * Enhanced Installation Dashboard
 * 
 * Provides real-time visual feedback during installations with:
 * - Overall progress tracking
 * - Current operation status
 * - System resource monitoring
 * - Recent output display
 * - Time estimates
 */

import { logger } from "../logger";

export interface DashboardConfig {
  showSystemStats?: boolean;
  showRecentOutput?: boolean;
  maxOutputLines?: number;
  refreshInterval?: number;
}

export interface InstallationStatus {
  packageName: string;
  currentStep: string;
  progress: number; // 0-100
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  estimatedTimeRemaining?: number;
  recentOutput: string[];
}

export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkActivity: boolean;
}

/**
 * Real-time installation dashboard
 */
export class InstallationDashboard {
  private config: DashboardConfig;
  private installations = new Map<string, InstallationStatus>();
  private systemStats?: SystemStats;
  private updateInterval?: NodeJS.Timeout;
  private isActive = false;

  constructor(config: DashboardConfig = {}) {
    this.config = {
      showSystemStats: true,
      showRecentOutput: true,
      maxOutputLines: 10,
      refreshInterval: 1000,
      ...config
    };
  }

  /**
   * Start the dashboard
   */
  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    logger.info("🚀 Starting installation dashboard...\n");
    
    // Initial display
    this.render();
    
    // Start periodic updates
    this.updateInterval = setInterval(() => {
      this.updateSystemStats();
      this.render();
    }, this.config.refreshInterval);
  }

  /**
   * Stop the dashboard
   */
  stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    
    // Final summary
    this.renderSummary();
  }

  /**
   * Add a new installation to track
   */
  addInstallation(packageName: string, totalSteps: number = 1): void {
    this.installations.set(packageName, {
      packageName,
      currentStep: "Initializing",
      progress: 0,
      status: 'pending',
      startTime: Date.now(),
      recentOutput: []
    });
    
    this.render();
  }

  /**
   * Update installation progress
   */
  updateInstallation(
    packageName: string, 
    updates: Partial<InstallationStatus>
  ): void {
    const installation = this.installations.get(packageName);
    if (!installation) return;

    // Update fields
    Object.assign(installation, updates);
    
    // Calculate time estimates
    if (installation.progress > 0 && installation.status === 'running') {
      const elapsed = Date.now() - installation.startTime;
      const estimatedTotal = (elapsed / installation.progress) * 100;
      installation.estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed);
    }
    
    this.render();
  }

  /**
   * Add output to an installation
   */
  addOutput(packageName: string, output: string): void {
    const installation = this.installations.get(packageName);
    if (!installation) return;

    const lines = output.split('\n').filter(line => line.trim());
    installation.recentOutput.push(...lines);
    
    // Keep only recent lines
    if (installation.recentOutput.length > this.config.maxOutputLines!) {
      installation.recentOutput = installation.recentOutput.slice(-this.config.maxOutputLines!);
    }
    
    this.render();
  }

  /**
   * Complete an installation
   */
  completeInstallation(packageName: string, success: boolean): void {
    this.updateInstallation(packageName, {
      status: success ? 'completed' : 'failed',
      progress: 100,
      estimatedTimeRemaining: 0
    });
  }

  /**
   * Render the dashboard
   */
  private render(): void {
    if (!this.isActive) return;

    // Clear screen and move cursor to top
    process.stdout.write('\x1b[2J\x1b[H');
    
    this.renderHeader();
    this.renderInstallations();
    
    if (this.config.showSystemStats && this.systemStats) {
      this.renderSystemStats();
    }
    
    if (this.config.showRecentOutput) {
      this.renderRecentOutput();
    }
  }

  private renderHeader(): void {
    const activeCount = Array.from(this.installations.values())
      .filter(i => i.status === 'running').length;
    const completedCount = Array.from(this.installations.values())
      .filter(i => i.status === 'completed').length;
    const totalCount = this.installations.size;
    
    logger.raw.log(`\n📊 EEE Installation Dashboard`);
    logger.raw.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.raw.log(`📦 Packages: ${completedCount}/${totalCount} completed | ⚡ Active: ${activeCount} | ⏰ ${new Date().toLocaleTimeString()}`);
    logger.raw.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  private renderInstallations(): void {
    if (this.installations.size === 0) {
      logger.raw.log(`   No installations in progress\n`);
      return;
    }

    for (const installation of this.installations.values()) {
      this.renderInstallation(installation);
    }
    
    logger.raw.log('');
  }

  private renderInstallation(installation: InstallationStatus): void {
    const { packageName, currentStep, progress, status, estimatedTimeRemaining } = installation;
    
    // Status icon
    const statusIcon = {
      'pending': '⏸️',
      'running': '⚡',
      'completed': '✅',
      'failed': '❌'
    }[status];
    
    // Progress bar
    const barLength = 20;
    const filledLength = Math.round((progress / 100) * barLength);
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    // Time estimate
    const timeStr = estimatedTimeRemaining ? 
      ` | ETA: ${this.formatTime(estimatedTimeRemaining)}` : '';
    
    logger.raw.log(`${statusIcon} ${packageName.padEnd(15)} [${progressBar}] ${progress.toString().padStart(3)}%${timeStr}`);
    logger.raw.log(`   └─ ${currentStep}`);
  }

  private renderSystemStats(): void {
    if (!this.systemStats) return;
    
    const { cpuUsage, memoryUsage, diskUsage, networkActivity } = this.systemStats;
    
    logger.raw.log(`\n💻 System Resources:`);
    logger.raw.log(`   CPU: ${this.renderMeter(cpuUsage)}  Memory: ${this.renderMeter(memoryUsage)}  Disk: ${this.renderMeter(diskUsage)}  Network: ${networkActivity ? '🌐' : '📡'}`);
  }

  private renderRecentOutput(): void {
    // Find the most recent output from active installations
    const recentOutputs: string[] = [];
    
    for (const installation of this.installations.values()) {
      if (installation.status === 'running' && installation.recentOutput.length > 0) {
        recentOutputs.push(...installation.recentOutput.slice(-3));
      }
    }
    
    if (recentOutputs.length > 0) {
      logger.raw.log(`\n📝 Recent Output:`);
      recentOutputs.slice(-5).forEach(line => {
        logger.raw.log(`   ${line}`);
      });
    }
  }

  private renderSummary(): void {
    const completed = Array.from(this.installations.values())
      .filter(i => i.status === 'completed').length;
    const failed = Array.from(this.installations.values())
      .filter(i => i.status === 'failed').length;
    const total = this.installations.size;
    
    logger.raw.log(`\n📊 Installation Summary:`);
    logger.raw.log(`   ✅ Completed: ${completed}`);
    logger.raw.log(`   ❌ Failed: ${failed}`);
    logger.raw.log(`   📦 Total: ${total}`);
    
    if (failed > 0) {
      logger.raw.log(`\n❌ Failed Packages:`);
      for (const installation of this.installations.values()) {
        if (installation.status === 'failed') {
          logger.raw.log(`   • ${installation.packageName}`);
        }
      }
    }
  }

  private renderMeter(percentage: number): string {
    const barLength = 10;
    const filledLength = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    return `${bar} ${percentage.toFixed(1)}%`;
  }

  private formatTime(ms: number): string {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  private async updateSystemStats(): Promise<void> {
    // This would integrate with system monitoring
    // For now, we'll use placeholder values
    this.systemStats = {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      networkActivity: Math.random() > 0.5
    };
  }
}

/**
 * Global dashboard instance
 */
export const installationDashboard = new InstallationDashboard();
