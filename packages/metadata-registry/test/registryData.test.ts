/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'assert';
import { registryData } from '../src';

describe('Registry Data', () => {
  it('should not allow adding new properties', () => {
    try {
      registryData.suffixes['new'] = 'new';
      fail('should not have been able to add a property');
    } catch (e) {}
  });

  it('should not allow changing existing properties', () => {
    try {
      registryData.types.apexclass.inFolder = false;
      fail('should not have been able to change a property');
    } catch (e) {}
  });

  it('should not allow deleting properties', () => {
    try {
      delete registryData.types.apexclass;
      fail('should not have been able to delete a property');
    } catch (e) {}
  });
});
