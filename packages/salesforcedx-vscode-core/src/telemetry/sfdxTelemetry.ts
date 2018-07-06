/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

export abstract class SfdxTelemetry {
  protected context: ExtensionContext | undefined;
  private reporter: TelemetryReporter | undefined;
  private telemetryEnabled: boolean;

  constructor() {
    this.telemetryEnabled = false;
  }

  protected initializeReporter(
    context: ExtensionContext
  ): TelemetryReporter | undefined {
    this.context = context;

    // TelemetryReporter is not initialized if user has disabled telemetry setting.
    if (this.reporter === undefined && this.isTelemetryEnabled()) {
      const extensionPackage = require(this.context.asAbsolutePath(
        './package.json'
      ));

      this.reporter = new TelemetryReporter(
        extensionPackage.name,
        extensionPackage.version,
        extensionPackage.aiKey
      );
      this.context.subscriptions.push(this.reporter);
    }

    return this.reporter;
  }

  public isTelemetryEnabled(): boolean {
    return this.telemetryEnabled;
  }

  protected setTelemetryEnabled(isTelemetryEnabled: boolean): void {
    this.telemetryEnabled = isTelemetryEnabled;
  }

  public sendExtensionActivationEvent(): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled()) {
      this.reporter.sendTelemetryEvent('activationEvent');
    }
  }

  public sendExtensionDeactivationEvent(): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled()) {
      this.reporter.sendTelemetryEvent('deactivationEvent');
    }
  }

  public sendCommandEvent(commandName: string): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled()) {
      this.reporter.sendTelemetryEvent('commandExecution', { commandName });
    }
  }

  public dispose(): void {
    if (this.reporter !== undefined) {
      this.reporter.dispose();
    }
  }
}
