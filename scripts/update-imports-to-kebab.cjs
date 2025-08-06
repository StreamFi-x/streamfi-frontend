// update-imports-to-kebab.cjs (CommonJS format)

const path = require('path');

function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  return j(fileInfo.source)
    .find(j.ImportDeclaration)
    .forEach(pathNode => {
      const importPath = pathNode.node.source.value;

      if (
        importPath.startsWith('@/') &&
        /[A-Z_]/.test(importPath)
      ) {
        const parts = importPath.split('/');
        const fileName = parts.pop();
        const kebabFileName = toKebabCase(fileName);
        const newImportPath = [...parts, kebabFileName].join('/');
        pathNode.node.source.value = newImportPath;
      }
    })
    .toSource();
};

module.exports.parser = 'tsx';
