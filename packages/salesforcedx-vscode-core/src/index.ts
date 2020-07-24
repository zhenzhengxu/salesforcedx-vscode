/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from './channels';
import {
  forceAliasList,
  forceAnalyticsTemplateCreate,
  forceApexClassCreate,
  forceApexExecute,
  forceApexLogGet,
  forceApexTestRun,
  forceApexTriggerCreate,
  forceAuthDevHub,
  forceAuthLogoutAll,
  forceAuthWebLogin,
  forceConfigList,
  forceConfigSet,
  forceDataSoqlQuery,
  forceDebuggerStop,
  forceFunctionCreate,
  forceFunctionInvoke,
  forceFunctionStart,
  forceFunctionStop,
  forceInternalLightningAppCreate,
  forceInternalLightningComponentCreate,
  forceInternalLightningEventCreate,
  forceInternalLightningInterfaceCreate,
  forceInternalLightningLwcCreate,
  forceLightningAppCreate,
  forceLightningComponentCreate,
  forceLightningEventCreate,
  forceLightningInterfaceCreate,
  forceLightningLwcCreate,
  forceLightningLwcTestCreate,
  forceOrgCreate,
  forceOrgDelete,
  forceOrgDisplay,
  forceOrgList,
  forceOrgOpen,
  forcePackageInstall,
  forceProjectWithManifestCreate,
  forceSfdxProjectCreate,
  forceSourceDelete,
  forceSourceDeployManifest,
  forceSourceDeployMultipleSourcePaths,
  forceSourceDeploySourcePath,
  forceSourceDiff,
  forceSourcePull,
  forceSourcePush,
  forceSourceRetrieveCmp,
  forceSourceRetrieveManifest,
  forceSourceRetrieveSourcePath,
  forceSourceStatus,
  forceStartApexDebugLogging,
  forceStopApexDebugLogging,
  forceTaskStop,
  forceVisualforceComponentCreate,
  forceVisualforcePageCreate,
  registerFunctionInvokeCodeLensProvider,
  turnOffLogging
} from './commands';
import { RetrieveMetadataTrigger } from './commands/forceSourceRetrieveMetadata';
import { getUserId } from './commands/forceStartApexDebugLogging';
import { isvDebugBootstrap } from './commands/isvdebugging';
import {
  CompositeParametersGatherer,
  EmptyParametersGatherer,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands/util';
import { registerConflictView, setupConflictView } from './conflict';
import { getDefaultUsernameOrAlias, setupWorkspaceOrgType } from './context';
import { workspaceContext } from './context';
import * as decorators from './decorators';
import { isDemoMode } from './modes/demo-mode';
import { notificationService, ProgressNotification } from './notifications';
import { BrowserNode, orgBrowser } from './orgBrowser';
import { StageNode } from './orgBrowser/stageOutlineProvider';
import { OrgList } from './orgPicker';
import { registerPushOrDeployOnSave, sfdxCoreSettings } from './settings';
import { SfdxPackageDirectories } from './sfdxProject';
import { taskViewService } from './statuses';
import { telemetryService } from './telemetry';
import { getRootWorkspacePath, hasRootWorkspace, isCLIInstalled } from './util';
import { OrgAuthInfo } from './util/authInfo';

function registerCommands(
  extensionContext: vscode.ExtensionContext
): vscode.Disposable {
  // Customer-facing commands
  const forceAuthWebLoginCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.web.login',
    forceAuthWebLogin
  );
  const forceAuthDevHubCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.dev.hub',
    forceAuthDevHub
  );
  const forceAuthLogoutAllCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.logout.all',
    forceAuthLogoutAll
  );
  const forceOrgCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.org.create',
    forceOrgCreate
  );
  const forceOrgOpenCmd = vscode.commands.registerCommand(
    'sfdx.force.org.open',
    forceOrgOpen
  );
  const forceSourceDeleteCmd = vscode.commands.registerCommand(
    'sfdx.force.source.delete',
    forceSourceDelete
  );
  const forceSourceDeleteCurrentFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.delete.current.file',
    forceSourceDelete
  );
  const forceSourceDeployCurrentSourceFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.current.source.file',
    forceSourceDeploySourcePath
  );
  const forceSourceDeployInManifestCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.in.manifest',
    forceSourceDeployManifest
  );
  const forceSourceDeployMultipleSourcePathsCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.multiple.source.paths',
    forceSourceDeployMultipleSourcePaths
  );
  const forceSourceDeploySourcePathCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.source.path',
    forceSourceDeploySourcePath
  );
  const forceSourcePullCmd = vscode.commands.registerCommand(
    'sfdx.force.source.pull',
    forceSourcePull
  );
  const forceSourcePullForceCmd = vscode.commands.registerCommand(
    'sfdx.force.source.pull.force',
    forceSourcePull,
    { flag: '--forceoverwrite' }
  );
  const forceSourcePushCmd = vscode.commands.registerCommand(
    'sfdx.force.source.push',
    forceSourcePush
  );
  const forceSourcePushForceCmd = vscode.commands.registerCommand(
    'sfdx.force.source.push.force',
    forceSourcePush,
    { flag: '--forceoverwrite' }
  );
  const forceSourceRetrieveCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.source.path',
    forceSourceRetrieveSourcePath
  );
  const forceSourceRetrieveCurrentFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.current.source.file',
    forceSourceRetrieveSourcePath
  );
  const forceSourceRetrieveInManifestCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.in.manifest',
    forceSourceRetrieveManifest
  );
  const forceSourceStatusCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status',
    forceSourceStatus
  );
  const forceSourceStatusLocalCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status.local',
    forceSourceStatus,
    { flag: '--local' }
  );
  const forceSourceStatusRemoteCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status.remote',
    forceSourceStatus,
    { flag: '--remote' }
  );
  const forceApexTestRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.run',
    forceApexTestRun
  );

  const forceTaskStopCmd = vscode.commands.registerCommand(
    'sfdx.force.task.stop',
    forceTaskStop
  );
  const forceApexClassCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.class.create',
    forceApexClassCreate
  );
  const forceAnalyticsTemplateCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.analytics.template.create',
    forceAnalyticsTemplateCreate
  );
  const forceVisualforceComponentCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.visualforce.component.create',
    forceVisualforceComponentCreate
  );
  const forceVisualforcePageCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.visualforce.page.create',
    forceVisualforcePageCreate
  );

  const forceLightningAppCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.app.create',
    forceLightningAppCreate
  );

  const forceLightningComponentCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.component.create',
    forceLightningComponentCreate
  );

  const forceLightningEventCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.event.create',
    forceLightningEventCreate
  );

  const forceLightningInterfaceCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.interface.create',
    forceLightningInterfaceCreate
  );

  const forceLightningLwcCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.lwc.create',
    forceLightningLwcCreate
  );

  const forceLightningLwcTestCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.lwc.test.create',
    forceLightningLwcTestCreate
  );

  const forceDebuggerStopCmd = vscode.commands.registerCommand(
    'sfdx.force.debugger.stop',
    forceDebuggerStop
  );
  const forceConfigListCmd = vscode.commands.registerCommand(
    'sfdx.force.config.list',
    forceConfigList
  );
  const forceAliasListCmd = vscode.commands.registerCommand(
    'sfdx.force.alias.list',
    forceAliasList
  );
  const forceOrgDeleteDefaultCmd = vscode.commands.registerCommand(
    'sfdx.force.org.delete.default',
    forceOrgDelete
  );
  const forceOrgDeleteUsernameCmd = vscode.commands.registerCommand(
    'sfdx.force.org.delete.username',
    forceOrgDelete,
    { flag: '--targetusername' }
  );
  const forceOrgDisplayDefaultCmd = vscode.commands.registerCommand(
    'sfdx.force.org.display.default',
    forceOrgDisplay
  );
  const forceOrgDisplayUsernameCmd = vscode.commands.registerCommand(
    'sfdx.force.org.display.username',
    forceOrgDisplay,
    { flag: '--targetusername' }
  );
  const forceOrgListCleanCmd = vscode.commands.registerCommand(
    'sfdx.force.org.list.clean',
    forceOrgList
  );
  const forceDataSoqlQueryInputCmd = vscode.commands.registerCommand(
    'sfdx.force.data.soql.query.input',
    forceDataSoqlQuery
  );
  const forceDataSoqlQuerySelectionCmd = vscode.commands.registerCommand(
    'sfdx.force.data.soql.query.selection',
    forceDataSoqlQuery
  );

  const forceApexExecuteDocumentCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.execute.document',
    forceApexExecute,
    false
  );
  const forceApexExecuteSelectionCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.execute.selection',
    forceApexExecute,
    true
  );

  const forceProjectCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.project.create',
    forceSfdxProjectCreate
  );

  const forcePackageInstallCmd = vscode.commands.registerCommand(
    'sfdx.force.package.install',
    forcePackageInstall
  );

  const forceProjectWithManifestCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.project.with.manifest.create',
    forceProjectWithManifestCreate
  );

  const forceApexTriggerCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.trigger.create',
    forceApexTriggerCreate
  );

  const forceStartApexDebugLoggingCmd = vscode.commands.registerCommand(
    'sfdx.force.start.apex.debug.logging',
    forceStartApexDebugLogging
  );

  const forceStopApexDebugLoggingCmd = vscode.commands.registerCommand(
    'sfdx.force.stop.apex.debug.logging',
    forceStopApexDebugLogging
  );

  const isvDebugBootstrapCmd = vscode.commands.registerCommand(
    'sfdx.debug.isv.bootstrap',
    isvDebugBootstrap
  );

  const forceApexLogGetCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.log.get',
    forceApexLogGet
  );

  const forceConfigSetCmd = vscode.commands.registerCommand(
    'sfdx.force.config.set',
    forceConfigSet
  );

  const forceDiffFile = vscode.commands.registerCommand(
    'sfdx.force.diff',
    forceSourceDiff
  );

  const forceFunctionCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.function.create',
    forceFunctionCreate
  );

  const forceFunctionStartCmd = vscode.commands.registerCommand(
    'sfdx.force.function.start',
    forceFunctionStart
  );

  const forceFunctionInvokeCmd = vscode.commands.registerCommand(
    'sfdx.force.function.invoke',
    forceFunctionInvoke
  );

  const forceFunctionStopCmd = vscode.commands.registerCommand(
    'sfdx.force.function.stop',
    forceFunctionStop
  );

  return vscode.Disposable.from(
    forceApexExecuteDocumentCmd,
    forceApexExecuteSelectionCmd,
    forceApexTestRunCmd,
    forceAuthWebLoginCmd,
    forceAuthDevHubCmd,
    forceAuthLogoutAllCmd,
    forceDataSoqlQueryInputCmd,
    forceDataSoqlQuerySelectionCmd,
    forceDiffFile,
    forceFunctionCreateCmd,
    forceFunctionInvokeCmd,
    forceFunctionStartCmd,
    forceFunctionStopCmd,
    forceOrgCreateCmd,
    forceOrgOpenCmd,
    forceSourceDeleteCmd,
    forceSourceDeleteCurrentFileCmd,
    forceSourceDeployCurrentSourceFileCmd,
    forceSourceDeployInManifestCmd,
    forceSourceDeployMultipleSourcePathsCmd,
    forceSourceDeploySourcePathCmd,
    forceSourcePullCmd,
    forceSourcePullForceCmd,
    forceSourcePushCmd,
    forceSourcePushForceCmd,
    forceSourceRetrieveCmd,
    forceSourceRetrieveCurrentFileCmd,
    forceSourceRetrieveInManifestCmd,
    forceSourceStatusCmd,
    forceTaskStopCmd,
    forceApexClassCreateCmd,
    forceAnalyticsTemplateCreateCmd,
    forceVisualforceComponentCreateCmd,
    forceVisualforcePageCreateCmd,
    forceLightningAppCreateCmd,
    forceLightningComponentCreateCmd,
    forceLightningEventCreateCmd,
    forceLightningInterfaceCreateCmd,
    forceLightningLwcCreateCmd,
    forceLightningLwcTestCreateCmd,
    forceSourceStatusLocalCmd,
    forceSourceStatusRemoteCmd,
    forceDebuggerStopCmd,
    forceConfigListCmd,
    forceAliasListCmd,
    forceOrgDisplayDefaultCmd,
    forceOrgDisplayUsernameCmd,
    forceProjectCreateCmd,
    forcePackageInstallCmd,
    forceProjectWithManifestCreateCmd,
    forceApexTriggerCreateCmd,
    forceStartApexDebugLoggingCmd,
    forceStopApexDebugLoggingCmd,
    isvDebugBootstrapCmd,
    forceApexLogGetCmd,
    forceConfigSetCmd
  );
}

