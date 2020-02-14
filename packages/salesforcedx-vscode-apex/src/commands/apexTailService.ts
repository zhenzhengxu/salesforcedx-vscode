/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface ApexTailHandler {
  stop(): Promise<void>;
}

export class ApexTailService {
  private static _instance: ApexTailService;

  public static get instance() {
    if (ApexTailService._instance === undefined) {
      ApexTailService._instance = new ApexTailService();
    }
    return ApexTailService._instance;
  }

  private handlers: Set<ApexTailHandler> = new Set();

  public isHandlerRegistered() {
    return this.handlers.size > 0;
  }

  public registerHandler(handler: ApexTailHandler) {
    this.handlers.add(handler);
  }

  public clearHandler(handler: ApexTailHandler) {
    if (handler) {
      this.handlers.delete(handler);
    }
  }

  public getHandlers() {
    return [...this.handlers];
  }

  public async stopService() {
    if (this.handlers.size > 0) {
      const promises = [...this.handlers].map(handler => handler.stop());
      await Promise.all(promises);
      this.handlers.clear();
      console.log('successfully stopped Apex Tail command');
    } else {
      console.log('Apex Tail command was not running');
    }
  }
}
