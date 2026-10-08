# TypeScript support

Poligo officially supports TypeScript for backend execution.

Supported entrypoints:

- top-level single-file `.ts`
- top-level single-file `.tsx`

TypeScript declaration files such as `.d.ts` are not executable entrypoints, and multi-file TypeScript execution is rejected explicitly.

The production test suite verifies authenticated project creation, single-file TypeScript execution, execution arguments, environment variables, stdin, additional resource files, real TSX/JSX syntax, declaration-file rejection, multi-file rejection, compiler errors, runtime failures, timeouts, project deletion, and sign-out.
