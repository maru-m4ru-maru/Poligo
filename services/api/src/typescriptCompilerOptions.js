export function getTypeScriptCompilerOptions(entrypoint) {
  if (typeof entrypoint !== 'string') {
    throw new TypeError('TypeScript entrypoint must be a string')
  }

  // TSX is transpiled by the API before submission, while plain TS is compiled by Judge0.
  return entrypoint.toLowerCase().endsWith('.tsx')
    ? ''
    : '--target ES2022'
}
