const path = require('path');
const glob = require('glob');
const DIST = path.resolve(__dirname);

const getEntryObject = () => {
  const entryArray = glob.sync('src/**/*.ts');
  const srcObj = entryArray.reduce((acc, item) => {
    const modulePath = item.replace(/\.ts$/g, '');
    const outputModulePath = path.join('out', modulePath);

    if (!acc.hasOwnProperty(outputModulePath)) {
      // webpack requires the object to be in this format
      // { 'out/src/modes/cssMode': './src/modes/cssMode.ts' }
      acc[outputModulePath] = '.' + path.join(path.sep, `${modulePath}.ts`);
    }

    return acc;
  }, {});

  if (getMode() !== 'development') {
    return srcObj;
  }

  const entryTestArray = glob.sync('test/**/*.ts');
  const testObj = entryTestArray.reduce((acc, item) => {
    const modulePath = item.replace(/\.ts$/g, '');
    const outputModulePath = path.join('out', modulePath);

    if (!acc.hasOwnProperty(outputModulePath)) {
      // webpack requires the object to be in this format
      // { 'out/test/unit/cli/commandExecutorTest': './test/unit/cli/commandExecutorTest.ts' }
      acc[outputModulePath] = '.' + path.join(path.sep, `${modulePath}.ts`);
    }

    return acc;
  }, {});

  return Object.assign(testObj, srcObj);
};

const getMode = () => {
  const webpackMode = process.env.NODE_ENV || 'development';
  console.log(`Running in ${webpackMode} mode`);
  return webpackMode;
};

module.exports = {
  // extensions run in a node context
  target: 'node',
  mode: getMode(),
  entry: getEntryObject(),
  // vsix packaging depends on commonjs2
  output: {
    path: DIST,
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: `webpack:///salesforcedx-visualforce-language-server/[resource-path]`
  },
  // include source maps
  devtool: 'source-map',
  // excluding dependencies from getting bundled
  externals: {
    // vscode: 'commonjs vscode',
    'vscode-css-languageservice': 'commonjs vscode-css-languageservice',
    'vscode-languageserver': 'commonjs vscode-languageserver',
    'vscode-languageserver-protocol': 'commonjs vscode-languageserver-protocol',
    'vscode-languageserver-types': 'commonjs vscode-languageserver-types',
    'vscode-nls': 'commonjs vscode-nls',
    'vscode-uri': 'commonjs vscode-uri'
  },
  // Automatically resolve certain extensions.
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  // pre-process certain file types using loaders
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules|\.d\.ts$/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
};
