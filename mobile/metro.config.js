// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const engineRoot = path.resolve(projectRoot, '..', 'src', 'engine');

const config = getDefaultConfig(projectRoot);

// The cut/nesting engine lives in the web app's tree and is the single source of
// truth for both clients — watch it so edits there hot-reload here too.
config.watchFolders = [engineRoot];

// Only ever resolve packages from this app; the sibling web app has its own.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
