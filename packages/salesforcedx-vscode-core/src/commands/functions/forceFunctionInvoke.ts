/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { taskService } from '@salesforce/salesforcedx-utils-vscode/out/src/tasks';
import { getRootWorkspace } from '../../util';
import * as path from 'path';

import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  Command,
  EventEmitter,
  ExtensionContext,
  languages,
  Position,
  Range,
  TextDocument,
  Uri
} from 'vscode';

class FunctionsLensProvider implements CodeLensProvider {
  private onDidChangeCodeLensesEventEmitter = new EventEmitter<void>();
  public onDidChangeCodeLenses = this.onDidChangeCodeLensesEventEmitter.event;

  /**
   * Refresh code lenses
   */
  public refresh(): void {
    this.onDidChangeCodeLensesEventEmitter.fire();
  }

  /**
   * Invoked by VS Code to provide code lenses
   * @param document text document
   * @param token cancellation token
   */
  public async provideCodeLenses(
    document: TextDocument,
    token: CancellationToken
  ): Promise<CodeLens[]> {
    const functionInvokeCommand: Command = {
      command: 'sfdx.force.function.invoke',
      title: 'Send Request',
      tooltip: '',
      arguments: [document.uri]
    };
    const range = new Range(new Position(0, 0), new Position(0, 1));
    const functionInvokeCodeLens = new CodeLens(range, functionInvokeCommand);
    return [functionInvokeCodeLens];
  }
}
export const functionsCodeLensProvider = new FunctionsLensProvider();

export function registerFunctionsCodeLensProvider(context: ExtensionContext) {
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      {
        language: 'json',
        pattern: '**/functions/**/*.json'
      },
      functionsCodeLensProvider
    )
  );
}

/**
 * Executes sfdx evergreen:function:invoke http://localhost:8080 --payload='@functions/MyFunction/payload.json'
 */
export async function forceFunctionInvoke(sourceUri: Uri) {
  const segments = sourceUri.fsPath.split(path.sep);
  const payload = ['@functions', ...segments.slice(segments.findIndex(x => x === 'functions') + 1)].join(path.sep);
  // const payload = sourceUri.fsPath;

  const sfdxTask = taskService.createTask({
    taskName: 'SFDX: Invoke Function',
    taskGroup: 'functions',
    taskScope: getRootWorkspace(),
    cmd: 'sfdx',
    args: [
      'evergreen:function:invoke',
      'http://localhost:8080',
      `--payload='${payload}'`
    ],
    shellExecutionOptions: {
      cwd: getRootWorkspace().uri.fsPath
    }
  });

  sfdxTask.onDidEnd(() => { });

  await sfdxTask.execute();
}
