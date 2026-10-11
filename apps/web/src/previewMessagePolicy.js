export function isTrustedPreviewMessage(event, previewWindow) {
  return Boolean(
    previewWindow &&
    event &&
    event.source === previewWindow &&
    event.data?.source === 'poligo-preview'
  )
}
