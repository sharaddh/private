# Frontend Development Checklist

> **Purpose:** Comprehensive checklist for frontend development covering component quality, accessibility, performance, responsive design, dark mode, testing, and documentation.
> **AI Instructions:** Use this checklist when performing any frontend development work. Go through each section sequentially. Check off items as completed. If an item does not apply, mark it with `- [x] N/A` and note why. Every section must be explicitly addressed — do not skip any.

---

## Pre-Development Checklist

Before writing any frontend code, ensure a solid foundation.

- [ ] **Design mockups are reviewed and understood** — Study the design file (Figma, Sketch, etc.) thoroughly. Note spacing, typography, colors, and interaction patterns.
- [ ] **Component API is planned** — Before implementing, define the component's props, state, and public API. Consider how it composes with existing components.
- [ ] **Existing component library is checked** — Before building a new component, search the design system and component library. Reuse over recreation.
- [ ] **State management approach is decided** — Determine where state lives: local component state, context, Redux, Zustand, Jotai, or server state (React Query/SWR).
- [ ] **Route structure is confirmed** — New pages/views have defined routes. Nested layouts and route guards are planned.
- [ ] **Asset inventory is prepared** — Icons, images, fonts, and animations are provided by design. No placeholder assets in production.
- [ ] **Browser support requirements are known** — Check analytics for browser usage. Confirm minimum supported versions with the team.
- [ ] **API contract is finalized** — Backend endpoints, request/response shapes, and error formats are agreed upon before building the UI.
- [ ] **Feature flag is created** — New features should be behind a flag for gradual rollout and easy rollback.

### Common Mistakes
- Starting implementation before design is finalized
- Not checking for existing similar components
- Assuming API response shapes without confirming with backend

---

## Component Quality Checklist

- [ ] **Single responsibility** — Each component does one thing well. If a component handles too many concerns, split it.
- [ ] **Props are typed and documented** — TypeScript interfaces for all props. Required vs optional is explicit. Default values are sensible.
  ```typescript
  interface ButtonProps {
    variant: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
  }
  ```
- [ ] **Components are pure where possible** — Given the same props and state, the component renders the same output. Side effects are isolated to effects/hooks.
- [ ] **Conditional rendering is clean** — Use early returns for null/empty states. Avoid deep nesting of ternary operators.
- [ ] **Lists have stable keys** — Use unique, stable identifiers as keys. Never use array index as a key for dynamic lists.
- [ ] **Event handlers are memoized** — Inline function creation in render causes unnecessary re-renders. Use `useCallback` or define handlers outside render.
- [ ] **No prop drilling** — If a prop passes through 3+ levels, use context, composition, or a state management solution instead.
- [ ] **Component file structure is consistent** — Follow the team's convention: one component per file, co-locate styles, tests, and types.
- [ ] **Loading and error states are handled** — Every component that fetches data has loading, error, and empty states. Never show a blank screen.
- [ ] **Components are responsive by default** — Components should work at various container sizes, not just a fixed width.
- [ ] **Memoization is applied judiciously** — Use `React.memo`, `useMemo`, and `useCallback` only where profiling shows a measurable benefit. Don't premature-optimize.
- [ ] **No inline styles for dynamic values only** — Use CSS classes or CSS-in-JS for static styles. Inline styles are acceptable for truly dynamic values (position from drag).
- [ ] **Ref is forwarded when needed** — If a component wraps a native element, forward refs so parents can access the underlying DOM node.

### Common Mistakes
- Creating overly complex "god" components that do everything
- Using `any` type to bypass TypeScript
- Not considering re-renders when structuring state

---

## Accessibility Checklist

Accessibility is not optional — it's a legal requirement in many jurisdictions and the right thing to do.

- [ ] **Semantic HTML is used** — Use `<button>` not `<div onClick>`. Use `<nav>`, `<main>`, `<header>`, `<footer>`, `<article>`, `<section>` appropriately.
- [ ] **All images have alt text** — Decorative images use `alt=""`. Informative images have descriptive alt text. Complex images have long descriptions.
  ```html
  <!-- Decorative -->
  <img src="border.png" alt="" />

  <!-- Informative -->
  <img src="chart.png" alt="Q4 2024 revenue: $1.2M, up 15% from Q3" />

  <!-- Complex -->
  <img src="flowchart.png" alt="User registration flow" aria-describedby="flowchart-desc" />
  <p id="flowchart-desc">The flow starts with email input, followed by...</p>
  ```
