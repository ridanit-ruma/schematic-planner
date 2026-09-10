# Running Schematic Planner on Kubernetes

The cluster-agnostic half of a deployment. Nothing here names a host, a storage
class, an ingress controller or a secret — an installation supplies those in an
overlay, the same way `deploy/compose.yaml` leaves them to a `.env` file.

```
postgres.yaml   the database, and the volume it keeps
api.yaml        the server: REST, MCP and the collaboration socket
web.yaml        Caddy, serving both front ends and proxying /api
config.yaml     the settings that are not secret
```

## What an installation must supply

- **A Secret named `schematic-planner`** holding `DATABASE_URL`,
  `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and, while
  sign-up is behind a code, `REGISTRATION_CODE`. The Deployments read it with
  `envFrom`, so a missing one stops them at `CreateContainerConfigError` rather
  than starting with a blank secret.
- **A storage class**, patched onto both PersistentVolumeClaims. Set it before
  the first apply: a bound volume's class cannot be changed afterwards.
- **The address it answers on**, patched into the `schematic-planner` ConfigMap
  as `API_PUBLIC_URL`, `APP_PUBLIC_URL` and `CORS_ORIGINS`.
- **A way in**, reaching the `schematic-planner-web` Service on port 8080. An
  Ingress, or a tunnel pointed straight at it.

## Two things that are not preferences

**The API runs one replica, and replaces rather than rolls.** The collaboration
server is embedded in it: every open plan is a live document held in that
process's memory. A second replica would hold its own copy of the same plan and
the two would drift apart, silently, with each browser seeing whichever it
happened to connect to.

**Migrations run as an init container, not a Job.** They have to complete before
the process that serves the schema starts, on every rollout and not only the
first — and with one replica there is no second writer to race with.
