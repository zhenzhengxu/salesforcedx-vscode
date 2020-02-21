/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { JsonArray, JsonMap } from '@salesforce/ts-types';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ConfigSource, ConfigUtil } from '../../../src/util';

describe('getConfigSource', () => {
  let getConfigValueStub: sinon.SinonStub<
    [string, (ConfigSource.Local | ConfigSource.Global | undefined)?],
    Promise<string | number | boolean | JsonMap | JsonArray | null | undefined>
  >;
  beforeEach(() => {
    getConfigValueStub = sinon.stub(ConfigUtil, 'getConfigValue');
  });
  afterEach(() => {
    getConfigValueStub.restore();
  });
  it('should return ConfigSource.Local if the key/value is in the local config', async () => {
    getConfigValueStub.onCall(0).returns(Promise.resolve('someValue'));
    const configSource = await ConfigUtil.getConfigSource('key');
    expect(configSource).to.be.eq(ConfigSource.Local);
  });
  it('should return ConfigSource.Global if the key/value is in the global config', async () => {
    getConfigValueStub.onCall(0).returns(Promise.resolve(undefined));
    getConfigValueStub.onCall(1).returns(Promise.resolve('someValue'));
    const configSource = await ConfigUtil.getConfigSource('key');
    expect(configSource).to.be.eq(ConfigSource.Global);
  });
  it('should return ConfigSource.None if the key/value is not in the local or global config', async () => {
    getConfigValueStub.onCall(0).returns(Promise.resolve(undefined));
    getConfigValueStub.onCall(1).returns(Promise.resolve(undefined));
    const configSource = await ConfigUtil.getConfigSource('key');
    expect(configSource).to.be.eq(ConfigSource.None);
  });
});
