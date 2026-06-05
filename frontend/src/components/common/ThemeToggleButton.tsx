import { useTheme } from "../../app/ThemeProvider";
import { MaterialIcon } from "./MaterialIcon";
import { Button } from "../ui/button";

export const ThemeToggleButton = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      type="button"
      onClick={toggleTheme}
      variant="outline"
      size="sm"
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
    >
      <MaterialIcon name={theme === "dark" ? "light_mode" : "dark_mode"} size={18} filled />
      {theme === "dark" ? "Claro" : "Oscuro"}
    </Button>
  );
};
