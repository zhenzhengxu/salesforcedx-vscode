/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import {
  DEBUGGER_EXCEPTION_BREAKPOINTS,
  DEBUGGER_LINE_BREAKPOINTS
} from './constants';
import * as languageServer from './languageServer';
import { telemetryService } from './telemetry';

let languageClient: LanguageClient | undefined;
let languageClientReady = false;
const sfdxCoreExt = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);

export async function activate(context: vscode.ExtensionContext) {
  languageClient = await languageServer.createLanguageServer(context);
  const handle = languageClient.start();
  context.subscriptions.push(handle);

  languageClient.onReady().then(() => {
    languageClientReady = true;
  });

  // Telemetry
  let isTelemetryEnabled = false;
  if (sfdxCoreExt && sfdxCoreExt.exports) {
    sfdxCoreExt.exports.telemetryService.showTelemetryMessage();
    isTelemetryEnabled = sfdxCoreExt.exports.telemetryService.isTelemetryEnabled();
  }

  telemetryService.initializeService(context, isTelemetryEnabled);
  telemetryService.sendExtensionActivationEvent();

  const exportedApi = {
    getLineBreakpointInfo,
    getExceptionBreakpointInfo,
    isLanguageClientReady
  };
  return exportedApi;
}

async function getLineBreakpointInfo(): Promise<{}> {
  let response = {};
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_LINE_BREAKPOINTS);
  }
  return Promise.resolve(response);
}

async function getExceptionBreakpointInfo(): Promise<{}> {
  let response = {};
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_EXCEPTION_BREAKPOINTS);
  }
  return Promise.resolve(response);
}

function isLanguageClientReady(): boolean {
  return languageClientReady;
}

// tslint:disable-next-line:no-empty
export function deactivate() {
  telemetryService.sendExtensionDeactivationEvent();
  telemetryService.dispose();
}
