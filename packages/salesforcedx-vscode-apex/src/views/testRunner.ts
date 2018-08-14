// /*
//  * Copyright (c) 2017, salesforce.com, inc.
//  * All rights reserved.
//  * Licensed under the BSD 3-Clause license.
//  * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
//  */
import * as events from 'events';
import * as os from 'os';
import * as vscode from 'vscode';
import { ReadableApexTestRunExecutor } from './ReadableApexTestRunExecutor';
import {
  ApexTestNode,
  ApexTestOutlineProvider,
  TestNode
} from './TestOutlineProvider';

export class ApexTestRunner {
  private testOutline: ApexTestOutlineProvider;
  private eventsEmitter = new events.EventEmitter();
  private emptyParametersGatherer: any;
  private sfdxCommandlet: any;
  private sfdxWorkspaceChecker: any;
  private channelService: any;

  constructor(
    testOutline: ApexTestOutlineProvider,
    coreExtension: vscode.Extension<any> | undefined
  ) {
    this.testOutline = testOutline;
    this.eventsEmitter.on('sfdx:upate:selection', this.updateSelection);
    const sfdxCoreExports = coreExtension!.exports;
    this.emptyParametersGatherer = sfdxCoreExports.EmptyParametersGatherer;
    this.sfdxCommandlet = sfdxCoreExports.SfdxCommandlet;
    this.sfdxWorkspaceChecker = sfdxCoreExports.SfdxWorkspaceChecker;
    this.channelService = sfdxCoreExports.channelService;
  }

  public async showErrorMessage(test: TestNode) {
    let position: vscode.Range | number = test.location!.range;
    if (test instanceof ApexTestNode) {
      const errorMessage = test.errorMessage;
      if (errorMessage && errorMessage !== '') {
        const stackTrace = test.stackTrace;
        position =
          parseInt(
            stackTrace.substring(
              stackTrace.indexOf('line') + 4,
              stackTrace.indexOf(',')
            ),
            10
          ) - 1; // Remove one because vscode location is zero based
        this.channelService.appendLine(
          '-----------------------------------------'
        );
        this.channelService.appendLine(stackTrace);
        this.channelService.appendLine(errorMessage);
        this.channelService.appendLine(
          '-----------------------------------------'
        );
        this.channelService.showChannelOutput();
      }
    }
    if (test.location) {
      vscode.window.showTextDocument(test.location.uri).then(() => {
        this.eventsEmitter.emit('sfdx:upate:selection', position);
      });
    }
  }

  public updateSelection(index: vscode.Range | number) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      if (index instanceof vscode.Range) {
        editor.selection = new vscode.Selection(index.start, index.end);
        editor.revealRange(index); // Show selection
      } else {
        const line = editor.document.lineAt(index);
        const startPos = new vscode.Position(
          line.lineNumber,
          line.firstNonWhitespaceCharacterIndex
        );
        editor.selection = new vscode.Selection(startPos, line.range.end);
        editor.revealRange(line.range); // Show selection
      }
    }
  }

  public getTempFolder(): string {
    return os.tmpdir();
  }

  public async runSingleTest(test: TestNode) {
    const tmpFolder = this.getTempFolder();
    const builder = new ReadableApexTestRunExecutor(
      [test.name],
      false,
      tmpFolder,
      this.testOutline
    );
    const commandlet = new this.sfdxCommandlet(
      new this.sfdxWorkspaceChecker(),
      new this.emptyParametersGatherer(),
      builder
    );
    await commandlet.run();
  }

  public async runApexTests(): Promise<void> {
    await this.testOutline.refresh();
    const tmpFolder = this.getTempFolder();
    const builder = new ReadableApexTestRunExecutor(
      Array.from(ApexTestOutlineProvider.testStrings.values()),
      false,
      tmpFolder,
      this.testOutline
    );
    const commandlet = new this.sfdxCommandlet(
      new this.sfdxWorkspaceChecker(),
      new this.emptyParametersGatherer(),
      builder
    );
    await commandlet.run();
  }
}
