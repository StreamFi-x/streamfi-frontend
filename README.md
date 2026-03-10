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

**
 Pro Tip**: Use `./scripts/test-commit.sh "your message"` to test your commit message before committing!

Example:

```bash
npm run commit
# This will open an interactive prompt to create a properly formatted commit
```

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

# Committing
npm run commit       # Interactive commit (recommended)
```

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
