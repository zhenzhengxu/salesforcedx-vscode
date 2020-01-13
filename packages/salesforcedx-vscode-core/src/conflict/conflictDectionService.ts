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
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/src/types';
import * as AdmZip from 'adm-zip';
import { SpawnOptions } from 'child_process';
import { compareSync, Options } from 'dir-compare';
import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as shell from 'shelljs';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath } from '../util';

export interface InstalledPackageInfo {
  id: string;
  name: string;
  namespace: string;
  versionId: string;
  versionName: string;
  versionNumber: string;
}

export class ConflictDetector {
  private extractPackages: boolean;
  private cleanup: boolean;

  constructor(extractPackages: boolean, cleanup: boolean) {
    this.extractPackages = extractPackages;
    this.cleanup = cleanup;
  }

  public readonly relativeMetdataTempPath = path.join(
    '.sfdx',
    'tools',
    'conflicts'
  );

  public readonly relativePackageXmlPath = path.join(
    this.relativeMetdataTempPath,
    'package.xml'
  );

  public readonly relativeInstalledPackagesPath = path.join(
    '.sfdx',
    'tools',
    'installed-packages'
  );

  public readonly relativeUnpackagedPath = path.join(
    this.relativeMetdataTempPath,
    'unpackaged'
  );

  public readonly relativeConvertedPath = path.join(
    '.sfdx',
    'tools',
    'conflicts',
    'converted'
  );

  public build(data: {}): Command {
    throw new Error('not in use');
  }

  public buildRetrieveOrgSourceCommand(data: ConflictDetectionOrg): Command {
    return new SfdxCommandBuilder()
      .withDescription('Conflict Detection: retrieving org source')
      .withArg('force:mdapi:retrieve')
      .withFlag('--retrievetargetdir', this.relativeMetdataTempPath)
      .withFlag('--unpackaged', this.relativePackageXmlPath)
      .withFlag('--targetusername', data.username)
      .withLogName('conflict_detect_retrieve_org_source')
      .build();
  }

  public buildMetadataApiConvertOrgSourceCommand(
    data: ConflictDetectionOrg
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription('Conflict Detection: converting org source')
      .withArg('force:mdapi:convert')
      .withFlag('--rootdir', this.relativeUnpackagedPath)
      .withFlag('--outputdir', this.relativeConvertedPath)
      .withLogName('conflict_detect_convert_org_source')
      .build();
  }

  public buildPackageInstalledListAsJsonCommand(
    data: ConflictDetectionOrg
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription('Conflict Detection: list installed packages')
      .withArg('force:package:installed:list')
      .withFlag('--targetusername', data.username)
      .withJson()
      .withLogName('conflict_detect_list_installed_packages')
      .build();
  }

  public buildRetrievePackagesSourceCommand(
    data: ConflictDetectionOrg,
    packageNames: string[]
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription('Conflict Detection: retrieving package source')
      .withArg('force:mdapi:retrieve')
      .withFlag('--retrievetargetdir', this.relativeMetdataTempPath)
      .withFlag('--packagenames', packageNames.join(','))
      .withFlag('--targetusername', data.username)
      .withLogName('conflict_detect_retrieve_packages_source')
      .build();
  }

