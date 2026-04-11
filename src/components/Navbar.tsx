import { Link, useLocation } from "@tanstack/react-router";
import logo from "@/assets/logo.png";

export function Navbar() {
  const location = useLocation();

  const navLinks = [
    { to: "/" as const, label: "Dashboard" },
    { to: "/events" as const, label: "Events" },
    { to: "/admin" as const, label: "Admin" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="NextChain Radar" width={36} height={36} className="rounded-lg" />
          <span className="font-heading text-lg font-bold text-foreground">
            Next<span className="text-primary">Chain</span> Radar
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to ||
              (link.to !== "/" && location.pathname.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
