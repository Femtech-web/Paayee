const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  resolveRequest(context, moduleName, platform) {
    if (moduleName === 'isows') {
      return context.resolveRequest(
        { ...context, unstable_enablePackageExports: false },
        moduleName,
        platform,
      );
    }

    if (moduleName.startsWith('zustand')) {
      return context.resolveRequest(
        { ...context, unstable_enablePackageExports: false },
        moduleName,
        platform,
      );
    }

    if (moduleName === 'jose') {
      return context.resolveRequest(
        { ...context, unstable_conditionNames: ['browser'] },
        moduleName,
        platform,
      );
    }

    return context.resolveRequest(context, moduleName, platform);
  },
  sourceExts: [...resolver.sourceExts, 'svg'],
};

module.exports = config;
