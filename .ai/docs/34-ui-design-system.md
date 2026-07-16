# 34 - UI Design System

## Purpose

This document defines the UI design system for the KMJ Optical ERP, including color palette, typography, spacing, components, dark mode, responsive design, and Tailwind CSS configuration. Every UI component must follow these standards for consistency.

## Core Principles

1. **Consistency**: Every UI element follows the same design language.
2. **Accessibility**: All components meet WCAG 2.1 AA standards.
3. **Responsiveness**: All components work on desktop, tablet, and mobile.
4. **Dark mode**: All components support dark mode.
5. **Performance**: All components are optimized for fast rendering.

## Detailed Rules

### Color Palette

#### Primary Colors

```css
/* Primary brand color */
--color-primary-50: #eff6ff;
--color-primary-100: #dbeafe;
--color-primary-200: #bfdbfe;
--color-primary-300: #93c5fd;
--color-primary-400: #60a5fa;
--color-primary-500: #3b82f6;  /* Main primary */
--color-primary-600: #2563eb;
--color-primary-700: #1d4ed8;
--color-primary-800: #1e40af;
--color-primary-900: #1e3a8a;
```

#### Neutral Colors

```css
/* Background colors */
--color-bg-primary: #ffffff;
--color-bg-secondary: #f9fafb;
--color-bg-tertiary: #f3f4f6;

/* Text colors */
--color-text-primary: #111827;
--color-text-secondary: #6b7280;
--color-text-tertiary: #9ca3af;

/* Border colors */
--color-border-primary: #e5e7eb;
--color-border-secondary: #d1d5db;
```

#### Semantic Colors

```css
/* Success */
--color-success-50: #f0fdf4;
--color-success-500: #22c55e;
--color-success-700: #15803d;

/* Warning */
--color-warning-50: #fffbeb;
--color-warning-500: #f59e0b;
--color-warning-700: #b45309;

/* Error */
--color-error-50: #fef2f2;
--color-error-500: #ef4444;
--color-error-700: #b91c1c;

/* Info */
--color-info-50: #eff6ff;
--color-info-500: #3b82f6;
--color-info-700: #1d4ed8;
```

### Typography

#### Font Family

```css
/* Primary font */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Monospace font (for code, numbers) */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

#### Font Sizes

```css
/* Headings */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */

/* Line heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

#### Font Weights

```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing

#### Base Spacing

```css
/* Spacing scale (4px base) */
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

#### Component Spacing

```css
/* Card padding */
--card-padding: var(--space-6);

/* Button padding */
--button-padding-x: var(--space-4);
--button-padding-y: var(--space-2);

/* Input padding */
--input-padding-x: var(--space-3);
--input-padding-y: var(--space-2);

/* Section spacing */
--section-gap: var(--space-8);
```

### Components

#### Buttons

```tsx
// Button variants
const buttonVariants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
};

// Button sizes
const buttonSizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

// Button component
function Button({ variant = 'primary', size = 'md', children, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        buttonVariants[variant],
        buttonSizes[size]
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

#### Inputs

```tsx
// Input component
function Input({ label, error, ...props }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        className={cn(
          'block w-full rounded-md border px-3 py-2',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          error
            ? 'border-red-300 text-red-900 placeholder-red-300'
            : 'border-gray-300 placeholder-gray-400'
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

#### Cards

```tsx
// Card component
function Card({ children, className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Card subcomponents
function CardHeader({ children, className }) {
  return (
    <div className={cn('border-b border-gray-200 px-6 py-4', className)}>
      {children}
    </div>
  );
}

function CardContent({ children, className }) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  );
}
```

### Dark Mode

#### Configuration

```css
/* tailwind.config.cjs */
module.exports = {
  darkMode: 'class',
  // ...
};
```

#### Dark Mode Colors

```css
/* Dark mode overrides */
.dark {
  --color-bg-primary: #111827;
  --color-bg-secondary: #1f2937;
  --color-bg-tertiary: #374151;

  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
  --color-text-tertiary: #6b7280;

  --color-border-primary: #374151;
  --color-border-secondary: #4b5563;
}
```

#### Dark Mode Component Example

```tsx
function Card({ children, className }) {
  return (
    <div
      className={cn(
        'rounded-lg border shadow-sm',
        'bg-white border-gray-200',
        'dark:bg-gray-800 dark:border-gray-700',
        className
      )}
    >
      {children}
    </div>
  );
}
```

### Responsive Design

#### Breakpoints

```css
/* Tailwind breakpoints */
sm: 640px;    /* Mobile landscape */
md: 768px;    /* Tablet */
lg: 1024px;   /* Desktop */
xl: 1280px;   /* Large desktop */
2xl: 1536px;  /* Extra large desktop */
```

#### Responsive Patterns

```tsx
// Mobile-first responsive layout
function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Customers" value={1234} />
      <StatCard title="Orders" value={567} />
      <StatCard title="Revenue" value={89000} />
      <StatCard title="Pending" value={23} />
    </div>
  );
}

// Responsive sidebar
function Layout({ children }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar - hidden on mobile */}
      <aside className="hidden lg:block w-64 bg-gray-900">
        <Sidebar />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 lg:p-8">
        {children}
      </main>
    </div>
  );
}
```

### Tailwind Configuration

```javascript
// tailwind.config.cjs
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
```

## Bad Examples

```tsx
// BAD: Inline styles
function Button({ children }) {
  return (
    <button style={{ backgroundColor: 'blue', color: 'white', padding: '10px 20px' }}>
      {children}
    </button>
  );
}

// BAD: Hardcoded colors
<div className="bg-[#3b82f6] text-[#ffffff]">
  Content
</div>

// BAD: Non-responsive layout
<div className="grid grid-cols-4 gap-4">
  {/* Breaks on mobile */}
</div>
```

## Good Examples

```tsx
// GOOD: Using design system tokens
function Button({ variant = 'primary', children }) {
  return (
    <button className={cn(
      'bg-primary-600 text-white',
      'hover:bg-primary-700',
      'px-4 py-2 rounded-md',
      'focus:ring-2 focus:ring-primary-500'
    )}>
      {children}
    </button>
  );
}

// GOOD: Responsive layout
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard title="Customers" value={1234} />
  <StatCard title="Orders" value={567} />
  <StatCard title="Revenue" value={89000} />
  <StatCard title="Pending" value={23} />
</div>

// GOOD: Dark mode support
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  Content
</div>
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Design tokens | Consistency | More setup required |
| Dark mode | User preference | More CSS to maintain |
| Responsive design | Works everywhere | More complex layouts |
| Component library | Reuse | Initial development time |
| Tailwind utility classes | Rapid development | Larger HTML strings |

## Cross-References

- **Frontend standards**: See `docs/08-frontend.md`
- **React patterns**: See `docs/09-react.md`
- **Accessibility**: See `docs/35-accessibility.md`
- **Performance**: See `docs/21-performance.md`
- **Coding standards**: See `docs/05-coding-standards.md`

## AI Instructions

When creating UI components:
1. Always use design tokens (colors, spacing, typography)
2. Always support dark mode
3. Always use responsive design
4. Always ensure accessibility
5. Always use consistent component patterns
6. Never use inline styles
7. Never hardcode colors
8. Never use non-responsive layouts
9. Always test on multiple screen sizes
10. Always follow the Tailwind configuration
