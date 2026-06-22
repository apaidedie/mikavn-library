# Windows Code Signing

MikaVN Library release artifacts should be signed before a public Windows release. A trusted OV/EV code signing certificate or a trusted signing service is required to reduce Windows SmartScreen warnings. A self-signed certificate can help local trust testing, but it does not create public publisher reputation.

## Requirements

- Windows SDK `signtool.exe` installed or available on `PATH`.
- A trusted OV/EV code signing certificate in the CurrentUser or LocalMachine certificate store.
- The certificate private key must be available to the signing user.
- Timestamp service access, for example `http://timestamp.digicert.com`.

## Check Current Artifacts

Before signing, check whether this machine has a usable trusted code-signing certificate:

```powershell
npm run release:signing:certificate:check
```

For a public release gate, require a trusted non-self-signed code-signing certificate candidate:

```powershell
npm run release:signing:certificate:require
```

This preflight scans the CurrentUser and LocalMachine personal certificate stores. A public release candidate must be unexpired, have an available private key, include Code Signing EKU, build a trusted chain, and not be self-signed.

```powershell
npm run release:signing:check
```

For a public release gate, require valid signatures:

```powershell
npm run release:signing:require
```

## Sign A Release

Build first:

```powershell
npm run tauri:build
```

`npm run tauri:build` is the updater-signed release build and requires `TAURI_SIGNING_PRIVATE_KEY` when updater artifacts are enabled. For local smoke testing without updater signing secrets, use:

```powershell
npm run tauri:build:local
```

Then sign the release executable and installer with a trusted certificate thumbprint:

```powershell
npm run release:sign -- -CertificateThumbprint YOUR_CERT_THUMBPRINT
```

The signing script signs `src-tauri/target/release/mikavn-library.exe` first, then the NSIS installer. It uses SHA-256 digests and RFC 3161 timestamping through `signtool.exe`.

After signing, run:

```powershell
npm run release:signing:require
npm run smoke:install
```

## Current Local Build Note

If `release:signing:check` reports `NotSigned`, the build is usable for local testing but should not be treated as a signed public release. Do not ship a self-signed installer as a SmartScreen mitigation.
