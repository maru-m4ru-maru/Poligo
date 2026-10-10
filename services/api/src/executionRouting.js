export function shouldUseJudge0(language, runnerConfigured) {
  return !runnerConfigured || language === 'typescript'
}