function registerInternalDevCommands(
  extensionContext: vscode.ExtensionContext
): vscode.Disposable {
  const forceInternalLightningAppCreateCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.app.create',
    forceInternalLightningAppCreate
  );

  const forceInternalLightningComponentCreateCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.component.create',
    forceInternalLightningComponentCreate
  );

  const forceInternalLightningEventCreateCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.event.create',
    forceInternalLightningEventCreate
  );

  const forceInternalLightningInterfaceCreateCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.interface.create',
    forceInternalLightningInterfaceCreate
  );

  const forceInternalLightningLwcCreateCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.lwc.create',
    forceInternalLightningLwcCreate
  );

  return vscode.Disposable.from(
    forceInternalLightningComponentCreateCmd,
    forceInternalLightningLwcCreateCmd,
    forceInternalLightningAppCreateCmd,
    forceInternalLightningEventCreateCmd,
    forceInternalLightningInterfaceCreateCmd
  );
}

function registerOrgPickerCommands(orgList: OrgList): vscode.Disposable {
  const forceSetDefaultOrgCmd = vscode.commands.registerCommand(
    'sfdx.force.set.default.org',
    () => orgList.setDefaultOrg()
  );
  return vscode.Disposable.from(forceSetDefaultOrgCmd);
}

async function setupOrgBrowser(
  extensionContext: vscode.ExtensionContext
): Promise<void> {
  await orgBrowser.init(extensionContext);

  vscode.commands.registerCommand(
    'sfdx.force.metadata.view.type.refresh',
    async node => {
      await orgBrowser.refreshAndExpand(node);
    }
  );

  vscode.commands.registerCommand(
    'sfdx.force.metadata.view.component.refresh',
    async node => {
      await orgBrowser.refreshAndExpand(node);
    }
  );

  vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.component',
    async (trigger: RetrieveMetadataTrigger) => {
      await forceSourceRetrieveCmp(trigger);
    }
  );

  const rootWorkspace = getRootWorkspacePath();
  let defaultFolder: vscode.Uri;
  if (fs.existsSync(path.join(rootWorkspace, 'manifest'))) {
    defaultFolder = vscode.Uri.file(path.join(rootWorkspace, 'manifest'));
  } else {
    defaultFolder = vscode.Uri.file(rootWorkspace);
  }
  vscode.commands.registerCommand(
    'sfdx.force.metadata.stage.view.save',
    async () => {
      const output = await vscode.window.showSaveDialog({
        saveLabel: 'Save',
        defaultUri: defaultFolder,
        filters: { Manifest: ['.xml'] }
      });
      if (output) {
        await orgBrowser.stageProvider.createManifest(output);
        vscode.window.showTextDocument(output);
      }
    }
  );

  vscode.commands.registerCommand(
    'sfdx.force.metadata.stage.view.cancel',
    () => {
      vscode.window
        .showWarningMessage(
          'Are you sure you want to clear your staged metdata?',
          'Cancel',
          'Yes'
        )
        .then(selection => {
          if (selection === 'Yes') {
            orgBrowser.stageProvider.clearAll();
          }
        });
    }
  );

  const gifLinks = [
    'media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    'media.giphy.com/media/1msB48QnkiflNjM3At/giphy-downsized-large.gif',
    'media.giphy.com/media/eCqFYAVjjDksg/giphy.gif',
    'media.giphy.com/media/wpoLqr5FT1sY0/giphy.gif',
    'media.giphy.com/media/DUtVdGeIU8lmo/giphy.gif'
  ];
  vscode.commands.registerCommand('sfdx.force.metdadata.stage.view.gif', () => {
    const randIndex = Math.round(Math.random() * 4);
    const gifLink = gifLinks[randIndex];
    const panel = vscode.window.createWebviewPanel(
      'randomGif',
      'Random Gif Generator',
      vscode.ViewColumn.One,
      {}
    );
    panel.webview.html = getWebviewContent(gifLink);
  });
  function getWebviewContent(gifLink: string) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Random Gif</title>
