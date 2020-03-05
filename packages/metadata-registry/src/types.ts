/**
 * Properties of a metadata type.
 */
export type MetadataType = {
  name: string;
  /**
   * Name of the directory where components are located in a package
   */
  directoryName: string;
  /**
   * Whether or not components are stored in folders.
   *
   * __Examples:__ Reports, Dashboards, Documents, EmailTemplates
   */
  inFolder: boolean;
  /**
   * File suffix
   *
   * Some types may not have one, such as those made up of varying file extensions.
   *
   * __Examples:__ LightningComponentBundles, Documents, StaticResources
   */
  suffix?: string;
  /**
   * Names of the subtypes if the type has any.
   */
  childXmlNames?: string[];
};

/**
 * Source information about a single metadata component.
 */
export type MetadataComponent = {
  fullName: string;
  type: MetadataType;
  /**
   * Path to the -meta.xml file.
   */
  xmlPath: SourcePath;
  /**
   * Paths to additional source files, if any.
   */
  sources: SourcePath[];
};

/**
 * File system path to a source file of a metadata component.
 */
export type SourcePath = string;

/**
 * Describes the shape of the registry data.
 */
export type MetadataRegistry = {
  types: {
    [metadataId: string]: MetadataType;
  };
  suffixes: {
    [suffix: string]: string;
  };
  mixedContent: {
    [directoryName: string]: string;
  };
};
