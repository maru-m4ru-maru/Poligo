const languages = {
  python: {
    image: process.env.PYTHON_IMAGE || 'python:3.13.15-slim-bookworm',
    entrypoint: 'main.py',
    command: file => ['python', '/workspace/' + file]
  },
  c: {
    image: process.env.GCC_IMAGE || 'gcc:16.2.0-trixie',
    entrypoint: 'main.c',
    command: file => [
      'sh',
      '-lc',
      'gcc -O2 -std=c23 /workspace/' + shellQuote(file) + ' -o /tmp/poligo && /tmp/poligo'
    ]
  },
  cpp: {
    image: process.env.GCC_IMAGE || 'gcc:16.2.0-trixie',
    entrypoint: 'main.cpp',
    command: file => [
      'sh',
      '-lc',
      'g++ -O2 -std=c++23 /workspace/' + shellQuote(file) + ' -o /tmp/poligo && /tmp/poligo'
    ]
  }
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