</head>
<body>
    <img src="https://${gifLink}" width="300" />
</body>
</html>`;
  }

  vscode.commands.registerCommand(
    'sfdx.force.metadata.stage.view.add',
    async (node: BrowserNode) => {
      const fullName = node.fullName;
      const type = node.getAssociatedTypeNode().metadataObject!.xmlName;
      const packagePaths = await SfdxPackageDirectories.getPackageDirectoryFullPaths();
      const registryAccess = new RegistryAccess();
      let uriToOpen;
      for (const packagePath of packagePaths) {
        const packageComponents = registryAccess.getComponentsFromPath(
          packagePath
        );
        const localComponent = packageComponents.find(
          c => c.fullName === fullName && c.type.name === type
        );
        if (localComponent) {
          if (localComponent.sources) {
            uriToOpen = vscode.Uri.file(localComponent.sources[0]);
          } else {
            uriToOpen = vscode.Uri.file(localComponent.xml);
          }
          break;
        }
      }

      orgBrowser.stageProvider.addComponent(
        {
          fullName,
          type
        },
        uriToOpen
      );
    }
  );

  vscode.commands.registerCommand(
    'sfdx.force.metadata.stage.view.add.file',
    async (uri: vscode.Uri) => {
      const registry = new RegistryAccess();
      try {
        let revealNode: StageNode | null = null;
        const components = registry.getComponentsFromPath(uri.fsPath);
        for (const component of components) {
          const uriToOpen = component.sources
            ? component.sources[0]
            : component.xml;
          const node = orgBrowser.stageProvider.addComponent(
            {
              fullName: component.fullName,
              type: component.type.name
            },
            vscode.Uri.file(uriToOpen)
          );
          revealNode = revealNode || node;
        }
        const message =
          components.length === 1
            ? `Added ${components[0].fullName} to component stage.`
            : `Added ${components.length} components to component stage.`;
        const choice = await notificationService.showInformationMessage(
          message,
          'View Stage'
        );
        if (choice === 'View Stage' && revealNode) {
          orgBrowser.stageView.reveal(revealNode);
        }
      } catch (e) {
        if (e.name === 'TypeInferenceError') {
          const filename = path.basename(uri.fsPath);
          notificationService.showErrorMessage(
            `${filename} is not a valid component.`
          );
        }
      }
    }
  );

  vscode.commands.registerCommand(
    'sfdx.force.metadata.stage.view.remove',
    (node: StageNode) => {
      orgBrowser.stageProvider.removeComponent(node);
    }
  );

  vscode.commands.registerCommand(
    'sfdx.force.metadata.stage.view.open',
    (uri: vscode.Uri) => {
      vscode.window.showTextDocument(uri, { preserveFocus: true });
    }
  );
}

export async function activate(context: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();
  const machineId =
    vscode && vscode.env ? vscode.env.machineId : 'someValue.machineId';
  await telemetryService.initializeService(context, machineId);
  telemetryService.showTelemetryMessage();

  // Task View
  const treeDataProvider = vscode.window.registerTreeDataProvider(
    'sfdx.force.tasks.view',
    taskViewService
  );
  context.subscriptions.push(treeDataProvider);

  // Set internal dev context
  const internalDev = sfdxCoreSettings.getInternalDev();

  vscode.commands.executeCommand(
    'setContext',
    'sfdx:internal_dev',
    internalDev
  );

  if (internalDev) {
    // Internal Dev commands
    const internalCommands = registerInternalDevCommands(context);
    context.subscriptions.push(internalCommands);

    // Api
    const internalApi: any = {
      channelService,
      EmptyParametersGatherer,
      isCLIInstalled,
      notificationService,
      OrgAuthInfo,
      ProgressNotification,
      SfdxCommandlet,
      SfdxCommandletExecutor,
      sfdxCoreSettings,
      SfdxWorkspaceChecker,
      telemetryService
    };

    telemetryService.sendExtensionActivationEvent(extensionHRStart);
    console.log('SFDX CLI Extension Activated (internal dev mode)');
    return internalApi;
  }

  // Set functions enabled context
  const functionsEnabled = sfdxCoreSettings.getFunctionsEnabled();
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:functions_enabled',
    functionsEnabled
  );

  // Context
  let sfdxProjectOpened = false;
  if (hasRootWorkspace()) {
    const files = await vscode.workspace.findFiles(
      '**/sfdx-project.json',
      '**/{node_modules,out}/**'
    );
    sfdxProjectOpened = files && files.length > 0;
  }
  // TODO: move this and the replay debugger commands to the apex extension
  let replayDebuggerExtensionInstalled = false;
  if (
    vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-apex-replay-debugger'
    )
  ) {
    replayDebuggerExtensionInstalled = true;
  }
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:replay_debugger_extension',
    replayDebuggerExtensionInstalled
  );

  vscode.commands.executeCommand(
    'setContext',
    'sfdx:project_opened',
    sfdxProjectOpened
  );

  await workspaceContext.initialize(context);

  // register org picker commands
  const orgList = new OrgList();
  context.subscriptions.push(registerOrgPickerCommands(orgList));

  await setupOrgBrowser(context);
  await setupConflictView(context);

  // Register filewatcher for push or deploy on save
  await registerPushOrDeployOnSave();
  // Commands
  const commands = registerCommands(context);
  context.subscriptions.push(commands);
  context.subscriptions.push(registerConflictView());

  // Scratch Org Decorator
  if (hasRootWorkspace()) {
    decorators.showOrg();
    decorators.monitorOrgConfigChanges();

    // Demo mode Decorator
    if (isDemoMode()) {
      decorators.showDemoMode();
    }
  }

  const api: any = {
    channelService,
    CompositeParametersGatherer,
    EmptyParametersGatherer,
    getDefaultUsernameOrAlias,
    getUserId,
    isCLIInstalled,
    notificationService,
    OrgAuthInfo,
    ProgressNotification,
    SelectFileName,
    SelectOutputDir,
    SfdxCommandlet,
    SfdxCommandletExecutor,
    sfdxCoreSettings,
    SfdxWorkspaceChecker,
    workspaceContext,
    taskViewService,
    telemetryService
  };

  registerFunctionInvokeCodeLensProvider(context);

  telemetryService.sendExtensionActivationEvent(extensionHRStart);
  console.log('SFDX CLI Extension Activated');
  return api;
}

export function deactivate(): Promise<void> {
  console.log('SFDX CLI Extension Deactivated');

  // Send metric data.
  telemetryService.sendExtensionDeactivationEvent();
  telemetryService.dispose();

  decorators.disposeTraceFlagExpiration();
  return turnOffLogging();
}
