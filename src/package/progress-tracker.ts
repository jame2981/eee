// src/package/progress-tracker.ts

/**
 * Real-time Progress Tracking System
 * 
 * Provides visual feedback for long-running operations with:
 * - Progress bars for downloads and installations
 * - Real-time status updates
 * - Recent output display
 * - Time estimation
 */

import { logger } from "../logger";

export interface ProgressOptions {
  showPercentage?: boolean;
  showTimeEstimate?: boolean;
  showRecentOutput?: boolean;
  maxRecentLines?: number;
}

export interface ProgressStep {
  name: string;
  weight: number; // Relative weight for progress calculation
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  output?: string[];
}

/**
 * Progress tracker for package installations and long-running operations
 */
export class ProgressTracker {
  private packageName: string;
  private steps: ProgressStep[] = [];
  private currentStepIndex: number = -1;
  private startTime: number = 0;
  private options: ProgressOptions;
  private recentOutput: string[] = [];
  private updateInterval?: NodeJS.Timeout;

  constructor(packageName: string, options: ProgressOptions = {}) {
    this.packageName = packageName;
    this.options = {
      showPercentage: true,
      showTimeEstimate: true,
      showRecentOutput: true,
      maxRecentLines: 5,
      ...options
    };
  }

  /**
   * Define the steps for this installation
   */
  defineSteps(steps: Array<{ name: string; weight?: number }>): void {
    this.steps = steps.map(step => ({
      name: step.name,
      weight: step.weight || 1,
      status: 'pending',
      output: []
    }));
  }

  /**
   * Start the progress tracking
   */
  start(): void {
    this.startTime = Date.now();
    logger.step(`🚀 Installing ${this.packageName}`);
    
    if (this.steps.length > 0) {
      this.displayStepsOverview();
    }
    
    // Start periodic updates for long-running operations
    this.updateInterval = setInterval(() => {
      this.displayCurrentStatus();
    }, 2000);
  }

  /**
   * Move to the next step
   */
  nextStep(stepName?: string): void {
    // Complete current step
    if (this.currentStepIndex >= 0) {
      this.steps[this.currentStepIndex].status = 'completed';
      this.steps[this.currentStepIndex].endTime = Date.now();
    }

    // Start next step
    this.currentStepIndex++;
    
    if (this.currentStepIndex < this.steps.length) {
      const step = this.steps[this.currentStepIndex];
      step.status = 'running';
      step.startTime = Date.now();
      
      const progress = this.calculateProgress();
      logger.info(`📋 [${progress}%] ${step.name}...`);
    } else if (stepName) {
      // Ad-hoc step not in predefined list
      logger.info(`📋 ${stepName}...`);
    }
  }

  /**
   * Update status of current operation
   */
  updateStatus(status: string, showProgress: boolean = true): void {
    if (showProgress && this.steps.length > 0) {
      const progress = this.calculateProgress();
      logger.info(`  ⏳ [${progress}%] ${status}`);
    } else {
      logger.info(`  ⏳ ${status}`);
    }
  }

  /**
   * Add output from a command or operation
   */
  addOutput(output: string): void {
    const lines = output.split('\n').filter(line => line.trim());
    
    // Add to recent output buffer
    this.recentOutput.push(...lines);
    if (this.recentOutput.length > this.options.maxRecentLines!) {
      this.recentOutput = this.recentOutput.slice(-this.options.maxRecentLines!);
    }

    // Add to current step output
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      const step = this.steps[this.currentStepIndex];
      step.output = step.output || [];
      step.output.push(...lines);
    }

    // Display recent output if enabled
    if (this.options.showRecentOutput && lines.length > 0) {
      lines.forEach(line => {
        if (line.trim()) {
          logger.info(`    ${line.trim()}`);
        }
      });
    }
  }

  /**
   * Mark current step as failed
   */
  fail(error: string): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      this.steps[this.currentStepIndex].status = 'failed';
      this.steps[this.currentStepIndex].endTime = Date.now();
    }

    const elapsed = this.getElapsedTime();
    logger.error(`❌ ${this.packageName} installation failed after ${elapsed}: ${error}`);
    
    this.displayFailureSummary();
  }

  /**
   * Mark installation as complete
   */
  complete(message?: string): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Complete current step
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      this.steps[this.currentStepIndex].status = 'completed';
      this.steps[this.currentStepIndex].endTime = Date.now();
    }

    const elapsed = this.getElapsedTime();
    const finalMessage = message || "Installation completed";
    logger.success(`✅ ${this.packageName} ${finalMessage} (${elapsed})`);
    
    if (this.options.showTimeEstimate) {
      this.displayTimingSummary();
    }
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateProgress(): number {
    if (this.steps.length === 0) return 0;

    let totalWeight = 0;
    let completedWeight = 0;

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      totalWeight += step.weight;
      
      if (step.status === 'completed') {
        completedWeight += step.weight;
      } else if (step.status === 'running' && i === this.currentStepIndex) {
        // Assume current step is 50% complete
        completedWeight += step.weight * 0.5;
      }
    }

    return Math.round((completedWeight / totalWeight) * 100);
  }

  private displayStepsOverview(): void {
    logger.info(`📋 Installation plan (${this.steps.length} steps):`);
    this.steps.forEach((step, index) => {
      logger.info(`  ${index + 1}. ${step.name}`);
    });
    logger.info("");
  }

  private displayCurrentStatus(): void {
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      const step = this.steps[this.currentStepIndex];
      const elapsed = step.startTime ? Date.now() - step.startTime : 0;
      
      if (elapsed > 10000) { // Show status for operations longer than 10 seconds
        const progress = this.calculateProgress();
        logger.info(`  ⏳ [${progress}%] Still working on: ${step.name} (${Math.round(elapsed/1000)}s)`);
      }
    }
  }

  private displayFailureSummary(): void {
    logger.info("\n📊 Installation Summary:");
    this.steps.forEach((step, index) => {
      const status = step.status === 'completed' ? '✅' : 
                    step.status === 'failed' ? '❌' : 
                    step.status === 'running' ? '⏳' : '⏸️';
      logger.info(`  ${status} ${step.name}`);
    });
  }

  private displayTimingSummary(): void {
    if (this.steps.length === 0) return;

    logger.info("\n⏱️  Timing Summary:");
    this.steps.forEach(step => {
      if (step.startTime && step.endTime) {
        const duration = step.endTime - step.startTime;
        logger.info(`  ${step.name}: ${Math.round(duration/1000)}s`);
      }
    });
  }

  private getElapsedTime(): string {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.round(elapsed / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
  }
}