- [ ] **Color contrast meets WCAG AA** — Text contrast ratio is at least 4.5:1 for normal text and 3:1 for large text. Use a contrast checker tool.
- [ ] **Keyboard navigation works** — All interactive elements are reachable via Tab. Focus order is logical. Focus is managed on route changes and modal opens/closes.
- [ ] **Focus indicators are visible** — Never use `outline: none` without a replacement. Custom focus styles must be clearly visible.
- [ ] **ARIA labels are used correctly** — Use `aria-label`, `aria-labelledby`, and `aria-describedby` to provide context where visual labels are insufficient.
- [ ] **Form inputs have labels** — Every input has an associated `<label>` (via `htmlFor`/`for` or wrapping). Error messages are linked via `aria-describedby`.
- [ ] **Error messages are announced** — Use `aria-live="polite"` or `aria-live="assertive"` for dynamic error messages. Use `role="alert"` for critical errors.
- [ ] **Motion can be reduced** — Respect `prefers-reduced-motion`. Provide static alternatives for animations. No content relies solely on animation to convey meaning.
- [ ] **Touch targets are large enough** — Interactive elements are at least 44x44px (WCAG 2.2). Adequate spacing between touch targets.
- [ ] **Tables are accessible** — Use `<th>` with `scope` for headers. Use `<caption>` for table descriptions. Complex tables use `aria-describedby`.
- [ ] **Skip navigation link exists** — Provide a "Skip to main content" link as the first focusable element for keyboard users.
- [ ] **Testing with screen reader** — Manually test with NVDA (Windows), VoiceOver (macOS), or TalkBack (Android). Automated tools catch only ~30% of issues.

### Common Mistakes
- Using `tabindex` values > 0 (disrupts natural tab order)
- Not testing with actual assistive technology
- Color as the only way to convey information
- Missing accessible names for icon-only buttons

---

## Performance Checklist

- [ ] **Bundle size is monitored** — Use bundle analyzer to identify large dependencies. Code-split at route level. Lazy-load heavy components.
  ```
  // Route-level code splitting
  const Dashboard = React.lazy(() => import('./pages/Dashboard'));
  const Settings = React.lazy(() => import('./pages/Settings'));
  ```
- [ ] **Images are optimized** — Use modern formats (WebP, AVIF). Implement responsive images with `srcset`. Lazy-load below-the-fold images. Set explicit width/height to prevent layout shift.
- [ ] **Critical CSS is inlined** — Above-the-fold CSS is inlined in `<head>`. Non-critical CSS is loaded asynchronously.
- [ ] **Fonts are optimized** — Use `font-display: swap` for web fonts. Subset fonts to include only needed characters. Preload critical fonts.
  ```css
  @font-face {
    font-family: 'MyFont';
    src: url('/fonts/myfont.woff2') format('woff2');
    font-display: swap;
  }
  ```
- [ ] **No layout shift (CLS)** — All dynamic content has reserved space. Images and embeds have explicit dimensions. Ads have fixed containers.
- [ ] **Third-party scripts are loaded efficiently** — Audit all third-party scripts (analytics, chat widgets, ads). Defer non-critical scripts. Use `async` or `defer` on script tags.
- [ ] **API responses are cached** — Use React Query, SWR, or equivalent with appropriate stale times. Implement optimistic updates where appropriate.
- [ ] **Web Vitals are measured** — Track LCP, FID/INP, CLS, and TTFB. Set performance budgets and alert on regressions.
- [ ] **Virtualization for long lists** — Use virtual scrolling (react-window, react-virtuoso) for lists with 100+ items. Don't render what's off-screen.
- [ ] **Service worker is configured** — For SPAs, implement a service worker for offline support and asset caching. Use Workbox for common patterns.
- [ ] **Compression is enabled** — Gzip or Brotli compression on the server/proxy for all text-based assets.

### Common Mistakes
- Importing an entire library for one function (e.g., `import _ from 'lodash'`)
- Not measuring real-user metrics (synthetic tests miss real-world conditions)
- Ignoring mobile performance — it's where most users are

---

## Responsive Design Checklist

- [ ] **Mobile-first approach** — Base styles target mobile. Media queries add complexity for larger screens. This produces simpler, more maintainable CSS.
  ```css
  /* Mobile first */
  .container { padding: 1rem; }

  /* Tablet */
  @media (min-width: 768px) {
    .container { padding: 2rem; }
  }

  /* Desktop */
  @media (min-width: 1024px) {
    .container { padding: 3rem; max-width: 1200px; margin: 0 auto; }
  }
  ```
- [ ] **Breakpoints are consistent** — Use the team's established breakpoints. Common: 320px, 375px, 640px, 768px, 1024px, 1280px, 1536px.
- [ ] **Typography is fluid** — Use `clamp()` for font sizes that scale smoothly between breakpoints. Avoid abrupt size jumps.
- [ ] **Touch-friendly on mobile** — Buttons, links, and interactive elements are easy to tap. No hover-dependent interactions on touch devices.
- [ ] **Navigation adapts to screen size** — Hamburger menu or bottom nav on mobile. Full navigation on desktop. Active state is clear.
- [ ] **Tables are responsive** — On small screens, tables either scroll horizontally, stack vertically, or transform into cards. No content is hidden without an alternative.
- [ ] **Images scale properly** — Use `max-width: 100%` and `height: auto` for responsive images. Consider art direction with `<picture>` elements.
- [ ] **Tested on real devices** — Don't rely solely on browser dev tools resize. Test on actual phones and tablets for touch interactions and layout.
- [ ] **Print styles are considered** — If users might print pages, provide `@media print` styles. Hide navigation, adjust margins, ensure content is readable.
- [ ] **Orientation changes are handled** — Layout doesn't break when a tablet is rotated from portrait to landscape.

