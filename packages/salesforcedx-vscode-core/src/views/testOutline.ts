import * as vscode from 'vscode';
import crypto = require('crypto');
import events = require('events');
import fs = require('fs');
import ospath = require('path');
import {
  CliCommandExecutor,
  Command
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { ApexTestInfo } from '..';
import { channelService } from '../channels';
import { SfdxCommandlet, SfdxWorkspaceChecker } from '../commands';
import { EmptyParametersGatherer } from '../commands/commands';
import { ForceApexTestRunCodeActionExecutor } from '../commands/forceApexTestRunCodeAction';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';

const LIGHT_BLUE_BUTTON = ospath.join(__filename, '..', '..', '..', '..', '..', '..', 'resources', 'light', 'testNotRun.svg');
const LIGHT_RED_BUTTON = ospath.join(__filename, '..', '..', '..', '..', '..', '..', 'resources', 'light', 'testFail.svg');
const LIGHT_GREEN_BUTTON = ospath.join(__filename, '..', '..', '..', '..', '..', '..', 'resources', 'light', 'testPass.svg');

const DARK_BLUE_BUTTON = ospath.join(__filename, '..', '..', '..', '..', '..', '..', 'resources', 'dark', 'testNotRun.svg');
const DARK_RED_BUTTON = ospath.join(__filename, '..', '..', '..', '..', '..', '..', 'resources', 'dark', 'testFail.svg');
const DARK_GREEN_BUTTON = ospath.join(__filename, '..', '..', '..', '..', '..', '..', 'resources', 'dark', 'testPass.svg');

export type FullTestResult = {
  summary: TestSummary,
  tests: TestResult[]
};

export type TestSummary = {
  outcome: string,
  testsRan: number,
  passing: number,
  failing: number,
  skipped: number,
  passRate: string,
  failRate: string,
  testStartTime: string,
  testExecutionTime: string,
  testTotalTime: string,
  commandTime: string,
  hostname: string,
  orgId: string,
  username: string,
  testRunId: string,
  userId: string
};

export type TestResult = {
  ApexClass: ApexClass,
  MethodName: string,
  Outcome: string,
  RunTime: number,
  Message: string,
  StackTrace: string,
  FullName: string
};

export type ApexClass = {
  attributes: { type: string },
  Id: string,
  Name: string,
  NamespacPrefix: string
};

export type ApexGroupInfo = {
  outcome: string,
  summary: TestSummary
};

export class ApexTestOutlineProvider implements vscode.TreeDataProvider<Test> {
  private _onDidChangeTreeData: vscode.EventEmitter<Test | undefined> = new vscode.EventEmitter<Test | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<Test | undefined> = this._onDidChangeTreeData.event;

  private eventsEmitter = new events.EventEmitter();

  private apexTestMap: Map<string, Test> = new Map<string, Test>();
  private head: Test | null;
  private static testStrings: Set<string> = new Set<string>();

  constructor(private path: string, private apexClasses: vscode.Uri[], private apexTestInfo: ApexTestInfo[] | null) {
    this.head = null;
    this.getAllApexTests(this.path);
    // Now, activate events that we need
    this.eventsEmitter.on('Delete Folder', this.deleteFolderRecursive); // Activate event to delete folder
    this.eventsEmitter.on('Show Highlight', this.updateSelection);
  }

  public getHead(): Test {
    if (this.head === null) {
      return this.getAllApexTests(this.path);
    }
    return this.head;
  }

  public getChildren(element: Test): Thenable<Test[]> {
    if (element) {
      return Promise.resolve(element.children);
    } else {
      if (this.head && this.head.children.length > 0) {
        return Promise.resolve(this.head.children);
      } else {
        const emptyArray = new Array<ApexTest>();
        emptyArray.push(new ApexTest('No tests in folder', null, 0));
        return Promise.resolve(emptyArray);
      }
    }
  }

  public getTreeItem(element: Test): vscode.TreeItem {
    if (element) {
      return element;
    } else {
      this.getAllApexTests(this.path);
      if (!(this.head && this.head.children.length > 0)) {
        this.head = new ApexTest('No tests in folder', null, 0);
        this.head.children.push(new ApexTest('No tests in folder', null, 0));
      }
      return this.head;
    }
  }

  public async refresh() {
    this.head = null; // Reset tests
    this.apexTestMap.clear();
    ApexTestOutlineProvider.testStrings.clear();
    const sfdxApex = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-apex');
    this.apexTestInfo = null;
    if (sfdxApex && sfdxApex.isActive && sfdxApex.exports.isLanguageClientReady()) {
      this.apexTestInfo = (await sfdxApex.exports.getApexTests()) as ApexTestInfo[];
    }
    this.apexClasses = await vscode.workspace.findFiles('**/*.cls');
    this.getAllApexTests(this.path);
    this._onDidChangeTreeData.fire();
  }

  private getAllApexTests(path: string): Test {
    if (this.head == null) { // Starting Out
      this.head = new ApexTestGroup('ApexTests', null, 0);
    }
    if (this.apexTestInfo) {
      // Do it the easy way
      this.apexTestInfo.forEach(test => {
        let apexGroup = this.apexTestMap.get(test.parent) as ApexTestGroup;
        if (!apexGroup) {
          apexGroup = new ApexTestGroup(test.parent, null, 0);
          this.apexTestMap.set(test.parent, apexGroup);
        }
        const testUri = vscode.Uri.file(test.file.substring(7));
        const apexTest = new ApexTest(test.methodName, testUri, test.line);
        apexTest.name = apexGroup.label + '.' + apexTest.label;
        this.apexTestMap.set(apexTest.name, apexTest);
        apexGroup.children.push(apexTest);
        if (this.head && !this.head.children.includes(apexGroup)) {
          this.head.children.push(apexGroup);
        }
        ApexTestOutlineProvider.testStrings.add(apexGroup.name);

      });
    } else {
      this.apexClasses.forEach(apexClass => {
        const fileContent = fs.readFileSync(apexClass.fsPath).toString();
        if (fileContent && fileContent.toLowerCase().includes('@istest')) {
          const testName = ospath.basename(apexClass.toString()).replace('.cls', '');
          const newApexTestGroup = new ApexTestGroup(testName, apexClass, 0);
          this.apexTestMap.set(testName, newApexTestGroup);
          this.addTests(fileContent, newApexTestGroup);
          ApexTestOutlineProvider.testStrings.add(testName);
          if (this.head) {
            this.head.children.push(newApexTestGroup);
          }
        }
      });
    }
    return this.head;
  }

  private addTests(fileContent: string, apexTestGroup: ApexTestGroup): void {
    // Parse through file and find apex tests
    const regEx = /(@[iI][sS][tT][eE][sS][tT])+/g;
    let match = regEx.exec(fileContent);
    while (match) {
      const ind = match.index;
      if (ind !== 0) { // Ignore class heading
        // A test
        const restOfFile = fileContent.slice(match.index);
        const header = restOfFile.slice(0, restOfFile.indexOf('{'));
        const headerParts = header.split(' ');

        // Name is last part of the header, not always the last item though, because could be an empty string ''
        let name = '';
        while (name === '') {
          const headerPart = headerParts.pop();
          if (headerPart && headerPart.includes(')')) {
            name = headerPart;
          }
        }
        name = name.replace('()', ''); // Get rid
        const apexTest = new ApexTest(name, apexTestGroup.file, ind);
        apexTest.name = apexTestGroup.label + '.' + name;
        this.apexTestMap.set(apexTest.name, apexTest);
        apexTestGroup.children.push(apexTest);
      }
      match = regEx.exec(fileContent);
    }
  }

  private deleteFolderRecursive(path: string) {
    let files = [];
    if (fs.existsSync(path)) {
      files = fs.readdirSync(path);
      files.forEach((file, index) => {
        const curPath = path + '/' + file;
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          this.deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  }

  public async showErrorMessage(test: ApexTest) {
    const errorMessage = test.errorMessage;
    let position = 0;
    let isRow = false;

    if (errorMessage && errorMessage !== '') {
      const stackTrace = test.stackTrace;
      position = parseInt(stackTrace.substring(stackTrace.indexOf('line') + 4, stackTrace.indexOf(',')), 10);
      isRow = true;
      channelService.appendLine('-----------------------------------------------------------');
      channelService.appendLine(stackTrace);
      channelService.appendLine(errorMessage);
      channelService.appendLine('-----------------------------------------------------------');
      channelService.showChannelOutput();
    } else {
      // Just go to the text
      if (test.file) {
        position = test.row;
        isRow = (this.apexTestInfo !== null); // If I derived the test from Apex background, then I have line number. Othewise I have an index
      }
    }

    if (test.file) {
      vscode.window.showTextDocument(test.file).then(() => {
        this.eventsEmitter.emit('Show Highlight', position, isRow);
      });
    }
  }

  public async runSingleTest(test: Test) {
    const tmpFolder = this.getTempFolder();
    const builder = new ReadableApexTestRunCodeActionExecutor([test.name], false, tmpFolder, this);
    const commandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      new EmptyParametersGatherer(),
      builder);
    await commandlet.run();
  }

  public updateSelection(position: number, isRow: boolean) {
    if (isRow) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const line = editor.document.lineAt(position - 1);
        const startPos = new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex);
        editor.selection = new vscode.Selection(startPos, line.range.end);
        editor.revealRange(new vscode.Range(startPos, line.range.end)); // Show selection hopefully
      }
    } else {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const pos = editor.document.positionAt(position);
        const line = editor.document.lineAt(pos.line);
        const startPos = new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex);
        editor.selection = new vscode.Selection(startPos, line.range.end);
        editor.revealRange(new vscode.Range(startPos, line.range.end));
      }
    }
  }

  public getTempFolder(): string {
    if (vscode.workspace.rootPath) {
      let tempFolder = ospath.resolve(vscode.workspace.rootPath, 'tmp');
      while (fs.existsSync(tempFolder)) {
        tempFolder = tempFolder + crypto.randomBytes(16).toString('hex');
      }
      return tempFolder;
    }
    return '';
  }

  public async runApexTests(): Promise<void> {
    await this.refresh();
    const tmpFolder = this.getTempFolder();
    const builder = new ReadableApexTestRunCodeActionExecutor(Array.from(ApexTestOutlineProvider.testStrings.values()), false, tmpFolder, this);
    const commandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      new EmptyParametersGatherer(),
      builder);
    await commandlet.run();
  }

  public readJSONFile(folderName: string) {
    if (vscode.workspace.rootPath) {
      const fullFolderName = ospath.resolve(vscode.workspace.rootPath, folderName);
      const jsonSummary = this.getJSONFileOutput(folderName);
      this.UpdateTestsFromJSON(jsonSummary);
      this._onDidChangeTreeData.fire();
      this.eventsEmitter.emit('Delete Folder', fullFolderName);
    }
  }

  private getJSONFileOutput(fullFolderName: string): FullTestResult {
    const files = fs.readdirSync(fullFolderName);
    let fileName = files[0];
    for (const file of files) {
      if (file !== 'test-result-codecoverage.json' && ospath.extname(file) === '.json' && file.startsWith('test-result')) {
        fileName = file;
      }
    }
    fileName = ospath.join(fullFolderName, fileName);
    const output = fs.readFileSync(fileName).toString();
    const jsonSummary = JSON.parse(output) as FullTestResult;
    return jsonSummary;
  }

  private UpdateTestsFromJSON(jsonSummary: FullTestResult) {
    const groups = new Set<ApexTestGroup>();
    for (const testResult of jsonSummary.tests) {
      const apexGroupName = testResult.FullName.split('.')[0];
      const apexGroup = this.apexTestMap.get(apexGroupName) as ApexTestGroup;
      // Check if new group, if so, set to pass
      if (apexGroup) {
        groups.add(apexGroup);
      }
      const apexTest = this.apexTestMap.get(testResult.FullName) as ApexTest;
      apexTest.passed = true;
      if (apexTest) {
        apexTest.updateIcon(testResult.Outcome);
        if (testResult.Outcome === 'Fail') {
          apexTest.passed = false;
          apexTest.errorMessage = testResult.Message;
          apexTest.stackTrace = testResult.StackTrace;
          apexTest.description = apexTest.stackTrace + '\n' +
            apexTest.errorMessage;
        }
      }
    }
    groups.forEach(group => {
      group.updatePassFailLabel();
      group.description = this.summarize(jsonSummary.summary, group);
    });
  }

  private summarize(summary: TestSummary, group: ApexTestGroup): string {
    let summString = '';
    summString = summString + 'Outcome: ' + summary.outcome + '\n';
    summString = summString + 'Tests Ran: ' + group.children.length + '\n';
    summString = summString + 'Passing: ' + group.passing + '\n';
    const failing = (group.children.length - group.passing);
    summString = summString + 'Failing: ' + failing + '\n';
    summString = summString + 'Skipped: ' + summary.skipped + '\n';
    const groupPassRate = ((group.passing * 100) / group.children.length) + '%';
    const groupFailRate = ((failing * 100) / group.children.length) + '%';
    summString = summString + 'Pass Rate: ' + groupPassRate + '\n';
    summString = summString + 'Fail Rate: ' + groupFailRate + '\n';
    summString = summString + 'Test Start Time: ' + summary.testStartTime + '\n';
    summString = summString + 'Test Execution Time: ' + summary.testExecutionTime + '\n';
    summString = summString + 'Test Total Time: ' + summary.testTotalTime + '\n';
    summString = summString + 'Command Time: ' + summary.commandTime + '\n';
    summString = summString + 'Hostname: ' + summary.hostname + '\n';
    summString = summString + 'Org Id: ' + summary.orgId + '\n';
    summString = summString + 'Username: ' + summary.username + '\n';
    summString = summString + 'Test Run Id: ' + summary.testRunId + '\n';
    summString = summString + 'User Id: ' + summary.userId;
    return summString;
  }

}

