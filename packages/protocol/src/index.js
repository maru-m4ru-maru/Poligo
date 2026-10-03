export const API_VERSION = 'v1'

export const ExecutionStatus = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
})

export function createExecutionRequest({
  language,
  files,
  entrypoint = null,
  args = []
}) {
  return {
    apiVersion: API_VERSION,
    language,
    files,
    entrypoint,
    args
  }
}
