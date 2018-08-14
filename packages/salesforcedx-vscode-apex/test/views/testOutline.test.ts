/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression
import { expect } from 'chai';
import * as vscode from 'vscode';
import { APEX_GROUP_RANGE } from '../../src/constants';
import { nls } from '../../src/messages';
import { ApexTestMethod } from '../../src/views/lspConverter';
import {
  ApexTestGroupNode,
  ApexTestOutlineProvider
} from '../../src/views/testOutlineProvider';

const LOADING_MESSAGE = nls.localize('force_test_view_loading_message');
const NO_TESTS_MESSAGE = nls.localize('force_test_view_no_tests_message');
const NO_TESTS_DESCRIPTION = nls.localize(
  'force_test_view_no_tests_description'
);

describe('TestView', () => {
  describe('Test View Outline Provider', () => {
    let testOutline: ApexTestOutlineProvider;
    const apexTestInfo: ApexTestMethod[] = new Array<ApexTestMethod>();

    beforeEach(async () => {
      // All test methods, has same info as file1, file2, file3, file4
      for (let i = 0; i < 8; i++) {
        const methodName = 'test' + i;
        const definingType = 'file' + Math.floor(i / 2); // Parent is either file1, file2, file3, or file4
        const line = i / 2 * 4 + 3;
        const startPos = new vscode.Position(line, 0);
        const endPos = new vscode.Position(line, 5);
        const file = '/bogus/path/to/' + definingType + '.cls';
        const uri = vscode.Uri.file(file);
        const location = new vscode.Location(
          uri,
          new vscode.Range(startPos, endPos)
        );
        const testInfo: ApexTestMethod = {
          methodName,
          definingType,
          location
        };
        apexTestInfo.push(testInfo);
      }
    });

    it('No tests in file', () => {
      testOutline = new ApexTestOutlineProvider('/bogus/path', null);
      const expected = new ApexTestGroupNode('ApexTests', null);
      expected.description = NO_TESTS_DESCRIPTION;
      expect(testOutline.getHead()).to.deep.equal(
        new ApexTestGroupNode('ApexTests', null)
      );
    });

    it('One test in file', () => {
      testOutline = new ApexTestOutlineProvider(
        '/bogus/path/',
        apexTestInfo.slice(0, 1)
      );
      if (testOutline.getHead()) {
        expect(testOutline.getHead().name).to.equal('ApexTests');
        expect(testOutline.getHead().children.length).to.equal(1);
        const testChildGroup = testOutline.getHead().children[0];
        expect(testChildGroup).instanceof(ApexTestGroupNode);
        const groupLocation = new vscode.Location(
          apexTestInfo[0].location.uri,
          APEX_GROUP_RANGE
        );
        expect(testChildGroup.location).to.deep.equal(groupLocation);
        expect(testChildGroup.name).to.equal(apexTestInfo[0].definingType);
        expect(testChildGroup.children.length).to.equal(1);
        const testChild = testChildGroup.children[0];
        const fullName =
          apexTestInfo[0].definingType + '.' + apexTestInfo[0].methodName;
        expect(testChild.name).to.deep.equal(fullName);
        expect(testChild.location).to.deep.equal(apexTestInfo[0].location);
      }
    });

    it('8 tests in 4 files', () => {
      testOutline = new ApexTestOutlineProvider('/bogus/path/', apexTestInfo);
      if (testOutline.getHead()) {
        console.log(testOutline.getHead());
        expect(testOutline.getHead().children.length).to.equal(4);
        let i = 0;
        for (const testChildGroup of testOutline.getHead().children) {
          const testInfo1 = apexTestInfo[i];
          i++;
          const testInfo2 = apexTestInfo[i];
          console.log(testChildGroup);
          expect(testChildGroup.children.length).to.equal(2); // Each group has two children
          expect(testChildGroup.name).to.equal(testInfo1.definingType);
          const groupLocation = new vscode.Location(
            testInfo1.location.uri,
            APEX_GROUP_RANGE
          );
          expect(testChildGroup.location).to.deep.equal(groupLocation);
          // Check child test
          const test1 = testChildGroup.children[0];
          const test2 = testChildGroup.children[1];
          const fullName1 = testInfo1.definingType + '.' + testInfo1.methodName;
          const fullName2 = testInfo2.definingType + '.' + testInfo2.methodName;
          expect(test1.name).to.equal(fullName1);
          expect(test2.name).to.equal(fullName2);
          expect(test1.location).to.deep.equal(testInfo1.location);
          expect(test2.location).to.deep.equal(testInfo2.location);
          i++;
        }
      }
    });
  });
});
