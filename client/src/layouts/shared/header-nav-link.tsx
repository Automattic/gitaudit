import { NavLink } from "react-router-dom";

interface HeaderNavLinkProps {
  to: string;
  children: React.ReactNode;
}

function HeaderNavLink({ to, children }: HeaderNavLinkProps) {
  return (
    <NavLink
      to={to}
      style={({ isActive }: { isActive: boolean }) => ({
        color: isActive ? "var(--wp-admin-theme-color)" : "#50575e",
        textDecoration: "none",
        fontSize: "0.875rem",
        fontWeight: isActive ? 600 : 400,
      })}
    >
      {children}
    </NavLink>
  );
}

export default HeaderNavLink;
