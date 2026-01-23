import { NavLink } from "react-router-dom";

interface SidebarNavLinkProps {
  to: string;
  children: React.ReactNode;
  end?: boolean;
}

function SidebarNavLink({ to, children, end }: SidebarNavLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }: { isActive: boolean }) => ({
        display: "block",
        padding: "0.5rem 1.5rem",
        color: isActive ? "var(--wp-admin-theme-color)" : "#50575e",
        backgroundColor: "transparent",
        textDecoration: "none",
        fontSize: "0.875rem",
        fontWeight: isActive ? 600 : 400,
        borderLeft: isActive
          ? "3px solid var(--wp-admin-theme-color)"
          : "3px solid transparent",
      })}
    >
      {children}
    </NavLink>
  );
}

export default SidebarNavLink;
