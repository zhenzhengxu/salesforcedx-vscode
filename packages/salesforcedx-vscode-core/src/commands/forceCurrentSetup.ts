/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as vscode from 'vscode';
import { getCLIVersion, isCLIInstalled } from '../util';

export class ForceCurrentSetup {
  private static instance: ForceCurrentSetup;
  private context: vscode.ExtensionContext | undefined;
  private sfdxExtensionConfig = Object.create(null);

  public static getInstance() {
    if (!ForceCurrentSetup.instance) {
      ForceCurrentSetup.instance = new ForceCurrentSetup();
    }
    return ForceCurrentSetup.instance;
  }

  public initializeService(context: vscode.ExtensionContext): void {
    this.context = context;
    const extensionPackage = require(this.context.asAbsolutePath(
      './package.json'
    ));
    this.sfdxExtensionConfig['sfdxextensionversion'] = extensionPackage.version;
    this.sfdxExtensionConfig['os'] = os.platform();
    this.sfdxExtensionConfig['platformversion'] = (os.release() || '').replace(
      /^(\d+)(\.\d+)?(\.\d+)?(.*)/,
      '$1$2$3'
    );
    if (vscode) {
      this.sfdxExtensionConfig['vscodeversion'] = vscode.version;
    }
    if (isCLIInstalled()) {
      this.sfdxExtensionConfig['sfdxcliversion'] = getCLIVersion();
    } else {
      this.sfdxExtensionConfig['sfdxcliversion'] = 'Salesforce CLI not found.';
    }
  }

  public getExtensionInfo() {
    let msg = '';
    msg += `OS version : ${this.sfdxExtensionConfig['os']} ${
      this.sfdxExtensionConfig['platformversion']
    }\n`;
    msg += `VS Code version : ${this.sfdxExtensionConfig['vscodeversion']}\n`;
    msg += `Extension version : ${
      this.sfdxExtensionConfig['sfdxextensionversion']
    }\n`;
    msg += `Salesforce CLI version : ${
      this.sfdxExtensionConfig['sfdxcliversion']
    }`;

    vscode.window.showWarningMessage(msg, {
      modal: true
    });
  }
}
