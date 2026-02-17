# 📝 Commit Message Guide

## 🚨 Common Commit Errors & Solutions

When you see commit errors like these:

```
✖ subject may not be empty [subject-empty]
✖ type may not be empty [type-empty]
```

**This means your commit message doesn't follow the required format!**

## ✅ Correct Format

Your commit message must follow this pattern:

```
type: description
```

### Examples of ✅ CORRECT commits:

```bash
git commit -m "feat: add user authentication system"
git commit -m "fix: resolve login button not working"
git commit -m "docs: update README with setup instructions"
git commit -m "style: format code with prettier"
git commit -m "refactor: simplify user validation logic"
```

### Examples of ❌ INCORRECT commits:

```bash
git commit -m "test"                    # ❌ Missing type and colon
git commit -m "added new feature"       # ❌ Missing type
git commit -m "feat:"                   # ❌ Missing description
git commit -m "FIX: bug fix"            # ❌ Wrong case (should be lowercase)
```

## 🔧 Available Types

| Type       | Description              | Example                                   |
| ---------- | ------------------------ | ----------------------------------------- |
| `feat`     | New features             | `feat: add dark mode toggle`              |
| `fix`      | Bug fixes                | `fix: resolve navigation crash`           |
| `docs`     | Documentation changes    | `docs: update API documentation`          |
| `style`    | Code style changes       | `style: format code with prettier`        |
| `refactor` | Code refactoring         | `refactor: simplify authentication logic` |
| `perf`     | Performance improvements | `perf: optimize image loading`            |
| `test`     | Adding or updating tests | `test: add unit tests for user service`   |
| `chore`    | Maintenance tasks        | `chore: update dependencies`              |
| `ci`       | CI/CD changes            | `ci: add GitHub Actions workflow`         |
| `build`    | Build system changes     | `build: update webpack configuration`     |
| `revert`   | Revert previous commits  | `revert: undo last feature commit`        |

## 📋 Quick Reference

### Basic Format:

```
type: description
```

### With Scope (Optional):

```
type(scope): description
```

Example: `feat(auth): add OAuth login`

### With Breaking Changes:

```
type: description

BREAKING CHANGE: description of breaking change
```

## 🚀 Pro Tips

1. **Keep it concise**: Aim for 50 characters or less for the description
2. **Use imperative mood**: "add" not "added", "fix" not "fixed"
3. **Be specific**: "fix: resolve user login issue" not "fix: bug fix"
4. **Start with lowercase**: Always use lowercase for both type and description

## 🔍 Troubleshooting

### If you get "type may not be empty":

- Make sure your commit starts with a valid type
- Check that you have a colon after the type
- Example: `feat: add new feature`

### If you get "subject may not be empty":

- Make sure you have a description after the colon
- Don't just write `feat:` - add a description
- Example: `feat: add new feature`

### If you get "type-case" error:

- Use lowercase for the type
- `feat:` ✅ not `Feat:` ❌

## 📚 Additional Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Commitlint Documentation](https://github.com/conventional-changelog/commitlint)

---

**Need help?** Check this guide or ask your team lead for assistance! 🎯
