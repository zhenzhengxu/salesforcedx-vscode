import { sep } from 'path';
import * as registry from './registry.json';

export type MetadataType = {
  name: string;

  /**
   * Name of the directory where components of the type are located in a package
   */
  directoryName: string;

  /**
   * Whether or not components of the type are stored in folders. E.g. Reports, Dashboards, Documents, EmailTemplates
   */
  inFolder: boolean;

  /**
   * File suffix for the metadata type.
   *
   * Usually dictates the metadata xml file extension of
   * the format `.[suffix]-meta.xml`. Some types may not have one, such as bundle types like
   * LightningComponentBundles, AuraDefinitionBundles, etc.
   */
  suffix?: string;
};

export type MetadataComponent = {
  name: string;
  type: MetadataType;
};

/**
 * Get metadata type information.
 * @param name Name of the metadata type
 */
export function getTypeFromName(name: string): MetadataType {
  const lower = name.toLowerCase().replace(/ /g, '');
  if (!registry.types[lower]) {
    throw new Error(`Missing metadata type definition for ${lower}`);
  }
  return registry.types[lower];
}

/**
 * Get the metadata component(s) from a file path.
 * @param filePath File path for a piece of metadata
 */
export function getComponentsFromPath(filePath: string): MetadataComponent[] {
  const pathParts = filePath.split(sep);
  const file = pathParts[pathParts.length - 1];
  const extensionIndex = file.indexOf('.');
  const fileName = file.substring(0, extensionIndex);
  const fileExtension = file.substring(extensionIndex + 1);

  let typeId: string;
  let componentName = fileName;

  // attempt 1 - try treating the file extension as a suffix
  if (registry.suffixes[fileExtension]) {
    typeId = registry.suffixes[fileExtension];
  }
  // attempt 2 - check if it's a metadata xml file
  if (!typeId) {
    const match = fileExtension.match(/(.+)-meta\.xml/);
    if (match) {
      typeId = registry.suffixes[match[1]];
    }
  }
  // attempt 3 - check if the file is part of a bundle
  if (!typeId) {
    const pathPartsSet = new Set(pathParts);
    for (const directoryName of Object.keys(registry.bundles)) {
      if (pathPartsSet.has(directoryName)) {
        typeId = registry.bundles[directoryName];
        // components of a bundle type are assumed to have their direct parent be the type's directoryName
        componentName =
          pathParts[pathParts.findIndex(part => part === directoryName) + 1];
        break;
      }
    }
  }

  if (!typeId) {
    throw new Error(`Unable to determine a type from ${filePath}`);
  } else if (!registry.types[typeId]) {
    throw new Error(`Missing metadata type definition for ${typeId}`);
  }

  const type = registry.types[typeId] as MetadataType;
  if (type.inFolder) {
    // component names of types with folders have the format folderName/componentName
    componentName = `${pathParts[pathParts.length - 2]}/${fileName}`;
  }

  return [{ name: componentName, type }];
}
