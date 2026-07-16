# 35 - Accessibility

## Purpose

This document defines accessibility standards for the KMJ Optical ERP frontend, including ARIA labels, keyboard navigation, color contrast, screen readers, and focus management. Accessibility is not optional—it's a legal and ethical requirement.

## Core Principles

1. **WCAG 2.1 AA compliance**: All components must meet WCAG 2.1 AA standards.
2. **Keyboard accessible**: All functionality must be accessible via keyboard.
3. **Screen reader friendly**: All content must be accessible to screen readers.
4. **Visual clarity**: All text must meet color contrast requirements.
5. **Focus management**: All interactive elements must have visible focus indicators.

## Detailed Rules

### ARIA Labels

#### Required ARIA Attributes

```tsx
// GOOD: Proper ARIA labels
<button aria-label="Close dialog">
  <XIcon />
</button>

<nav aria-label="Main navigation">
  <ul>
    <li><a href="/dashboard">Dashboard</a></li>
    <li><a href="/customers">Customers</a></li>
  </ul>
</nav>

<div role="alert" aria-live="polite">
  {error && <p className="text-red-600">{error}</p>}
</div>

// BAD: Missing ARIA labels
<button>
  <XIcon />
</button>

<nav>
  <ul>
    <li><a href="/dashboard">Dashboard</a></li>
  </ul>
</nav>
```

#### ARIA Patterns

```tsx
// Modal dialog
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Delete</h2>
  <p id="dialog-description">Are you sure you want to delete this customer?</p>
  <button onClick={onConfirm}>Delete</button>
  <button onClick={onCancel}>Cancel</button>
</div>

// Dropdown menu
<div role="menu" aria-label="Actions">
  <button role="menuitem" onClick={onEdit}>Edit</button>
  <button role="menuitem" onClick={onDelete}>Delete</button>
</div>

// Tab panel
<div role="tablist" aria-label="Customer sections">
  <button role="tab" aria-selected={activeTab === 'info'}>Info</button>
  <button role="tab" aria-selected={activeTab === 'orders'}>Orders</button>
</div>
<div role="tabpanel" aria-labelledby="tab-info">
  {activeTab === 'info' && <CustomerInfo />}
</div>
```

### Keyboard Navigation

#### Tab Order

```tsx
// GOOD: Logical tab order
<form>
  <input tabIndex={0} placeholder="Name" />
  <input tabIndex={1} placeholder="Mobile" />
  <select tabIndex={2}>
    <option>Gender</option>
  </select>
  <button tabIndex={3} type="submit">Submit</button>
</form>

// BAD: Broken tab order
<form>
  <input tabIndex={2} placeholder="Name" />
  <input tabIndex={0} placeholder="Mobile" />
  <button tabIndex={1} type="submit">Submit</button>
</form>
```

#### Keyboard Shortcuts

```tsx
// GOOD: Keyboard shortcuts for common actions
function CustomerList() {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+N: New customer
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      openNewCustomerDialog();
    }
    // Ctrl+F: Focus search
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    // Escape: Close dialog
    if (e.key === 'Escape') {
      closeDialog();
    }
  };

  return (
    <div onKeyDown={handleKeyDown}>
      {/* Content */}
    </div>
  );
}
```

#### Skip Navigation

```tsx
// GOOD: Skip navigation link
function Layout({ children }) {
  return (
    <div>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:border"
      >
        Skip to main content
      </a>
      <header>
        <nav aria-label="Main navigation">
          {/* Navigation */}
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
```

### Color Contrast

#### Contrast Requirements

- **Normal text**: 4.5:1 contrast ratio
- **Large text** (18px+ or 14px+ bold): 3:1 contrast ratio
- **UI components**: 3:1 contrast ratio

#### Contrast Examples

```tsx
// GOOD: Sufficient contrast
// Text on white background
<p className="text-gray-900 bg-white">High contrast text</p>

// Text on primary background
<button className="bg-blue-600 text-white">High contrast button</button>

// BAD: Insufficient contrast
// Light text on light background
<p className="text-gray-400 bg-gray-100">Low contrast text</p>

// Dark text on dark background
<p className="text-gray-600 bg-gray-800">Low contrast text</p>
```

#### Color as Information

```tsx
// BAD: Color is the only indicator
<div className="bg-red-100">Error</div>
<div className="bg-green-100">Success</div>

// GOOD: Color + icon + text
<div className="bg-red-100 flex items-center">
  <AlertIcon className="text-red-600" />
  <span className="text-red-800">Error: Invalid input</span>
</div>
<div className="bg-green-100 flex items-center">
  <CheckIcon className="text-green-600" />
  <span className="text-green-800">Success: Saved</span>
</div>
```

### Screen Readers

#### Semantic HTML

