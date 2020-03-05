import { existsSync } from 'fs';
import { sep } from 'path';
import * as registryData from '../data/registry.json';
import { META_XML_SUFFIX } from './constants';
import { MetadataComponent, MetadataType, SourcePath } from './types';

/**
 * Get metadata type information.
 *
 * @param name Name of the metadata type
 */
export function getTypeFromName(name: string): MetadataType {
  const lower = name.toLowerCase().replace(/ /g, '');
  if (!registryData.types[lower]) {
    throw new Error(`Missing metadata type definition for ${lower}`);
  }
  return registryData.types[lower];
}

/**
 * Get the metadata component(s) from a file path.
 *
 * __Current limitations:__
 * - `fsPath` must be a single file - no directories.
 * - Only one component can be returned at a time.
 * - Only types with file suffixes, non-decomposed, single SourcePath
 *
 * @param fsPath File path for a piece of metadata
 */
export function getComponentsFromPath(fsPath: string): MetadataComponent[] {
  const pathParts = fsPath.split(sep);
  const file = pathParts[pathParts.length - 1];
  const extensionIndex = file.indexOf('.');
  const fileName = file.substring(0, extensionIndex);
  const fileExtension = file.substring(extensionIndex + 1);

  if (!existsSync(fsPath)) {
    throw new Error(`file not found ${fsPath}`);
  }

  let typeId: string;
  let componentName = fileName;
  let xmlPath: SourcePath;
  const sources = new Set<SourcePath>();

  // attempt 1 - try treating the file extension as a suffix
  if (registryData.suffixes[fileExtension]) {
    xmlPath = `${fsPath}${META_XML_SUFFIX}`;
    if (!existsSync(xmlPath)) {
      throw new Error(`metadata xml file missing for ${file}`);
    }
    typeId = registryData.suffixes[fileExtension];
    sources.add(fsPath);
  }
  // attempt 2 - check if it's a metadata xml file
  if (!typeId) {
    const match = fileExtension.match(/(.+)-meta\.xml/);
    if (match) {
      const sourcePath = fsPath.slice(0, fsPath.lastIndexOf(META_XML_SUFFIX));
      if (existsSync(sourcePath)) {
        sources.add(sourcePath);
      }
      typeId = registryData.suffixes[match[1]];
      xmlPath = fsPath;
    }
  }
  // attempt 3 - check if the file is part of a bundle
  // if (!typeId) {
  //   const pathPartsSet = new Set(pathParts);
  //   for (const directoryName of Object.keys(registry.bundles)) {
  //     if (pathPartsSet.has(directoryName)) {
  //       typeId = registry.bundles[directoryName];
  //       // components of a bundle type are assumed to have their direct parent be the type's directoryName
  //       componentName =
  //         pathParts[pathParts.findIndex(part => part === directoryName) + 1];
  //       break;
  //     }
  //   }
  // }

  if (!typeId) {
    throw new Error('Types missing a defined suffix are currently unsupported');
  } else if (!registryData.types[typeId]) {
    throw new Error(`Missing metadata type definition for ${typeId}`);
  }

  const type = registryData.types[typeId] as MetadataType;
  if (type.inFolder) {
    // component names of types with folders have the format folderName/componentName
    componentName = `${pathParts[pathParts.length - 2]}/${fileName}`;
  }

  return [
    {
      name: componentName,
      type,
      xmlPath,
      sources: Array.from(sources)
    }
  ];
}