  public buildMetadataApiConvertPackageSourceCommand(
    packageName: string
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        'Conflict Detection: Convert package source ' + packageName
      )
      .withArg('force:mdapi:convert')
      .withFlag(
        '--rootdir',
        path.join(this.relativeMetdataTempPath, 'packages', packageName)
      )
      .withFlag(
        '--outputdir',
        path.join(this.relativeInstalledPackagesPath, packageName)
      )
      .withLogName('conflict_detect_convert_package_source')
      .build();
  }

  public parsePackageInstalledListJson(
    packagesJson: string
  ): InstalledPackageInfo[] {
    const packagesData = JSON.parse(packagesJson);
    return packagesData.result.map((entry: any) => {
      return {
        id: entry.SubscriberPackageId,
        name: entry.SubscriberPackageName,
        namespace: entry.SubscriberPackageNamespace,
        versionId: entry.SubscriberPackageVersionId,
        versionName: entry.SubscriberPackageVersionName,
        versionNumber: entry.SubscriberPackageVersionNumber
      } as InstalledPackageInfo;
    });
  }

  public async checkForConflicts2(
    data: ConflictDetectionOrg
  ): Promise<DirectoryDiffResults> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const results = await this.checkForConflicts(
      data,
      cancellationTokenSource,
      cancellationToken
    );
    return results;
  }

  public async checkForConflicts(
    data: ConflictDetectionOrg,
    cancellationTokenSource: any,
    cancellationToken: any
  ): Promise<DirectoryDiffResults> {
    const projectPath = getRootWorkspacePath();
    const projectMetadataTempPath = path.join(
      projectPath,
      this.relativeMetdataTempPath
    );
    const retrievePackageXmlPath = path.join(
      projectPath,
      this.relativePackageXmlPath
    );
    const projectInstalledPackagesPath = path.join(
      projectPath,
      this.relativeInstalledPackagesPath
    );
    const remoteSourcePath: string = path.join(
      projectPath,
      this.relativeConvertedPath
    );
    const localSourcePath: string = path.join(projectPath, data.outputdir);

    // 1: create package.xml for downloading metadata
    // TODO: make this configurable, externalize the configuration of which metadata types
    // to track.
    try {
      shell.mkdir('-p', projectMetadataTempPath);
      if (data.manifest) {
        shell.cp(data.manifest, retrievePackageXmlPath);
      } else {
        fs.writeFileSync(
          retrievePackageXmlPath,
          generateRetrieveManifest(data.components),
          {
            encoding: 'utf-8'
          }
        );
      }
    } catch (error) {
      console.error(error);
      channelService.appendLine(
        nls.localize('error_creating_packagexml', error.toString())
      );
      notificationService.showErrorMessage(
        nls.localize('error_creating_packagexml', error.toString())
      );
      return Promise.reject();
    }

    // 2: retrieve unmanged org source
    await this.executeCommand(
      this.buildRetrieveOrgSourceCommand(data),
      { cwd: projectPath },
      cancellationTokenSource,
      cancellationToken
    );

    // 3: unzip retrieved source
    try {
      const zip = new AdmZip(
        path.join(projectMetadataTempPath, 'unpackaged.zip')
      );
      zip.extractAllTo(projectMetadataTempPath, true);
    } catch (error) {
      console.error(error);
      channelService.appendLine(
        nls.localize('error_extracting_org_source', error.toString())
      );
      notificationService.showErrorMessage(
        nls.localize('error_extracting_org_source', error.toString())
      );
      return Promise.reject();
    }

    // 4: convert org source to decomposed (source) format
    await this.executeCommand(
      this.buildMetadataApiConvertOrgSourceCommand(data),
      { cwd: projectPath },
      cancellationTokenSource,
      cancellationToken
    );

    if (this.extractPackages) {
      // 5: get list of installed packages
      const packagesJson = await this.executeCommand(
        this.buildPackageInstalledListAsJsonCommand(data),
        { cwd: projectPath },
        cancellationTokenSource,
        cancellationToken
      );
      const packageInfos = this.parsePackageInstalledListJson(packagesJson);

      // 6: fetch packages
      await this.executeCommand(
        this.buildRetrievePackagesSourceCommand(
          data,
          packageInfos.map(entry => entry.name)
        ),
        { cwd: projectPath },
        cancellationTokenSource,
        cancellationToken
      );

      // 7: unzip downloaded packages into temp location
      try {
        const packagesTempPath = path.join(projectMetadataTempPath, 'packages');
        shell.mkdir('-p', packagesTempPath);
        shell.mkdir('-p', projectInstalledPackagesPath);
        const zip = new AdmZip(
          path.join(projectMetadataTempPath, 'unpackaged.zip')
        );
        zip.extractAllTo(packagesTempPath, true);
      } catch (error) {
        console.error(error);
        channelService.appendLine(
          nls.localize('error_extracting_packages', error.toString())
        );
        notificationService.showErrorMessage(
          nls.localize('error_extracting_packages', error.toString())
        );
        return Promise.reject();
      }

      // 8: convert packages into final location
      for (const packageInfo of packageInfos) {
        channelService.appendLine(`Processing package: ${packageInfo.name}`);
        await this.executeCommand(
          this.buildMetadataApiConvertPackageSourceCommand(packageInfo.name),
          { cwd: projectPath },
          cancellationTokenSource,
          cancellationToken
        );

        // generate installed-package.json file
        try {
          fs.writeFileSync(
            path.join(
              projectInstalledPackagesPath,
              packageInfo.name,
              'installed-package.json'
            ),
            JSON.stringify(packageInfo, null, 2),
            { encoding: 'utf-8' }
          );
        } catch (error) {
          console.error(error);
          channelService.appendLine(
            nls.localize(
              'error_writing_installed_package_info',
              error.toString()
            )
          );
          notificationService.showErrorMessage(
            nls.localize(
              'error_writing_installed_package_info',
              error.toString()
            )
          );
          return Promise.reject();
        }
      }
    }

    // 9: diff project directory (local) and retrieved directory (remote)
    // TODO: be smarter about what portion of the entire project was actually retrieved
    const differ = new DirectoryDiffer();
    const diffs = differ.diff(localSourcePath, remoteSourcePath);

    // 10: cleanup temp files
    if (this.cleanup) {
      try {
        shell.rm('-rf', projectMetadataTempPath);
      } catch (error) {
        console.error(error);
        channelService.appendLine(
          nls.localize('error_cleanup_temp_files', error.toString())
        );
        notificationService.showErrorMessage(
          nls.localize('error_cleanup_temp_files', error.toString())
        );
        return Promise.reject();
      }
    }

    return diffs;
  }

  public logMetric(
    logName: string | undefined,
    executionTime: [number, number],
    additionalData?: any
  ) {
    telemetryService.sendCommandEvent(logName, executionTime, additionalData);
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
    this.attachExecution(execution, cancellationTokenSource);
    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });
    return result;
  }

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource
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

