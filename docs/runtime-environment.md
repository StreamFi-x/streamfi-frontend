# Runtime environment

The environment schema inventories named environment reads. The app also
uses provider defaults such as the Vercel Postgres connection configuration.
Variables for a disabled integration can be omitted. Keep server credentials
in the deployment secret store and expose only variables intended for browser
use with the `NEXT_PUBLIC_` prefix.

| Feature | Configuration |
| --- | --- |
| Database | Use `POSTGRES_URL` for application queries. CLI and migration scripts can also use their documented database URLs. |
| Privy sign-in | Supply `NEXT_PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET`. Configure the Privy webhook secret before enabling callbacks. |
| Mux streams | Supply the Mux token ID and secret. Configure signing credentials and webhook secret when using signed playback and callbacks. |
| Stellar | Use `NEXT_PUBLIC_STELLAR_NETWORK` for network selection. Configure the RPC, issuer, and encryption settings for the features that use them. |
| Transak | Supply `NEXT_PUBLIC_TRANSAK_API_KEY` when fiat funding is enabled. |

Use `validateEnvironment` with an explicit environment object in server code
or tooling. Validation reports variable names. Keep production and test
credentials separate.
