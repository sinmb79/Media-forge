# GitHub Publication Checklist

Use this checklist before pushing this repository to a public GitHub remote.

## Files that should usually be committed

- `src/`
- `tests/`
- `docs/`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `.gitignore`
- `README.md`

## Files that should not be committed

- `node_modules/`
- `dist/`
- `.env` and `.env.*`
- log files
- IDE caches
- temporary exports
- credentials, keys, certificates, or personal notes

## Public push review steps

1. Confirm `.gitignore` exists and includes secret-related patterns.
2. Review the exact file list before staging or pushing.
3. Exclude any local experiment, export, or debug artifact.
4. Check that no personal paths, tokens, or API keys are embedded in source or docs.
5. Keep the public repository limited to source, tests, docs, and required project metadata.

## Secret handling rule

Do not store secrets in this workspace. Keep them outside the repository and read them only when required at runtime.
