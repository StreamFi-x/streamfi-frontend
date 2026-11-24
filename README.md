[optional body]

[optional footer]

````

Types:

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**
 Pro Tip**: Use `./scripts/test-commit.sh "your message"` to test your commit message before committing!

Example:

```bash
npm run commit
# This will open an interactive prompt to create a properly formatted commit
````

### Git Hooks

The following hooks are automatically run:

- **pre-commit**: Formats and lints staged files
- **commit-msg**: Validates commit message format

If you encounter installation issues, try these steps:

```bash
npm cache clean --force
rm -rf node_modules
rm package-lock.json
npm install
```

##

Development Tools

### Code Formatting & Linting

This project uses several tools to maintain code quality:

- **Prettier**: Code formatting
- **ESLint**: Code linting
- **Husky**: Git hooks
- **lint-staged**: Pre-commit formatting
- **commitlint**: Commit message validation
- **commitizen**: Interactive commit messages

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run format:check # Check if code is formatted

# Testing
npm run test         # Run tests

# Database
npm run setup-db     # Setup database
npm run update-schema # Update user schema

# Environment
npm run env:generate # Regenerate .env.example from process.env usage in code
npm run env:check    # Verify .env.example is current (what CI runs)

# Committing
npm run commit       # Interactive commit (recommended)
```

### Local Development Setup

The app depends on several external services. Only Postgres has a practical
local equivalent, so that's what's provided here (#1713):

1. **Postgres** — start a local instance with Docker:

   ```bash
   docker compose up -d postgres
   ```

   Then set both of these in `.env.local` (the serverless Postgres driver and
   `@vercel/postgres` read different variable names for the same database):

   ```bash
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/streamfi_dev
   POSTGRES_URL=postgres://postgres:postgres@localhost:5432/streamfi_dev
   ```

   Then create the schema:

   ```bash
   npm run setup-db
   npm run db:migrate
   ```

2. **Upstash Redis** — no local equivalent needed. Leave
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` unset and the app
   runs without a cache (`lib/upstash-redis.ts` returns `null` and callers
   degrade gracefully). Only set these if you need to test caching behavior
   against a real Upstash sandbox database.

3. **Mux, Privy, Stellar Horizon** — no safe local equivalent exists for
   these (Mux needs real video assets, Privy is an auth provider, Stellar
   Horizon is a live network). Use sandbox/testnet credentials for each
   from a non-production account; any feature exercising them will not
   work locally without real credentials set.

Copy `.env.example` (kept current by `npm run env:check` in CI — see
[Available Scripts](#available-scripts)) to `.env.local` and fill in only
the variables your work actually touches; most integrations validate
themselves and stay inert when unset.

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:

```bash
npm run commit
# This will open an interactive prompt to create a properly formatted commit
```

### Git Hooks

The following hooks are automatically run:

- **pre-commit**: Formats and lints staged files
- **commit-msg**: Validates commit message format

##

Branch Naming Convention

We follow a structured branch naming format:

```
[fix|feat|chore]-[issue-number]-[short-description]
```

Example:

```
feat-23-livepeer-integration
fix-45-streaming-bug
```

##

Contributing

We are always excited to welcome passionate developers and contributors to help shape the future of StreamFi. Whether you're improving existing features, fixing bugs, or bringing innovative ideas to the table, your contributions are invaluable. To get started, check out our [
Contribution Guide](https://github.com/StreamFi-x/streamfi-frontend/blob/main/CONTRIBUTING.md) for detailed instructions on how to contribute effectively.

##

Community & Support

- Join our [Telegram](https://t.me/+slCXibBFWF05NDQ0) for discussions and support.

##

License

This project is licensed under the MIT License.
."(bdeaec5f1344e4fffb26079ea963ece4698b285e2Bfile:///Users/dumtochukwu/Desktop/wave/streamfi-frontend/README.md:8file:///Users/dumtochukwu/Desktop/wave/streamfi-frontend
....