/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const SfdxTelemetry = sfdxCoreExports.SfdxTelemetry;

export class TelemetryService extends (SfdxTelemetry as {
  new (): any;
}) {
  private static instance: TelemetryService;

  public static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public initializeService(
    context: vscode.ExtensionContext,
    isTelemetryEnabled: boolean
  ): TelemetryReporter | undefined {
    this.setTelemetryEnabled(isTelemetryEnabled);
    return this.initializeReporter(context);
  }
}
