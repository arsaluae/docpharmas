import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

// Re-export for backwards compatibility with existing imports.
export { useTheme };

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-all w-full"
      title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {!collapsed && <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>}
    </button>
  );
}
