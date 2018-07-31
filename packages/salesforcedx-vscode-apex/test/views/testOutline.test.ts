// /*
//  * Copyright (c) 2017, salesforce.com, inc.
//  * All rights reserved.
//  * Licensed under the BSD 3-Clause license.
//  * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
//  */

// // tslint:disable:no-unused-expression
// import { expect } from 'chai';
// import { stub } from 'sinon';
// import { Uri } from 'vscode';
// import { ApexTestRequestInfo } from '../../src';
// import { files } from './fakeFiles';
// import fs = require('fs');
// import { ApexTest, ApexTestGroup, ApexTestOutlineProvider, ReadableApexTestRunCodeActionExecutor } from '../../src/views/testOutline';

// describe('TestView', () => {
//   describe('Test View Outline Provider', () => {
//     let testOutline: ApexTestOutlineProvider;
//     const uriList = new Array<Uri>();
//     const file0Uri = Uri.file('/bogus/path/to/file0.cls');
//     const file1Uri = Uri.file('/bogus/path/to/file1.cls');
//     const file2Uri = Uri.file('/bogus/path/to/file2.cls');
//     const file3Uri = Uri.file('/bogus/path/to/file3.cls');
//     const apexTestInfo: ApexTestRequestInfo[] = new Array<ApexTestRequestInfo>();

//     beforeEach(() => {
//       // All test methods, has same info as file1, file2, file3, file4
//       for (let i = 0; i < 8; i++) {
//         const methodName = 'test' + i;
//         const parent = 'file' + (i / 2); // Parent is either file1, file2, file3, or file4
//         const line = (i / 2) * 4 + 3;
//         const file = '/bogus/path/to/' + parent + '.cls';
//         const testInfo: ApexTestRequestInfo = { methodName, parent, line, file };
//         apexTestInfo.push(testInfo);
//       }

//       // Stub out functions
//       stub(fs, 'readFileSync').callsFake(file => {
//         let ind = 0;
//         if (file.includes('file0.cls')) {
//           // Get File 0
//           ind = 1;
//         } else if (file.includes('file1.cls')) {
//           // Get File 1
//           ind = 2;
//         } else if (file.includes('file2.cls')) {
//           // Get File 2
//           ind = 3;
//         } else {
//           // Get File 3
//           ind = 4;
//         }
//         return files[ind];
//       });
//     });

//     afterEach(() => {
//       stub(fs, 'readFileSync').restore();
//     });

//     it('No tests in file', () => {
//       testOutline = new ApexTestOutlineProvider('/bogus/path', uriList, null);
//       expect(testOutline.getHead()).to.equal(new ApexTestGroup('ApexTests', null, 0));
//     });

//     it('One test in file', () => {
//       uriList.push(file0Uri);
//       testOutline = new ApexTestOutlineProvider('/bogus/path', uriList, null);

//       expect(testOutline.getHead()).to.deep.equal(new ApexTestGroup('ApexTests', null, 0));
//       if (testOutline.getHead()) {
//         expect(testOutline.getHead().children.length).to.equal(1);
//       }
//     });

//   });
// });
