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
import { channelService } from '../channels';
import { SfdxCommandlet, SfdxWorkspaceChecker } from '../commands';
import { EmptyParametersGatherer } from '../commands/commands';
import { ForceApexTestRunCodeActionExecutor } from '../commands/forceApexTestRunCodeAction';
import { nls } from '../messages';

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
  private static testStrings: string[] = new Array<string>();

  constructor(private path: string, private apexClasses: vscode.Uri[]) {
    this.head = null;
    this.getAllApexTests(this.path);
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

  public async refresh() {
    this.head = null; // Reset tests
    this.apexClasses = await vscode.workspace.findFiles('**/*.cls');
    this.getAllApexTests(this.path);
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: Test): vscode.TreeItem {
    if (element) {
      return element;
    } else {
      this.getAllApexTests(this.path);
      if (this.head && this.head.children.length > 0) {
        return this.head;
      } else {
        return new ApexTest('No tests in folder', null, 0);
      }
    }
  }

  private getAllApexTests(path: string): void {
    if (this.head == null) { // Starting Out
      this.head = new ApexTestGroup('ApexTests', null, 0);
    }
    this.apexClasses.forEach(apexClass => {
      const fileContent = fs.readFileSync(apexClass.fsPath).toString();
      if (fileContent && fileContent.toLowerCase().includes('@istest')) {
        const testName = ospath.basename(apexClass.toString()).replace('.cls', '');
        const newApexTestGroup = new ApexTestGroup(testName, apexClass, 0);
        this.apexTestMap.set(testName, newApexTestGroup);
        this.addTests(fileContent, newApexTestGroup);
        ApexTestOutlineProvider.testStrings.push(testName);
        if (this.head) {
          this.head.children.push(newApexTestGroup);
        }
      }
    });
    // Now, active events that we need
    this.eventsEmitter.on('Delete Folder', this.deleteFolderRecursive); // Activate event to delete folder
    this.eventsEmitter.on('Show Highlight', this.updateSelection);

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
        apexTest.fullName = apexTestGroup.label + '.' + name;
        this.apexTestMap.set(apexTest.fullName, apexTest);
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
    let isError = false;

    if (errorMessage && errorMessage !== '') {
      const stackTrace = test.stackTrace;
      position = parseInt(stackTrace.substring(stackTrace.indexOf('line') + 4, stackTrace.indexOf(',')), 10);
      isError = true;
      channelService.appendLine('-----------------------------------------------------------');
      channelService.appendLine(stackTrace);
      channelService.appendLine(errorMessage);
      channelService.appendLine('-----------------------------------------------------------');
      channelService.showChannelOutput();
    } else {
      // Just go to the text
      if (test.file) {
        position = test.row;
        isError = false;
      }
    }

    if (test.file) {
      vscode.window.showTextDocument(test.file);
      this.eventsEmitter.emit('Show Highlight', position, isError);
      // if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.toString() === test.file.toString()) {
      //   // Don't need to wait to change
      //   this.updateSelection(position, isError);
      // } else { // Subscribe to window changing event
      //   vscode.window.onDidChangeActiveTextEditor(() => {
      //     this.updateSelection(position, isError);
      //   });
      // }
    }
  }

  public async runSingleTest(test: ApexTest) {
    const tmpFolder = this.getTempFolder();
    const builder = new ReadableApexTestRunCodeActionExecutor([test.fullName], false, tmpFolder, this);
    const commandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      new EmptyParametersGatherer(),
      builder);
    await commandlet.run();
  }

  public updateSelection(position: number, isError: boolean) {
    if (isError) { // here because of an error
      console.log('Error on line:' + position);
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const line = editor.document.lineAt(position - 1);
        const startPos = new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex);
        editor.selection = new vscode.Selection(startPos, line.range.end);
      }
    } else { // here to show something
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const pos = editor.document.positionAt(position);
        const line = editor.document.lineAt(pos.line);
        const startPos = new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex);
        console.log(position);
        console.log(line);
        editor.selection = new vscode.Selection(startPos, line.range.end);
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
    const tmpFolder = this.getTempFolder();
    const builder = new ReadableApexTestRunCodeActionExecutor(ApexTestOutlineProvider.testStrings, false, tmpFolder, this);
    const commandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      new EmptyParametersGatherer(),
      builder);
    await commandlet.run();
  }

  public readJSONFile(folderName: string) {
    if (vscode.workspace.rootPath) {
      const fullFolderName = ospath.resolve(vscode.workspace.rootPath, folderName);
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
      const groupInfo = new Map<ApexTestGroup, TestSummary>();
      for (const testResult of jsonSummary.tests) {
        const apexGroupName = testResult.FullName.split('.')[0];
        const apexGroup = this.apexTestMap.get(apexGroupName) as ApexTestGroup;
        // Check if new group, if so, set to pass
        if (apexGroup && !groupInfo.get(apexGroup)) {
          groupInfo.set(apexGroup, jsonSummary.summary);
        }
        const currentInfo = groupInfo.get(apexGroup);
        if (currentInfo) {
          groupInfo.set(apexGroup, currentInfo);
        }
        const apexTest = this.apexTestMap.get(testResult.FullName) as ApexTest;
        apexTest.passed = true;
        if (apexTest) {
          apexTest.updateIcon(testResult.Outcome);
          if (testResult.Outcome === 'Fail') {
            apexTest.passed = false;
            apexTest.errorMessage = testResult.Message;
            apexTest.stackTrace = testResult.StackTrace;
          }
        }
      }
      groupInfo.forEach((summary, group) => {
        group.updatePassFailLabel();
        group.description = this.summarize(summary);
      });
      this._onDidChangeTreeData.fire();
      this.eventsEmitter.emit('Delete Folder', fullFolderName);
    }
  }

  private summarize(summary: TestSummary): string {
    let summString = '';
    summString = summString + 'Outcome: ' + summary.outcome + '\n';
    summString = summString + 'Tests Ran: ' + summary.testsRan + '\n';
    summString = summString + 'Passing: ' + summary.passing + '\n';
    summString = summString + 'Failing: ' + summary.failing + '\n';
    summString = summString + 'Skipped: ' + summary.skipped + '\n';
    summString = summString + 'Pass Rate: ' + summary.passRate + '\n';
    summString = summString + 'Fail Rate: ' + summary.failRate + '\n';
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

  constructor(
    public label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public file: vscode.Uri | null,
    public row: number
  ) {
    super(label, collapsibleState);
  }

  public iconPath = {
    light: LIGHT_BLUE_BUTTON,
    dark: DARK_BLUE_BUTTON
  };

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
  public description: string;
  public name: string;

  constructor(
    public label: string,
    public file: vscode.Uri | null,
    public row: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded, file, row);
    this.name = label;
    this.description = this.label;
  }

  public contextValue = 'apexTestGroup';

  public updatePassFailLabel() {
    let passed = 0;
    this.children.forEach(child => {
      if ((child as ApexTest).passed) {
        passed++;
      }
    });
    this.label = this.name + ' (' + passed + '/' + this.children.length + ')';
    if (passed === this.children.length) {
      this.updateIcon('Pass');
    } else {
      this.updateIcon('Fail');
    }
  }

  get tooltip(): string {
    return this.description;
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
  public fullName: string;

  constructor(
    public label: string,
    public file: vscode.Uri | null,
    public row: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.None, file, row);
    this.fullName = label;
  }

  get tooltip(): string {
    return this.label;
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

    execution.processExitSubject.subscribe(async status => {
      this.apexTestOutline.readJSONFile(this.outputToJson);
    });

    await this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

}
