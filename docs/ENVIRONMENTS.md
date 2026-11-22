# Environments

Branch-to-environment mapping: `../../docs/BRANCHING_AND_RELEASE.md` in the project folder.

## GitHub environment variables (set in `dev` and `itg`)

| Name | Type | Value |
|---|---|---|
| `AZURE_TENANT_ID` | variable | Tenant ID |
| `UI_CLIENT_ID` | variable | Client ID of `pokedex-ui-spa` (one app for all environments) |
| `API_BASE_URL` | variable | Backend URL for this environment, `https://ca-backend-pokedex-<env>.<region>.azurecontainerapps.io` |
| `API_SCOPE` | variable | `api://pokedex-api/access_as_user` |

## GitHub environment secret (set in `dev` and `itg`)

| Name | Value |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token of `swa-pokedex-<env>-<suffix>`. The only stored secret in the platform. |

## Config is generated at build time

`scripts/render-config.sh` writes `src/config.js` from the variables above. The committed `src/config.js` is a placeholder for local use only.
