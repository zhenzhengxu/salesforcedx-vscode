/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { Subject } from 'rxjs/Subject';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { ApexTailHandler, ApexTailService } from './apexTailService';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  taskViewService,
  notificationService,
  SfdxCommandlet,
  ProgressNotification,
  EmptyParametersGatherer,
  SfdxWorkspaceChecker
} = sfdxCoreExports;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;

export class ForceApexTailExecutor extends SfdxCommandletExecutor<{}> {
  public build(): Command {
    return new SfdxCommandBuilder()
      .withDescription('apex log tail')
      .withArg('force:apex:log:tail')
      .withFlag('--debuglevel', 'ReplayDebuggerLevels1581620577420')
      .withLogName('force_apex_log_tail')
      .build();
  }

  public execute(response: ContinueResponse<{}>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const executor = new CliCommandExecutor(this.build(), {
      cwd: this.executionCwd,
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    });
    const execution = executor.execute(cancellationToken);
    const executionName = execution.command.toString();

    const serverHandler: ApexTailHandler = {
      stop: async () => {
        return execution.killExecution('SIGTERM');
      }
    };
    ApexTailService.instance.registerHandler(serverHandler);

    // channelService.streamCommandOutput(execution);
    // channelService.showChannelOutput();
    /*
    const progress = new Subject();
    ProgressNotification.show(
      execution,
      cancellationTokenSource,
      vscode.ProgressLocation.Notification,
      progress.asObservable()
    ); */

    // listen for command startup
    let stdOut = '';
    execution.stdoutSubject.subscribe(data => {
      console.log('========> listening to command startup');
      stdOut += data.toString();
      console.log(data.toString());
    });

    // handler errors
    execution.processExitSubject.subscribe(async exitCode => {
      console.log('========> listening to command errors');
      console.log(exitCode);
      console.log(
        '===> Contains user_debug ??' + stdOut.includes('USER_DEBUG')
      );

      if (stdOut.includes('USER_DEBUG')) {
        console.log('lets get fancy');
        // const regex = /(USER_DEBUG)(\|)(\[\d*\])(\|)(DEBUG)(\|)([A-Za-z\s])*(?=(\d+\:\d+\:\d+\.\d+))/g;
        const regex = /((USER_DEBUG)(\|)(\[\d*\])(\|)(DEBUG)(\|)([A-Za-z\s])*(?=(\d+\:\d+\:\d+\.\d+)))|((EXCEPTION_THROWN)(\|)(\[\d+\])(\|)([A-Za-z\s\:\.]*)(?=(\d+\:\d+\:\d+\.\d+)))/g;
        const found = stdOut.match(regex);

        if (found) {
          // const regex2 = /(USER_DEBUG)(\|)(\[\d*\])(\|)(DEBUG)(\|)/g;
          const regex2 = /((USER_DEBUG)(\|)(\[\d*\])(\|)(DEBUG)(\|))|((EXCEPTION_THROWN)(\|)(\[\d+\])(\|))/g;
          found.forEach(log => {
            const trimmedLog = log.replace(regex2, '');
            console.log(trimmedLog);
            channelService.appendLine(trimmedLog);
          });
        }
      }
    });

    cancellationToken.onCancellationRequested(() => {
      notificationService.showWarningMessage(
        nls.localize('command_canceled', executionName)
      );
      this.showChannelOutput();
    });
  }
}

export async function forceApexTailStart() {
  // add a handler ????
  const preconditionChecker = new SfdxWorkspaceChecker();
  const parameterGatherer = new EmptyParametersGatherer();
  const executor = new ForceApexTailExecutor();

  const commandlet = new SfdxCommandlet(
    preconditionChecker,
    parameterGatherer,
    executor
  );

  await commandlet.run();
}

export async function forceApexTailStop() {
  try {
    if (ApexTailService.instance.isHandlerRegistered()) {
      // channelService.appendLine('Successfully stopped Apex Tail');
      await ApexTailService.instance.stopService();
      notificationService.showSuccessfulExecution(
        'Successfully stopped Apex Tail'
      );
    } else {
      notificationService.showWarningMessage(
        'Something wrong happened with Apex Tail Stop'
      );
    }
  } catch (e) {
    console.log('Something wrong happened with Apex Tail Stop');
    console.log(e);
  }
}
