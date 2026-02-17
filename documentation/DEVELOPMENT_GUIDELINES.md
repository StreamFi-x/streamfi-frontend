# 🚀 Development Guidelines

## 📋 Table of Contents

- [Code Quality Standards](#code-quality-standards)
- [Component Guidelines](#component-guidelines)
- [Performance Best Practices](#performance-best-practices)
- [Security Guidelines](#security-guidelines)
- [Testing Standards](#testing-standards)
- [Git Workflow](#git-workflow)
- [Environment Setup](#environment-setup)

## 🎯 Code Quality Standards

### TypeScript

- ✅ Always use TypeScript for new code
- ✅ Define proper interfaces and types
- ✅ Avoid `any` type - use proper typing
- ✅ Use strict mode in `tsconfig.json`

### Naming Conventions

```typescript
// ✅ Good
const userProfile = { name: "John" };
const UserProfileComponent = () => {};
const API_ENDPOINT = "/api/users";

// ❌ Bad
const up = { name: "John" };
const user_profile = { name: "John" };
const apiEndpoint = "/api/users";
```

### File Structure

```
components/
├── feature/
│   ├── ComponentName.tsx
│   ├── ComponentName.test.tsx
│   ├── ComponentName.styles.ts
│   └── index.ts
```

## 🧩 Component Guidelines

### Component Structure

```typescript
// ✅ Good component structure
import React from 'react';
import { ComponentProps } from './types';

interface Props extends ComponentProps {
  title: string;
  onAction?: () => void;
}

export const ComponentName: React.FC<Props> = ({
  title,
  onAction,
  children,
  ...props
}) => {
  // Hooks first
  const [state, setState] = useState();

  // Event handlers
  const handleClick = useCallback(() => {
    onAction?.();
  }, [onAction]);

  // Effects
  useEffect(() => {
    // Effect logic
  }, []);

  // Render
  return (
    <div {...props}>
      <h1>{title}</h1>
      {children}
    </div>
  );
};
```

### Component Rules

- ✅ Use functional components with hooks
- ✅ Keep components small and focused
- ✅ Use proper prop types and interfaces
- ✅ Implement error boundaries for critical components
- ✅ Use React.memo for expensive components
- ❌ Avoid inline styles and functions

## ⚡ Performance Best Practices

### Optimization Techniques

```typescript
// ✅ Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{expensiveCalculation(data)}</div>;
});

// ✅ Use useCallback for event handlers
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);

// ✅ Use useMemo for expensive calculations
const expensiveValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);

// ✅ Lazy load components
const LazyComponent = lazy(() => import('./LazyComponent'));
```

### Image Optimization

```typescript
// ✅ Use Next.js Image component
import Image from 'next/image';

<Image
  src="/image.jpg"
  alt="Description"
  width={500}
  height={300}
  priority={isAboveFold}
  placeholder="blur"
/>
```

## 🔒 Security Guidelines

### Input Validation

```typescript
// ✅ Always validate user input
import { z } from "zod";

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const validateUser = (data: unknown) => {
  return userSchema.safeParse(data);
};
```

### API Security

- ✅ Use HTTPS in production
- ✅ Implement rate limiting
- ✅ Validate all inputs
- ✅ Use environment variables for secrets
- ✅ Implement proper CORS policies

### XSS Prevention

```typescript
// ✅ Sanitize user input
import DOMPurify from "dompurify";

const sanitizedHtml = DOMPurify.sanitize(userInput);
```

## 🧪 Testing Standards

### Test Structure

```typescript
// ✅ Good test structure
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle user interactions', () => {
    const mockHandler = jest.fn();
    render(<ComponentName onAction={mockHandler} />);

    fireEvent.click(screen.getByRole('button'));
    expect(mockHandler).toHaveBeenCalled();
  });
});
```

### Testing Rules

- ✅ Write tests for all components
- ✅ Test user interactions, not implementation
- ✅ Use meaningful test descriptions
- ✅ Mock external dependencies
- ✅ Aim for 70%+ code coverage

## 🔄 Git Workflow

### Branch Naming

```
feature/user-authentication
fix/login-button-issue
docs/update-readme
refactor/auth-logic
```

### Commit Messages

```
feat: add user authentication system
fix: resolve login button not working
docs: update API documentation
refactor: simplify authentication logic
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes and commit with proper messages
3. Run tests and linting locally
4. Create PR with detailed description
5. Request code review
6. Merge after approval

## 🛠 Environment Setup

### Required Tools

- Node.js 18+
- npm or yarn
- Git
- VS Code (recommended)

### VS Code Extensions

- ESLint
- Prettier
- TypeScript Importer
- Auto Rename Tag
- Bracket Pair Colorizer

### Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Run linting
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

## 📊 Code Review Checklist

### Before Submitting PR

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] No linting errors
- [ ] TypeScript compilation successful
- [ ] Performance considerations addressed
- [ ] Security best practices followed
- [ ] Documentation updated
- [ ] No console.log statements in production code

### During Code Review

- [ ] Code is readable and maintainable
- [ ] Proper error handling implemented
- [ ] Performance optimizations applied
- [ ] Security vulnerabilities addressed
- [ ] Tests cover edge cases
- [ ] Accessibility considerations

## 🚨 Common Pitfalls to Avoid

### Performance Issues

```typescript
// ❌ Don't create functions in render
const Component = () => {
  return <button onClick={() => console.log('clicked')}>Click</button>;
};

// ✅ Use useCallback
const Component = () => {
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);

  return <button onClick={handleClick}>Click</button>;
};
```

### Security Issues

```typescript
// ❌ Don't use dangerouslySetInnerHTML without sanitization
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ Sanitize first
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

### TypeScript Issues

```typescript
// ❌ Don't use any
const data: any = response.data;

// ✅ Use proper typing
interface ApiResponse {
  data: User[];
}
const data: ApiResponse = response.data;
```

---

**Remember**: These guidelines help maintain code quality and team productivity. Follow them consistently! 🎯
