export const currency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value ?? 0);

export const percentage = (value: number) => `${(value ?? 0).toFixed(1)}%`;

export const shortDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium"
  }).format(date);
};
