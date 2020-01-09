/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandExecution,
  CommandOutput
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { SpawnOptions } from 'child_process';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import {
  ConflictDetectionOrg,
  ConflictDetector,
  DirectoryDiffResults
} from '../../conflict/conflictDectionService';
import { ConflictView } from '../../conflict/conflictView';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import {
  // getRootWorkspacePath,
  // hasRootWorkspace,
  OrgAuthInfo
} from '../../util';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';

export class ConflictDetectorExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    throw new Error('not in use');
  }

  public async execute(
    response: ContinueResponse<ConflictDetectorConfig>
  ): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const detector = new ConflictDetector(false, true);

    const results = await detector.checkForConflicts(
      response.data,
      cancellationTokenSource,
      cancellationToken
    );

    if (results.different.size === 0) {
      notificationService.showInformationMessage('No conflicts detected');
      ConflictView.getInstance().reset(response.data.username, []);
    } else {
      notificationService.showErrorMessage('Resource Conflicts Detected');
      ConflictView.getInstance().reset(
        response.data.username,
        Array.from(results.different.values())
      );
    }
  }

  public async executeCommand(
    command: Command,
    options: SpawnOptions,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ): Promise<string> {
    const startTime = process.hrtime();
    // do not inherit global env because we are setting our own auth
    const execution = new CliCommandExecutor(command, options, false).execute(
      cancellationToken
    );

    const result = new CommandOutput().getCmdResult(execution);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });
    return result;
  }

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    channelService.streamCommandOutput(execution);
    channelService.showChannelOutput();
    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export type ConflictDetectorConfig = ConflictDetectionOrg &
  DirectoryDiffResults;

export class EnterConflictDetectorOrg
  implements ParametersGatherer<ConflictDetectionOrg> {
  public static readonly usernameValidator = (value: string) => {
    // return 'Improper username entered.';
    return null; // all good
  };

  public async gather(): Promise<
    CancelResponse | ContinueResponse<ConflictDetectionOrg>
  > {
    const defaultUsername = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
    const username = await vscode.window.showInputBox({
      value: defaultUsername,
      prompt: 'Enter a username/alias',
      placeHolder: 'Username or Alias',
      ignoreFocusOut: true,
      validateInput: EnterConflictDetectorOrg.usernameValidator
    });

    if (username) {
      return {
        type: 'CONTINUE',
        data: { username, outputdir: 'force-app' }
      };
    }

    vscode.window.showErrorMessage('Invalide username or alias');
    return { type: 'CANCEL' };
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EnterConflictDetectorOrg();

const executor = new ConflictDetectorExecutor();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export async function conflictDetector() {
  await commandlet.run();
}
