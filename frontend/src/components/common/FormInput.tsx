import { Input } from "../ui/input";

type FormInputProps = {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
};

export const FormInput = ({ label, value, onChange, placeholder, hint, required, type = "text" }: FormInputProps) => (
  <label className="flex flex-col gap-1.5 text-sm text-[var(--foreground)]">
    <span className="font-medium">{label}</span>
    <Input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
    />
    {hint ? <span className="text-xs text-[var(--muted-foreground)]">{hint}</span> : null}
  </label>
);
