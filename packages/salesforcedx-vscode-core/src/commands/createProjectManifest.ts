/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ContinueResponse,
  DirFileNameSelection,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode/src/types';
import { Deploy, ManifestGenerator } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import * as path from 'path';
import { workspace } from 'vscode';
import { channelService } from '../channels';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import {
  CompositeParametersGatherer,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';
import { LibraryCommandletExecutor } from './util/libraryCommandlet';

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir('.');

export class ProjectManifestCreateExecutor extends LibraryCommandletExecutor<
  DirFileNameSelection
> {
  public execute(response: ContinueResponse<DirFileNameSelection>): void {
    this.setStartTime();

    try {
      this.genericBuild('Create Project Manifest', 'create_project_manifest');

      const wa = new ManifestGenerator();
      wa.createManifestFromPath = this.genericWrapper(
        wa.createManifestFromPath
      );
      const projectPath = workspace!.workspaceFolders![0].uri.fsPath;
      const manifestContent = wa.createManifestFromPath(
        path.join(projectPath, response.data.outputdir)
      );
      const outputFilePath = path.join(
        projectPath,
        'manifest',
        response.data.fileName
      );
      const writeStream = fs.createWriteStream(outputFilePath);
      writeStream.write(manifestContent);
      writeStream.end();
      this.logMetric();
    } catch (e) {
      telemetryService.sendException(
        'force_source_deploy_with_sourcepath_beta',
        e.message
      );
      notificationService.showFailedExecution(this.executionName);
      channelService.appendLine(e.message);
    }
  }
}

export async function createProjectManifest() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      fileNameGatherer,
      outputDirGatherer
    ),
    new ProjectManifestCreateExecutor()
  );
  await commandlet.run();
}
