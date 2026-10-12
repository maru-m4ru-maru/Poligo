# Technology and UI icon sources

Poligo keeps its own logo separate from external technology marks. Programming-language and runtime templates use the corresponding publisher's logo where a publisher-provided asset is available. For brands that do not publish a distributable standalone icon, the project uses an established icon-library representation and records that distinction here rather than describing it as publisher-owned artwork.

## Language and runtime marks

| Icon file or source | Source and usage note |
|---|---|
| `nodejs.svg` | The official Node.js hexadecimal mark from [nodejs.org's source repository](https://github.com/nodejs/nodejs.org/blob/main/apps/site/public/static/logos/nodejsHex.svg). Follow the [Node.js brand policy](https://nodejs.org/en/about/branding). |
| `html5.svg` | [Simple Icons: HTML5](https://github.com/simple-icons/simple-icons/blob/develop/icons/html5.svg). |
| `css.svg` | [Simple Icons: CSS](https://github.com/simple-icons/simple-icons/blob/develop/icons/css.svg). |
| `javascript.svg` | [Simple Icons: JavaScript](https://github.com/simple-icons/simple-icons/blob/develop/icons/javascript.svg). |
| `typescript.svg` | The canonical [Simple Icons TypeScript mark](https://github.com/simple-icons/simple-icons/blob/develop/icons/typescript.svg), replacing the previous hand-drawn lookalike. |
| `python.svg` | [Simple Icons: Python](https://github.com/simple-icons/simple-icons/blob/develop/icons/python.svg). |
| `c.svg` | [Simple Icons: C](https://github.com/simple-icons/simple-icons/blob/develop/icons/c.svg). |
| `cplusplus.svg` | [Simple Icons: C++](https://github.com/simple-icons/simple-icons/blob/develop/icons/cplusplus.svg). |
| C# icon | The [C# logo distributed by Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/media/logo_csharp.png) is loaded from Microsoft's host. It is not recreated in Poligo. |
| `java.svg` | The Java cup mark distributed by [Devicon's Java original icon](https://github.com/devicons/devicon/blob/master/icons/java/java-original.svg). Java's mark is a trademark; refer to Oracle's [Java logo and licensing guidance](https://www.oracle.com/java/java-affinity/download-buttons/) before changing its use. Simple Icons currently does not distribute a Java icon. |
| `go.svg` | The canonical [Simple Icons Go mark](https://github.com/simple-icons/simple-icons/blob/develop/icons/go.svg). |
| `rust.svg` | The canonical [Simple Icons Rust mark](https://github.com/simple-icons/simple-icons/blob/develop/icons/rust.svg). |
| `php.svg` | The canonical [Simple Icons PHP mark](https://github.com/simple-icons/simple-icons/blob/develop/icons/php.svg). |
| `ruby.svg` | The canonical [Simple Icons Ruby mark](https://github.com/simple-icons/simple-icons/blob/develop/icons/ruby.svg). |
| `kotlin.svg` | The canonical [Simple Icons Kotlin mark](https://github.com/simple-icons/simple-icons/blob/develop/icons/kotlin.svg). |

Simple Icons is a community-maintained catalog of brand marks, not the trademark owner. The artwork above is copied from the catalog's current SVG for those brands. Review the [Simple Icons disclaimer](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md) and each brand's guidelines before changing or republishing marks. The C# logo is intentionally loaded from Microsoft's published image because the current Simple Icons catalog no longer provides a C# mark.

## Interface icons

Functional controls are not language brands. Poligo uses unbranded icons from [Lucide](https://github.com/lucide-icons/lucide) rather than text glyphs or hand-drawn pseudo-logos:

| Asset | Lucide source |
|---|---|
| `folder-kanban.svg` | [folder-kanban](https://github.com/lucide-icons/lucide/blob/main/icons/folder-kanban.svg) |
| `user-round.svg` | [user-round](https://github.com/lucide-icons/lucide/blob/main/icons/user-round.svg) |
| `shield-check.svg` | [shield-check](https://github.com/lucide-icons/lucide/blob/main/icons/shield-check.svg) |
| `file-code.svg` | [file-code](https://github.com/lucide-icons/lucide/blob/main/icons/file-code.svg) |

The downloaded Lucide paths use a muted neutral stroke to fit the existing theme; their geometry is unmodified. Keep controls accessible (decorative sidebar icons remain hidden from assistive technology because their buttons have visible text) and check both dashboard and account-page variants when replacing an asset.

## Additional semantic SVG assets

The following assets are copied from the upstream Lucide SVGs. The source geometry is unchanged; only the stroke color is set to a neutral tone for Poligo's themes. Keep the upstream source link with the asset when updating it.

| Local asset | Upstream Lucide source | Use |
|---|---|---|
| activity-files.svg | https://github.com/lucide-icons/lucide/blob/main/icons/files.svg | Explorer activity |
| activity-search.svg | https://github.com/lucide-icons/lucide/blob/main/icons/search.svg | Search activity |
| activity-source.svg | https://github.com/lucide-icons/lucide/blob/main/icons/git-branch.svg | Source control activity |
| activity-ai.svg | https://github.com/lucide-icons/lucide/blob/main/icons/sparkles.svg | AI activity |
| activity-preview.svg | https://github.com/lucide-icons/lucide/blob/main/icons/monitor.svg | Preview activity |
| activity-settings.svg | https://github.com/lucide-icons/lucide/blob/main/icons/sliders-horizontal.svg | Settings activity |
| ui-pencil.svg | https://github.com/lucide-icons/lucide/blob/main/icons/pencil.svg | Rename |
| ui-trash-2.svg | https://github.com/lucide-icons/lucide/blob/main/icons/trash.svg | Delete |
| ui-file-plus-2.svg | https://github.com/lucide-icons/lucide/blob/main/icons/file-plus.svg | New file |
| ui-upload.svg | https://github.com/lucide-icons/lucide/blob/main/icons/upload.svg | Upload |
| ui-folder.svg | https://github.com/lucide-icons/lucide/blob/main/icons/folder.svg | Folder |
| ui-refresh.svg | https://github.com/lucide-icons/lucide/blob/main/icons/refresh-cw.svg | Refresh preview |
| ui-external-link.svg | https://github.com/lucide-icons/lucide/blob/main/icons/external-link.svg | Open preview in a new tab |
| ui-chevron-down.svg | https://github.com/lucide-icons/lucide/blob/main/icons/chevron-down.svg | Expand / dropdown |
| ui-chevron-up.svg | https://github.com/lucide-icons/lucide/blob/main/icons/chevron-up.svg | Collapse |
| ui-x.svg | https://github.com/lucide-icons/lucide/blob/main/icons/x.svg | Close dialog |
| ui-plus.svg | https://github.com/lucide-icons/lucide/blob/main/icons/plus.svg | Create project |
| file-braces.svg | https://github.com/lucide-icons/lucide/blob/main/icons/file-braces.svg | JSON / structured source file |
| file-key.svg | https://github.com/lucide-icons/lucide/blob/main/icons/file-key.svg | Environment file |
| file-cog.svg | https://github.com/lucide-icons/lucide/blob/main/icons/file-cog.svg | Configuration file |
| file-text.svg | https://github.com/lucide-icons/lucide/blob/main/icons/file-text.svg | Text and Markdown documents |

Language logos remain restricted to language and runtime cards; a file in the IDE tree never borrows a language's trademark logo. A generic source-file glyph is deliberately shared by source-code files, while JSON, environment, configuration, and text documents receive distinct file-type symbols. Decorative images use empty alt text; buttons keep accessible names in their text or ARIA labels.

| ui-chevron-right.svg | https://github.com/lucide-icons/lucide/blob/main/icons/chevron-right.svg | Folder disclosure |
| ui-play.svg | https://github.com/lucide-icons/lucide/blob/main/icons/play.svg | Run project |
| ui-circle-x.svg | https://github.com/lucide-icons/lucide/blob/main/icons/circle-x.svg | Error indicators |
| ui-circle-alert.svg | https://github.com/lucide-icons/lucide/blob/main/icons/circle-alert.svg | Warning and diagnostic indicators |
| ui-arrow-right.svg | https://github.com/lucide-icons/lucide/blob/main/icons/arrow-right.svg | Primary call-to-action direction |
