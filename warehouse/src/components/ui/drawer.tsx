import * as React from 'react';
import { createPortal } from 'react-dom';
import { classNames } from '../../utils/helpers';

type DrawerContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  dragOffset: number;
  setDragOffset: React.Dispatch<React.SetStateAction<number>>;
};

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

const useDrawer = () => {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error('Drawer components must be used within a <Drawer>');
  }
  return context;
};

type DrawerProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  shouldScaleBackground?: boolean;
  handleOnly?: boolean;
  autoFocus?: boolean;
  modal?: boolean;
};

const Drawer = ({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
  autoFocus = false,
}: DrawerProps) => {
  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const actualOpen = isControlled ? !!open : uncontrolledOpen;
  const [mounted, setMounted] = React.useState(actualOpen);
  const [dragOffset, setDragOffset] = React.useState(0);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  React.useEffect(() => {
    if (actualOpen) {
      setMounted(true);
      setDragOffset(0);
      return;
    }

    setDragOffset(0);
    const timer = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timer);
  }, [actualOpen]);

  React.useEffect(() => {
    if (!actualOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [actualOpen, setOpen]);

  React.useEffect(() => {
    if (!autoFocus || !actualOpen) return;
    const content = document.querySelector<HTMLElement>('[data-drawer-content]');
    content?.focus({ preventScroll: true });
  }, [autoFocus, actualOpen]);

  const contextValue = React.useMemo(
    () => ({ open: actualOpen, setOpen, dragOffset, setDragOffset }),
    [actualOpen, setOpen, dragOffset]
  );

  return (
    <DrawerContext.Provider value={contextValue}>
      {mounted ? children : null}
    </DrawerContext.Provider>
  );
};
Drawer.displayName = 'Drawer';

const DrawerTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const { setOpen } = useDrawer();
  return (
    <button
      ref={ref}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(true);
      }}
      {...props}
    />
  );
});
DrawerTrigger.displayName = 'DrawerTrigger';

const DrawerClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const { setOpen } = useDrawer();
  return (
    <button
      ref={ref}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      {...props}
    />
  );
});
DrawerClose.displayName = 'DrawerClose';

const DrawerPortal = ({ children }: { children?: React.ReactNode }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};
DrawerPortal.displayName = 'DrawerPortal';

const DrawerOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, onClick, ...props }, ref) => {
  const { open, setOpen } = useDrawer();
  return (
    <div
      ref={ref}
      className={classNames(
        'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
        open ? 'opacity-100' : 'opacity-0',
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      {...props}
    />
  );
});
DrawerOverlay.displayName = 'DrawerOverlay';

const DrawerContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, style, ...props }, ref) => {
  const { open, dragOffset } = useDrawer();
  const dragging = dragOffset > 0;

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <div
        ref={ref}
        data-drawer-content
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={classNames(
          'fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-lg flex-col rounded-t-2xl border-t border-th-border bg-th-surface shadow-2xl outline-none',
          className
        )}
        style={{
          transform: open ? `translateY(${dragOffset}px)` : 'translateY(100%)',
          opacity: open ? 1 : 0,
          transition: dragging ? 'none' : 'transform 220ms ease, opacity 220ms ease',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    </DrawerPortal>
  );
});
DrawerContent.displayName = 'DrawerContent';

const DrawerHandle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, onPointerDown, onPointerMove, onPointerUp, ...props }, ref) => {
  const { setDragOffset } = useDrawer();
  const startY = React.useRef<number | null>(null);
  const offset = React.useRef(0);
  const { setOpen } = useDrawer();

  const finishDrag = () => {
    startY.current = null;
    const shouldClose = offset.current > 120;
    offset.current = 0;
    setDragOffset(0);
    if (shouldClose) setOpen(false);
  };

  return (
    <div
      ref={ref}
      className={classNames('mx-auto mt-2.5 mb-1 shrink-0 cursor-grab active:cursor-grabbing', className)}
      style={{
        height: 6,
        width: 40,
        borderRadius: 9999,
        backgroundColor: 'var(--text-muted)',
        opacity: 0.4,
        touchAction: 'none',
        ...style,
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented) return;
        startY.current = event.clientY;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (startY.current === null) return;
        offset.current = Math.max(0, event.clientY - startY.current);
        setDragOffset(offset.current);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        if (startY.current === null) return;
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        finishDrag();
      }}
      onPointerCancel={finishDrag}
      {...props}
    />
  );
});
DrawerHandle.displayName = 'DrawerHandle';

const DrawerTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={classNames('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DrawerTitle.displayName = 'DrawerTitle';

const DrawerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={classNames('text-sm text-th-muted', className)} {...props} />
));
DrawerDescription.displayName = 'DrawerDescription';

export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerClose,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
  DrawerDescription,
};
