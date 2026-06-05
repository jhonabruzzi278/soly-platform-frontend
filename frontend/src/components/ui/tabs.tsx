import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  createContext,
  useContext,
  useMemo,
  useState
} from "react";
import { cn } from "../../lib/cn";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = () => {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("Tabs components must be used inside <Tabs>.");
  }

  return context;
};

type TabsProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
};

export const Tabs = ({ value, defaultValue, onValueChange, className, children }: TabsProps) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const activeValue = value ?? uncontrolledValue;

  const contextValue = useMemo<TabsContextValue>(
    () => ({
      value: activeValue,
      setValue: (nextValue) => {
        if (value === undefined) {
          setUncontrolledValue(nextValue);
        }
        onValueChange?.(nextValue);
      }
    }),
    [activeValue, onValueChange, value]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    role="tablist"
      className={cn(
        "flex gap-2 overflow-x-auto rounded-2xl border border-transparent bg-[var(--card)] p-1.5 shadow-[var(--neu-shadow-pressed)]",
        className
      )}
    {...props}
  />
);

type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export const TabsTrigger = ({ value, className, children, ...props }: TabsTriggerProps) => {
  const tabs = useTabsContext();
  const isActive = tabs.value === value;

  return (
    <button
      id={`tab-${value}`}
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={`panel-${value}`}
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "inline-flex min-w-max items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "data-[state=active]:bg-[var(--card)] data-[state=active]:text-[var(--foreground)] data-[state=active]:shadow-[var(--neu-shadow-pressed)]",
        className
      )}
      onClick={() => tabs.setValue(value)}
      {...props}
    >
      {children}
    </button>
  );
};

type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
  forceMount?: boolean;
};

export const TabsContent = ({ value, forceMount = false, className, children, ...props }: TabsContentProps) => {
  const tabs = useTabsContext();
  const isActive = tabs.value === value;

  if (!forceMount && !isActive) {
    return null;
  }

  return (
    <div
      id={`panel-${value}`}
      role="tabpanel"
      aria-labelledby={`tab-${value}`}
      hidden={!isActive}
      className={cn("space-y-4", className)}
      {...props}
    >
      {children}
    </div>
  );
};