export interface DirectoryDiffResults {
  missingLocal: Set<DirFileNameSelection>;
  missingRemote: Set<DirFileNameSelection>;
  different: Set<DirFileNameSelection>;
}

class DirectoryDiffer {
  constructor() {}

  public diff(
    localSourcePath: string,
    remoteSourcePath: string
  ): DirectoryDiffResults {
    // let options: Partial<Options> = { compareSize: true };
    const options: Partial<Options> = { compareContent: true };

    // Synchronous directory compare
    const res = compareSync(localSourcePath, remoteSourcePath, options);
    const missingLocal = new Set<DirFileNameSelection>();
    const missingRemote = new Set<DirFileNameSelection>();
    const differentFiles = new Set<DirFileNameSelection>();

    if (res.diffSet) {
      res.diffSet.forEach(entry => {
        const state = entry.state;
        if (state === 'left') {
          if (entry.type1 === 'file') {
            missingLocal.add({
              fileName: entry.name1 || '',
              outputdir: entry.relativePath
            });
          }
        } else if (state === 'right') {
          if (entry.type2 === 'file') {
            missingRemote.add({
              fileName: entry.name2 || '',
              outputdir: entry.relativePath
            });
          }
        } else if (state === 'distinct') {
          if (entry.type1 === 'file') {
            differentFiles.add({
              fileName: entry.name1 || '',
              outputdir: entry.relativePath
            });
          }
        }
      });
    }

    return {
      missingLocal,
      missingRemote,
      different: differentFiles
    };
  }
}

export interface ConflictDetectionOrg {
  username: string;
  outputdir: string;
  manifest?: string;
  components?: LocalComponent[];
}

function generateRetrieveManifest(components?: LocalComponent[]): string {
  const entries = new Map<string, string[]>();
  if (components && components.length > 1) {
    [...components]
      .sort((a, b) => {
        return a.type.localeCompare(b.type);
      })
      .forEach(c => {
        const members = entries.get(c.type) || [];
        members.push(c.fileName);
        entries.set(c.type, members);
      });
  } else if (components && components.length === 1) {
    // if its a metadata folder then ???
    // if its a metadata resource then look it up
  }

  if (entries.size > 0) {
    let manifest = `<?xml version="1.0" encoding="UTF-8"?>
    <Package xmlns="http://soap.sforce.com/2006/04/metadata">`;
    entries.forEach((names: string[], key: string) => {
      manifest = manifest + '<types>';
      manifest = manifest + '<name>' + key + '</name>';
      names.forEach(name => {
        manifest = manifest + '<members>' + name + '</members>';
      });
      manifest = manifest + '</types>';
    });
    manifest = manifest + `</Package>`;
    return manifest;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>*</members>
    <name>ApexTrigger</name>
  </types>
  <types>
    <members>*</members>
    <name>AuraDefinitionBundle</name>
  </types>
  <types>
    <members>*</members>
    <name>LightningComponentBundle</name>
  </types>
  <types>
    <members>*</members>
    <name>FlexiPage</name>
  </types>
  <types>
    <members>*</members>
    <name>Layout</name>
  </types>
  <types>
    <members>*</members>
    <name>CustomObject</name>
  </types>
  <types>
    <members>*</members>
    <name>PermissionSet</name>
  </types>
  <types>
    <members>*</members>
    <name>StaticResource</name>
  </types>
  <types>
    <members>*</members>
    <name>CustomTab</name>
  </types>
</Package>`;
}