export abstract class Test extends vscode.TreeItem {
  public children = new Array<Test>();
  public description: string;
  public name: string;

  constructor(
    public label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public file: vscode.Uri | null,
    public row: number
  ) {
    super(label, collapsibleState);
    this.description = label;
    this.name = label;
  }

  public iconPath = {
    light: LIGHT_BLUE_BUTTON,
    dark: DARK_BLUE_BUTTON
  };

  get tooltip(): string {
    return this.description;
  }

  public updateIcon(outcome: string) {
    if (outcome === 'Pass') {
      // Passed Test
      this.iconPath = {
        light: LIGHT_GREEN_BUTTON,
        dark: DARK_GREEN_BUTTON
      };

    } else {
      // Failed test
      this.iconPath = {
        light: LIGHT_RED_BUTTON,
        dark: DARK_RED_BUTTON
      };
    }
  }

  public abstract contextValue: string;
}

export class ApexTestGroup extends Test {
  public passing: number = 0;

  constructor(
    public label: string,
    public file: vscode.Uri | null,
    public row: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded, file, row);
  }

  public contextValue = 'apexTestGroup';

  public updatePassFailLabel() {
    this.children.forEach(child => {
      if ((child as ApexTest).passed) {
        this.passing++;
      }
    });
    this.label = this.name + ' (' + this.passing + '/' + this.children.length + ')';
    if (this.passing === this.children.length) {
      this.updateIcon('Pass');
    } else {
      this.updateIcon('Fail');
    }
  }

  public updateIcon(outcome: string) {
    super.updateIcon(outcome);
    if (outcome === 'Pass') {
      this.children.forEach(child => {
        // Update all the children as well
        child.updateIcon(outcome);
      });
    }
  }

}

