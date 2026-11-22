// Public settings only. No secrets belong in this file.
// Replace the placeholders after the infra identity deployment.
window.POKEDEX_CONFIG = {
  tenantId: "<tenant-id>",
  clientId: "<pokedex-ui-spa-client-id>",
  apiBaseUrl: "https://<pokedex-backend-fqdn>",
  apiScope: "api://pokedex-api/access_as_user"
};
