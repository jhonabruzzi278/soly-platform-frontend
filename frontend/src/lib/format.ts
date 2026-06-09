export const currency = (value: number) => {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(safe);
};

export const percentage = (value: number) => `${(typeof value === 'number' && !Number.isNaN(value) ? value : 0).toFixed(1)}%`;

export const shortDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium"
  }).format(date);
};
