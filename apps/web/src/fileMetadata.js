export function lookupFileMetadata(extension, metadata) {
  if (
    typeof extension !== 'string' ||
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    !Object.prototype.hasOwnProperty.call(metadata, extension)
  ) {
    return null
  }

  return metadata[extension]
}
