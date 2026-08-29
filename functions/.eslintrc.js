module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "*.js"
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": 0,
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    "object-curly-spacing": 0,
    "max-len": 0,
    "require-jsdoc": 0,
    "valid-jsdoc": 0,
    "camelcase": 0,
    "quote-props": 0,
    "@typescript-eslint/no-explicit-any": 0
  },
};
