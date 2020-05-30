/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export enum ConflictDisposition {
  Unresolved,
  AcceptLocal,
  AcceptRemote
}

export type ConflictFile = {
  remoteLabel: string;
  fileName: string;
  relPath: string;
  localPath: string;
  remotePath: string;
};

export type ConflictEntry = ConflictFile & {
  type: string;
  disposition: ConflictDisposition;
};