### Common Mistakes
- Designing desktop-first and then trying to shrink to mobile
- Using fixed pixel widths for container elements
- Not testing landscape orientation on mobile devices

---

## Dark Mode Checklist

- [ ] **Design tokens are used** — All colors reference design tokens (CSS custom properties, theme variables). Never hardcode hex values in component styles.
  ```css
  :root {
    --color-bg-primary: #ffffff;
    --color-text-primary: #1a1a1a;
    --color-border: #e0e0e0;
  }

  [data-theme="dark"] {
    --color-bg-primary: #1a1a1a;
    --color-text-primary: #f0f0f0;
    --color-border: #333333;
  }
  ```
- [ ] **Color contrast is verified in both themes** — Text must meet WCAG AA contrast ratios in both light and dark modes. Dark mode doesn't mean low contrast.
- [ ] **Images adapt to dark mode** — Logo has a dark mode variant. Screenshots and illustrations don't have harsh white backgrounds in dark mode. Use `prefers-color-scheme` or theme-aware components.
- [ ] **System preference is respected** — Default to the user's OS color scheme preference. Allow manual override. Persist the user's choice.
- [ ] **Transitions are smooth** — Theme switch has a brief transition (`transition: background-color 0.2s, color 0.2s`) to avoid jarring flashes.
- [ ] **Shadows and elevation are adjusted** — Lighter shadows or subtle borders replace shadows in dark mode. Elevation is conveyed differently.
- [ ] **Third-party components are themed** — Check that all third-party UI libraries support dark mode. Override their styles if needed.
- [ ] **Scrollbar and form elements are styled** — Default browser chrome (scrollbars, input borders, select dropdowns) looks good in dark mode.
- [ ] **No flash of wrong theme (FOWT)** — Theme is applied before first paint. Use a script in `<head>` to set the theme class or attribute immediately.

### Common Mistakes
- Using opacity or `filter: invert()` as a lazy dark mode solution
- Not testing all pages in dark mode — some may have hardcoded colors
- Forgetting about images with transparent backgrounds

---

## Testing Checklist

- [ ] **Unit tests for utility functions** — Pure functions, helpers, formatters, and validators have unit tests. These are fast and deterministic.
- [ ] **Component tests exist** — Test component rendering with different props, user interactions, and state changes. Use React Testing Library or equivalent.
- [ ] **User interactions are tested** — Test clicking buttons, filling forms, submitting data, navigating, and keyboard interactions. Test from the user's perspective, not implementation.
  ```javascript
  // Good: Test user behavior
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  expect(screen.getByText('Welcome back!')).toBeInTheDocument();
  ```
- [ ] **Error states are tested** — Verify error messages display correctly, retry mechanisms work, and error boundaries catch rendering errors.
- [ ] **Loading states are tested** — Verify loading indicators appear during async operations and disappear when data arrives.
- [ ] **E2E tests for critical flows** — User registration, login, checkout, and other revenue-critical flows have E2E tests (Cypress, Playwright).
- [ ] **Visual regression tests** — Use tools like Chromatic, Percy, or Playwright snapshots to catch unintended visual changes.
- [ ] **Accessibility tests are automated** — Use axe-core or jest-axe to catch common accessibility issues. Supplement with manual testing.
- [ ] **Tests are isolated** — Each test starts from a clean state. No shared global state between tests. Mock APIs and browser APIs consistently.
- [ ] **Mock data is realistic** — Test fixtures reflect real-world data shapes. Include edge cases: empty data, very long text, special characters, null fields.

### Common Mistakes
- Testing implementation details (internal state, private methods) instead of behavior
- Not testing error scenarios — they happen more often than you think
- Writing tests that are too tightly coupled to component structure

---

## Documentation Checklist

- [ ] **Component stories exist** — Document every component variant in Storybook or equivalent. Include usage examples, prop descriptions, and do/don't guidelines.
- [ ] **README is up to date** — Setup instructions, required environment variables, available scripts, and architecture overview are current.
- [ ] **Contribution guide exists** — How to add a new component, how to run tests, coding standards, and PR process are documented.
- [ ] **Design tokens are documented** — All color, spacing, typography, and shadow tokens are listed with their purposes and usage guidelines.
- [ ] **API integration notes** — Document how the frontend communicates with backend APIs, including authentication flow, error handling patterns, and data transformation.
- [ ] **Accessibility guidelines are shared** — Team-level accessibility practices, testing procedures, and common pitfalls are documented.
- [ ] **Performance budget is documented** — Maximum bundle size, largest contentful paint target, and other performance thresholds are written down and tracked.
- [ ] **Deployment process is documented** — How to deploy, what environment variables are needed, and how to verify a deployment.
- [ ] **Changelog is maintained** — User-facing changes are documented. Breaking changes are highlighted with migration instructions.

---

## Cross-References

- See `security.md` for frontend-specific security considerations (XSS, CSRF, etc.)
- See `testing.md` for detailed testing procedures and best practices
- See `api.md` for API contract and integration guidelines
- See `deployment.md` for build and deployment procedures
- See `release.md` for release management processes
