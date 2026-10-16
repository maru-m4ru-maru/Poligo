const LANGUAGE_TYPES = {
  html: { name: 'HTML', language: 'html', icon: '/icons/html5.svg' },
  htm: { name: 'HTML', language: 'html', icon: '/icons/html5.svg' },
  css: { name: 'CSS', language: 'css', icon: '/icons/css.svg' },
  js: { name: 'JavaScript', language: 'javascript', icon: '/icons/javascript.svg' },
  jsx: { name: 'JavaScript JSX', language: 'javascript', icon: '/icons/javascript.svg' },
  mjs: { name: 'JavaScript', language: 'javascript', icon: '/icons/javascript.svg' },
  cjs: { name: 'JavaScript', language: 'javascript', icon: '/icons/javascript.svg' },
  ts: { name: 'TypeScript', language: 'typescript', icon: '/icons/typescript.svg' },
  tsx: { name: 'TypeScript JSX', language: 'typescript', icon: '/icons/typescript.svg' },
  mts: { name: 'TypeScript', language: 'typescript', icon: '/icons/typescript.svg' },
  cts: { name: 'TypeScript', language: 'typescript', icon: '/icons/typescript.svg' },
  py: { name: 'Python', language: 'python', icon: '/icons/python.svg' },
  java: { name: 'Java', language: 'java', icon: '/icons/java.svg' },
  go: { name: 'Go', language: 'go', icon: '/icons/go.svg' },
  rs: { name: 'Rust', language: 'rust', icon: '/icons/rust.svg' },
  php: { name: 'PHP', language: 'php', icon: '/icons/php.svg' },
  rb: { name: 'Ruby', language: 'ruby', icon: '/icons/ruby.svg' },
  kt: { name: 'Kotlin', language: 'kotlin', icon: '/icons/kotlin.svg' },
  kts: { name: 'Kotlin', language: 'kotlin', icon: '/icons/kotlin.svg' },
  cs: { name: 'C#', language: 'csharp', icon: 'https://learn.microsoft.com/en-us/dotnet/media/logo_csharp.png' },
  c: { name: 'C', language: 'c', icon: '/icons/c.svg' },
  h: { name: 'C Header', language: 'c', icon: '/icons/c.svg' },
  cpp: { name: 'C++', language: 'cpp', icon: '/icons/cplusplus.svg' },
  cc: { name: 'C++', language: 'cpp', icon: '/icons/cplusplus.svg' },
  cxx: { name: 'C++', language: 'cpp', icon: '/icons/cplusplus.svg' },
  hpp: { name: 'C++ Header', language: 'cpp', icon: '/icons/cplusplus.svg' },
  hh: { name: 'C++ Header', language: 'cpp', icon: '/icons/cplusplus.svg' },
  hxx: { name: 'C++ Header', language: 'cpp', icon: '/icons/cplusplus.svg' },
  json: { name: 'JSON', language: 'json', icon: '/icons/file-braces.svg' },
  jsonc: { name: 'JSON with Comments', language: 'json', icon: '/icons/file-braces.svg' },
  md: { name: 'Markdown', language: 'markdown', icon: '/icons/file-text.svg' },
  mdx: { name: 'MDX', language: 'markdown', icon: '/icons/file-text.svg' },
  txt: { name: 'テキスト', language: 'plaintext', icon: '/icons/file-text.svg' },
  log: { name: 'ログ', language: 'plaintext', icon: '/icons/file-text.svg' },
  xml: { name: 'XML', language: 'xml', icon: '/icons/file-code.svg' },
  svg: { name: 'SVG', language: 'xml', icon: '/icons/file-code.svg' },
  yaml: { name: 'YAML', language: 'yaml', icon: '/icons/file-cog.svg' },
  yml: { name: 'YAML', language: 'yaml', icon: '/icons/file-cog.svg' },
  toml: { name: 'TOML', language: 'ini', icon: '/icons/file-cog.svg' },
  ini: { name: 'INI', language: 'ini', icon: '/icons/file-cog.svg' },
  cfg: { name: '設定ファイル', language: 'ini', icon: '/icons/file-cog.svg' },
  conf: { name: '設定ファイル', language: 'ini', icon: '/icons/file-cog.svg' },
  sh: { name: 'Shell', language: 'shell', icon: '/icons/file-code.svg' },
  bash: { name: 'Bash', language: 'shell', icon: '/icons/file-code.svg' },
  zsh: { name: 'Zsh', language: 'shell', icon: '/icons/file-code.svg' },
  sql: { name: 'SQL', language: 'sql', icon: '/icons/file-code.svg' },
  dockerfile: { name: 'Dockerfile', language: 'dockerfile', icon: '/icons/file-cog.svg' },
  makefile: { name: 'Makefile', language: 'makefile', icon: '/icons/file-cog.svg' },
  r: { name: 'R', language: 'r', icon: '/icons/file-code.svg' },
  swift: { name: 'Swift', language: 'swift', icon: '/icons/file-code.svg' },
  lua: { name: 'Lua', language: 'lua', icon: '/icons/file-code.svg' },
  perl: { name: 'Perl', language: 'perl', icon: '/icons/file-code.svg' },
  pl: { name: 'Perl', language: 'perl', icon: '/icons/file-code.svg' },
  ex: { name: 'Elixir', language: 'elixir', icon: '/icons/file-code.svg' },
  exs: { name: 'Elixir', language: 'elixir', icon: '/icons/file-code.svg' }
}

const SPECIAL_FILES = {
  '.env': { name: 'Environment', language: 'ini', icon: '/icons/file-key.svg' },
  '.env.example': { name: 'Environment Template', language: 'ini', icon: '/icons/file-key.svg' },
  '.gitignore': { name: 'Git Ignore', language: 'plaintext', icon: '/icons/file-cog.svg' },
  '.dockerignore': { name: 'Docker Ignore', language: 'plaintext', icon: '/icons/file-cog.svg' },
  license: { name: 'LICENSE', language: 'plaintext', icon: '/icons/file-text.svg' },
  makefile: { name: 'Makefile', language: 'makefile', icon: '/icons/file-cog.svg' },
  dockerfile: { name: 'Dockerfile', language: 'dockerfile', icon: '/icons/file-cog.svg' }
}

export function getCommunityFileMetadata(filePath) {
  const name = String(filePath || '').split('/').pop() || String(filePath || '')
  const lowerName = name.toLowerCase()
  const special = SPECIAL_FILES[lowerName]

  if (special) {
    return { ...special, extension: '' }
  }

  const dot = name.lastIndexOf('.')
  const rawExtension = dot > 0 ? name.slice(dot + 1) : ''
  const extension = rawExtension.toLowerCase()
  const metadata = LANGUAGE_TYPES[extension] || {
    name: 'ソースファイル',
    language: 'plaintext',
    icon: '/icons/file-code.svg'
  }

  if (name.endsWith('.C')) {
    return {
      name: 'C++',
      language: 'cpp',
      icon: '/icons/cplusplus.svg',
      extension: 'C'
    }
  }

  return { ...metadata, extension }
}