export class ApexTest extends Test {
  public errorMessage: string = '';
  public stackTrace: string = '';
  public passed = false;

  constructor(
    public label: string,
    public file: vscode.Uri | null,
    public row: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.None, file, row);
    this.command = {
      command: 'sfdx.force.test.view.showError',
      title: 'show error',
      arguments: [this]
    };
  }

  public updateIcon(outcome: string) {
    super.updateIcon(outcome);
    if (outcome === 'Pass') {
      this.errorMessage = '';
      this.errorMessage = '';
    }
  }

  public contextValue = 'apexTest';
}

export class ReadableApexTestRunCodeActionExecutor extends ForceApexTestRunCodeActionExecutor {
  private outputToJson: string;
  private apexTestOutline: ApexTestOutlineProvider;

  public constructor(tests: string[], shouldGetCodeCoverage: boolean, outputToJson: string, apexTestOutline: ApexTestOutlineProvider) {
    super(tests.join(','), shouldGetCodeCoverage);
    this.outputToJson = outputToJson;
    this.apexTestOutline = apexTestOutline;
  }

  public build(data: {}): Command {
    this.builder = this.builder
      .withDescription(
        nls.localize('force_apex_test_run_codeAction_description_text')
      )
      .withArg('force:apex:test:run')
      .withFlag('--tests', this.test)
      .withFlag('--resultformat', 'human')
      .withFlag('--outputdir', this.outputToJson)
      .withFlag('--loglevel', 'error');

    if (this.shouldGetCodeCoverage) {
      this.builder = this.builder.withArg('--codecoverage');
    }
    return this.builder.build();
  }

  public async execute(response: ContinueResponse<{}>): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async () => {
      this.apexTestOutline.readJSONFile(this.outputToJson);
    });

    channelService.streamCommandOutput(execution);

    if (this.showChannelOutput) {
      channelService.showChannelOutput();
    }

    await ProgressNotification.show(execution, cancellationTokenSource);

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );

    taskViewService.addCommandExecution(execution, cancellationTokenSource);

  }

}
