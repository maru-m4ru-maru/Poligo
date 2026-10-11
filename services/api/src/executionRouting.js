export function shouldUseJudge0(language, runnerConfigured, runnerExecutionReady = runnerConfigured) {
  return !runnerConfigured || language === 'typescript' || !runnerExecutionReady
}

export function normalizeJudge0Language(language) {
  return language === 'node' ? 'javascript' : language
}