```tsx
// GOOD: Semantic HTML
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/dashboard">Dashboard</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Customer Details</h1>
    <section aria-labelledby="info-heading">
      <h2 id="info-heading">Information</h2>
      {/* Content */}
    </section>
  </article>
</main>

<footer>
  <p>&copy; KMJ Optical</p>
</footer>

// BAD: Non-semantic HTML
<div class="header">
  <div class="nav">
    <div class="nav-item">Dashboard</div>
  </div>
</div>
<div class="main">
  <div class="content">
    <div class="title">Customer Details</div>
  </div>
</div>
```

#### Alt Text

```tsx
// GOOD: Descriptive alt text
<img
  src="/logo.png"
  alt="KMJ Optical logo"
/>

// BAD: Missing or generic alt text
<img src="/logo.png" />
<img src="/logo.png" alt="image" />
<img src="/logo.png" alt="" />
```

#### Live Regions

```tsx
// GOOD: Live regions for dynamic content
function Notification({ message, type }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'p-4 rounded-md',
        type === 'success' && 'bg-green-100 text-green-800',
        type === 'error' && 'bg-red-100 text-red-800'
      )}
    >
      {message}
    </div>
  );
}

// BAD: Dynamic content without live region
function Notification({ message, type }) {
  return (
    <div className={cn(
      'p-4 rounded-md',
      type === 'success' && 'bg-green-100 text-green-800'
    )}>
      {message}
    </div>
  );
}
```

### Focus Management

#### Focus Indicators

```tsx
// GOOD: Visible focus indicators
<button className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
  Click me
</button>

<input className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />

// BAD: No focus indicators
<button className="focus:outline-none">
  Click me
</button>

<input className="focus:outline-none" />
```

#### Focus Trapping

```tsx
// GOOD: Focus trap in modal
function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus first focusable element
      const firstFocusable = modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable as HTMLElement)?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }

    // Trap focus within modal
    if (e.key === 'Tab') {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements?.[0];
      const lastElement = focusableElements?.[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        (lastElement as HTMLElement)?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        (firstElement as HTMLElement)?.focus();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
```

#### Focus Restoration

```tsx
// GOOD: Focus restoration after modal closes
function CustomerList() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    // Restore focus to trigger element
    triggerRef.current?.focus();
  };

  return (
    <div>
      <button ref={triggerRef} onClick={openModal}>
        Add Customer
      </button>
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {/* Modal content */}
      </Modal>
    </div>
  );
}
```

## Bad Examples

```tsx
// BAD: Click handler on non-interactive element
<div onClick={handleClick}>Click me</div>

// BAD: No keyboard support
<div onMouseEnter={handleHover}>Hover me</div>

// BAD: Missing alt text
<img src="/customer-photo.jpg" />

// BAD: Low contrast text
<p className="text-gray-400 bg-white">Hard to read text</p>

// BAD: No focus indicator
<button className="focus:outline-none">No focus ring</button>
```

## Good Examples

```tsx
// GOOD: Accessible button
<button
  onClick={handleClick}
  aria-label="Delete customer"
  className="focus:outline-none focus:ring-2 focus:ring-red-500"
>
  <TrashIcon />
</button>

// GOOD: Accessible form
<form onSubmit={handleSubmit}>
  <label htmlFor="name">Name</label>
  <input
    id="name"
    type="text"
    required
    aria-required="true"
    aria-describedby="name-help"
    className="focus:ring-2 focus:ring-blue-500"
  />
  <p id="name-help" className="text-sm text-gray-500">
    Enter customer full name
  </p>
</form>

// GOOD: Accessible table
<table>
  <caption>Customer List</caption>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Mobile</th>
    </tr>
  </thead>
  <tbody>
    {customers.map(customer => (
      <tr key={customer._id}>
        <td>{customer.name}</td>
        <td>{customer.mobile}</td>
      </tr>
    ))}
  </tbody>
</table>
```

## Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| ARIA labels | Screen reader support | More markup |
| Keyboard navigation | Full keyboard access | More complex event handling |
| Color contrast | Visual clarity | Design constraints |
| Focus management | Clear navigation | More state management |
| Semantic HTML | Better accessibility | Learning curve |

## Cross-References

- **UI design system**: See `docs/34-ui-design-system.md`
- **React patterns**: See `docs/09-react.md`
- **Frontend standards**: See `docs/08-frontend.md`
- **Performance**: See `docs/21-performance.md`
- **Coding standards**: See `docs/05-coding-standards.md`

## AI Instructions

When creating UI components:
1. Always add ARIA labels to interactive elements
2. Always ensure keyboard navigation works
3. Always meet color contrast requirements
4. Always use semantic HTML
5. Always manage focus properly
6. Never use color as the only indicator
7. Never remove focus indicators
8. Always test with screen readers
9. Always provide alt text for images
10. Always use live regions for dynamic content
