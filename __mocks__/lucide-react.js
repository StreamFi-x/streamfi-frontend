/* eslint-disable @typescript-eslint/no-require-imports */
// Mock for lucide-react to avoid ESM parsing issues in Jest
const React = require("react");

const createIcon = name =>
  function MockIcon({ className, ...props }) {
    return React.createElement("svg", {
      "data-testid": `icon-${name}`,
      className,
      ...props,
    });
  };

module.exports = new Proxy(
  {},
  {
    get(_, prop) {
      return createIcon(prop);
    },
  }
);
