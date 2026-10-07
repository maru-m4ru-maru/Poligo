const languages = {
  python: {
    image: process.env.PYTHON_IMAGE || 'python:3.13.15-slim-bookworm',
    entrypoint: 'main.py',
    command: (file, files, args) => [
      'python',
      '/workspace/' + file,
      ...(args || [])
    ]
  },
  c: {
    image: process.env.GCC_IMAGE || 'gcc:16.2.0-trixie',
    entrypoint: 'main.c',
    command: (file, files, args) => [
      'sh',
      '-lc',
      'gcc -O2 -std=c23 ' +
        getSourceArguments(files, ['.c'], file) +
        ' -o /tmp/poligo && exec /tmp/poligo "$@"',
      'poligo',
      ...(args || [])
    ]
  },
  cpp: {
    image: process.env.GCC_IMAGE || 'gcc:16.2.0-trixie',
    entrypoint: 'main.cpp',
    command: (file, files, args) => [
      'sh',
      '-lc',
      'g++ -x c++ -O2 -std=c++23 ' +
        getSourceArguments(files, ['.cpp', '.cc', '.cxx', '.C'], file) +
        ' -o /tmp/poligo && exec /tmp/poligo "$@"',
      'poligo',
      ...(args || [])
    ]
  }
}

function getSourceArguments(files, extensions, entrypoint) {
  const sourceFiles = Object.keys(files || {})
    .filter(file => {
      const lower = file.toLowerCase()

      return extensions.some(extension =>
        lower.endsWith(extension) ||
        file.endsWith(extension.toUpperCase())
      )
    })
    .sort()

  if (!sourceFiles.length) {
    return '/workspace/' + shellQuote(entrypoint)
  }

  return sourceFiles
    .map(file => '/workspace/' + shellQuote(file))
    .join(' ')
}

function shellQuote(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'"
}

export function getLanguage(language) {
  return languages[language] || null
}

export function listLanguages() {
  return Object.keys(languages)
}
