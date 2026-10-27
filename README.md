# pathwise backend

Everything server-side for the pathwise app, in `ap-south-1`:

| Folder | What | Tool |
|---|---|---|
| `amplify/` | Cognito auth: Google and email/password sign-in (custom auth Lambdas) | Amplify Gen 2 |
| `src/` + `serverless.yml` | REST API (Lambda + API Gateway HTTP API), TypeScript | Serverless Framework v3 |
| `terraform/` | Network (VPC, subnets, security groups), RDS PostgreSQL, SSM parameters | Terraform |

The database **schema and migrations** live in the separate `database` repo (Alembic).

## Setup

```bash
npm install
npm run sandbox            # deploy your Amplify auth sandbox, writes ../pathwise/amplify_outputs.json
```

Infrastructure (once per environment; creates paid resources — RDS is ~US$15–18/month):

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars   # add your IP
npm run tf:init && npm run tf:plan
npm run tf:apply
```

`package.json` keeps the name `pathwise` on purpose: Amplify names the sandbox stack after it, so changing it would create a new, empty user pool.

## API

Code is layered so each part has one job:

```
src/
├── jobs/
│   ├── handlers.ts          HTTP only: validate input, call the repository, shape the response
│   ├── jobFilters.ts        zod schema for the query string (types inferred from it)
│   ├── jobsRepository.ts    SQL only, with Knex; one small function per filter
│   └── jobs.types.ts        response shapes
├── lib/
│   ├── config.ts            zod-validated environment (fails fast, never prints values)
│   ├── db.ts                Knex instance, reused while the Lambda container is warm
│   ├── http.ts              JSON responses; errors never expose internals
│   └── logger.ts            one JSON line per log entry (searchable in CloudWatch)
└── health/handler.ts
```

### `GET /jobs`

Public (guests can browse). Every filter is optional and they combine.

| Query | Example | Meaning |
|---|---|---|
| `verified` | `true` | Only companies marked verified |
| `last24Hours` | `true` | Posted in the last 24 hours |
| `age` | `0-3`, `3-7`, `7-15`, `15-30`, `30+` | Days since posted |
| `lat`, `lng`, `radiusKm` | `13.34`, `74.74`, `25` | Within the radius (default 25 km, max 200); results sorted nearest first with `distance_km` |
| `q` | `react` | The app's search box: title (substring or typo), company, city or skill name |
| `title` | `develper` | Title only: substring match plus typo-tolerant match (pg_trgm) |
| `skills` | `react,python` | Has any of these skill slugs (max 10) |
| `companies` | `<uuid>,<uuid>` | From these companies (max 20) |
| `city` | `Udupi` | Exact city (used by the map's company sheet) |
| `experience` | `3` | Jobs whose experience range includes this many years |
| `sort` | `newest`, `oldest`, `salary`, `nearest` | Order. Default `newest`, or `nearest` when `lat`/`lng` are given; `nearest` needs them; `salary` puts undisclosed salaries last |
| `page`, `pageSize` | `1`, `20` | Paging; `pageSize` max 50 |

Unknown parameters are rejected with `400`, so typos don't silently return everything.

```json
{
  "jobs": [{
    "job_id": "…", "job_title": "Frontend Developer", "job_type": "full_time", "work_mode": "hybrid",
    "city": "Udupi", "lat": 13.34, "lng": 74.74, "distance_km": 2.1,
    "min_experience_years": 1, "max_experience_years": 3, "min_ctc_lpa": 3.5, "max_ctc_lpa": 5.2,
    "posted_at": "2026-10-27T10:12:00.000Z",
    "company": { "company_id": "…", "company_name": "Robosoft Technologies", "logo_url": null, "is_verified": true },
    "skills": [{ "skill_id": "…", "skill_name": "React", "slug": "react" }]
  }],
  "page": 1, "page_size": 20, "total": 37
}
```

### `GET /jobs/map`

Map pins for the same filters as `/jobs` (no paging): one pin per company per city, at the centre of that company's matching jobs there.

```json
{ "pins": [{ "company_id": "…", "company_name": "Freshworks", "is_verified": true, "city": "Bengaluru", "lat": 12.97, "lng": 77.59, "open_jobs_count": 8 }] }
```

Tapping a pin in the app lists that company's jobs with `/jobs?companies=<company_id>&city=<city>`, so the sheet and the pin's count always agree.

### `GET /jobs/filters`

Skills and companies that have open jobs, with counts, for the filter chips: `{ "skills": [{ skill_id, skill_name, slug, job_count }], "companies": [{ company_id, company_name, is_verified, job_count }] }`.

### `GET /health`

`{ "status": "ok" }`, no database access.

## Commands

```bash
npm test                   # Jest: API and Amplify Lambda tests (no AWS, no database)
npm run typecheck          # API and Amplify TypeScript
npx serverless invoke local -f listJobs --data '{"queryStringParameters":{"verified":"true","pageSize":"3"}}'
                           # runs a function on your machine against the dev RDS (reads SSM; creates nothing)
npm run deploy:api         # deploys the API (Lambda + API Gateway) — pay-per-request, ~free at demo traffic
```

## Decisions

- **Lambdas run inside the VPC, without a NAT gateway.** They reach RDS privately through their security group; there is no internet access from them, which keeps the setup free. A function that later needs the internet (e.g. an AI API) should run outside the VPC.
- **Database settings come from SSM at deploy time** (`serverless.yml` → `${ssm:…}`), written there by Terraform. The password is a SecureString; it ends up in the Lambda's environment, which is acceptable for a demo; read it at runtime instead before production.
- **RDS certificates are verified** with the official bundle in `src/lib/certs/` (`rejectUnauthorized: true`), and RDS itself refuses non-TLS connections.
- **Knex for queries:** composable filters and bound parameters; raw SQL only for PostGIS and pg_trgm, always with bindings.
- **Serverless v3** (v4 requires a Serverless account login). It doesn't know `nodejs22.x` yet and only warns; Node 20 is deprecated on Lambda.
- **Tests use ts-jest.** `@swc/jest` was dropped: its native binary refuses to load on machines where a parent of the cache directory is writable by other users.
