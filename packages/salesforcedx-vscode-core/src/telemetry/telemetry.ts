/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext, window } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { nls } from '../messages';
import { sfdxCoreSettings } from '../settings';
import { SfdxTelemetry } from './sfdxTelemetry';

const TELEMETRY_GLOBAL_VALUE = 'sfdxTelemetryMessage14'; // TODO: this will change until dev process of the feature is done.

export class TelemetryService extends SfdxTelemetry {
  private static instance: TelemetryService;

  public static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public initializeService(
    context: ExtensionContext
  ): TelemetryReporter | undefined {
    this.setTelemetryEnabled(sfdxCoreSettings.getTelemetryEnabled());
    return this.initializeReporter(context);
  }

  private getHasTelemetryMessageBeenShown(): boolean {
    if (this.context === undefined) {
      return true;
    }

    const sfdxTelemetryState = this.context.globalState.get(
      TELEMETRY_GLOBAL_VALUE
    );

    return typeof sfdxTelemetryState === 'undefined';
  }

  private setTelemetryMessageShowed(): void {
    if (this.context === undefined) {
      return;
    }

    this.context.globalState.update(TELEMETRY_GLOBAL_VALUE, true);
  }

  public showTelemetryMessage(): void {
    // check if we've ever shown Telemetry message to user
    const showTelemetryMessage = this.getHasTelemetryMessageBeenShown();

    if (showTelemetryMessage) {
      // this means we need to show the message and set telemetry to true;
      window.showInformationMessage(
        nls.localize('telemetry_legal_dialog_message'),
        nls.localize('telemetry_legal_dialog_button_text')
      );

      this.setTelemetryMessageShowed();
    }
  }
}
