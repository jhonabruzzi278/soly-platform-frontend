import * as React from "react";
import { cn } from "../../lib/cn";
import { MaterialIcon } from "../common/MaterialIcon";
import { Button } from "./button";

type SidebarContextValue = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (value: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (value: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const SidebarContext = React.createContext<SidebarContextValue | null>(null);

const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
};

export const useSidebar = () => {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used inside SidebarProvider");
  }
  return context;
};

type SidebarProviderProps = React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const SidebarProvider = ({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  children,
  ...props
}: SidebarProviderProps) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = openProp ?? internalOpen;

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        setInternalOpen(value);
      }
    },
    [onOpenChange]
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((current) => !current);
      return;
    }
    setOpen(!open);
  }, [isMobile, open, setOpen]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.key || event.key.toLowerCase() !== SIDEBAR_KEYBOARD_SHORTCUT) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const state: "expanded" | "collapsed" = open ? "expanded" : "collapsed";

  return (
    <SidebarContext.Provider
      value={{
        state,
        open,
        setOpen,
        openMobile,
        setOpenMobile,
        isMobile,
        toggleSidebar
      }}
    >
      <div
        data-sidebar-state={state}
        className={cn("group/sidebar-wrapper min-h-screen w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
};

type SidebarProps = React.ComponentProps<"aside"> & {
  side?: "left" | "right";
};

export const Sidebar = ({ className, side = "left", children, ...props }: SidebarProps) => {
  const { open, openMobile, setOpenMobile } = useSidebar();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/55 transition-opacity lg:hidden",
          openMobile ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpenMobile(false)}
      />

      <aside
        data-side={side}
        data-state={open ? "expanded" : "collapsed"}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-transparent bg-[var(--sidebar)] shadow-[var(--neu-shadow-raised)] transition-transform duration-200 lg:z-30",
          openMobile ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          open ? "lg:w-[17rem]" : "lg:w-[5.2rem]",
          className
        )}
        {...props}
      >
        {children}
      </aside>
    </>
  );
};

export const SidebarHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("border-b border-transparent p-3", className)} {...props} />
);

export const SidebarContent = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("flex-1 overflow-y-auto p-2", className)} {...props} />
);

export const SidebarFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("border-t border-transparent p-2", className)} {...props} />
);

export const SidebarGroup = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("mb-4", className)} {...props} />
);

export const SidebarGroupLabel = ({ className, ...props }: React.ComponentProps<"p">) => (
  <p
    className={cn(
      "px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)]",
      className
    )}
    {...props}
  />
);

export const SidebarGroupContent = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("space-y-1", className)} {...props} />
);

export const SidebarMenu = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("space-y-1", className)} {...props} />
);

export const SidebarMenuItem = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("w-full", className)} {...props} />
);

type SidebarMenuButtonProps = React.ComponentProps<typeof Button> & {
  isActive?: boolean;
};

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(function SidebarMenuButton(
  { className, isActive = false, children, ...props },
  ref
) {
  return (
    <Button
      ref={ref}
      variant={isActive ? "default" : "ghost"}
      size="md"
      className={cn(
        "h-10 w-full justify-start gap-2.5 rounded-lg px-2.5 text-sm",
        !isActive && "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
});

export const SidebarInset = ({ className, ...props }: React.ComponentProps<"div">) => {
  const { open } = useSidebar();
  return <div className={cn("min-h-screen transition-[padding] duration-200", open ? "lg:pl-[17rem]" : "lg:pl-[5.2rem]", className)} {...props} />;
};

type SidebarTriggerProps = React.ComponentProps<typeof Button> & {
  showLabel?: boolean;
};

export const SidebarTrigger = ({ className, showLabel = false, ...props }: SidebarTriggerProps) => {
  const { toggleSidebar, isMobile, open, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;
  const actionLabel = expanded ? "Cerrar menú" : "Abrir menú";
  const iconName = expanded ? "keyboard_double_arrow_left" : "menu";

  return (
    <Button
      variant="outline"
      size={showLabel ? "md" : "icon"}
      className={cn("shrink-0", className)}
      onClick={toggleSidebar}
      aria-label={actionLabel}
      title={actionLabel}
      {...props}
    >
      <MaterialIcon name={iconName} size={18} />
      {showLabel ? <span className="hidden sm:inline">{actionLabel}</span> : null}
    </Button>
  );
};
