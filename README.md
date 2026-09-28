# RateBoard (Stereolinkz)

Internal app for managing forex and proof-of-funds (POF) rates and
generating 1080 × 1920 WhatsApp Status images.

Context files live in `context/`; start with `context/ai-workflow-rules.md`.
Page designs (the visual spec) live in `docs/design/`.

## Stack

- Next.js 16 (App Router) + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui + Lucide React
- PostgreSQL + Prisma
- Clerk (sign-in); access comes from our own `Membership` table
- Satori + `@resvg/resvg-js` for server-side PNG rendering
- Vercel (hosting, Blob storage)

## Running locally

Requires Node 22+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

## Scripts

| Script                            | What it does                                |
| --------------------------------- | ------------------------------------------- |
| `npm run dev`                     | Start the dev server                        |
| `npm run build`                   | Production build                            |
| `npm run lint`                    | ESLint                                      |
| `npm run typecheck`               | Generate route types and run `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier write / check                      |
| `npm run db:generate`             | Generate the Prisma client                  |
| `npm run db:migrate`              | Create and apply a migration (development)  |
| `npm run db:deploy`               | Apply pending migrations (target database)  |
| `npm run db:studio`               | Open Prisma Studio                          |
| `npm run db:seed`                 | Seed the Stereolinkz organization and data  |
