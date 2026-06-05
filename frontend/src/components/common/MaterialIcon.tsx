import clsx from "clsx";

type MaterialIconProps = {
  name: string;
  size?: number;
  filled?: boolean;
  weight?: number;
  className?: string;
};

export const MaterialIcon = ({
  name,
  size = 20,
  filled = false,
  weight = 500,
  className
}: MaterialIconProps) => (
  <span
    aria-hidden="true"
    className={clsx("material-symbols-rounded select-none leading-none", className)}
    style={{
      fontSize: `${size}px`,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`
    }}
  >
    {name}
  </span>
);
