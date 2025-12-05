import type { ReactNode } from "react";
import Logo from "./shared/logo";
import UserMenu from "./shared/user-menu";

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayout({ children }: AppLayoutProps) {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "260px",
          backgroundColor: "white",
          borderRight: "1px solid rgba(0, 0, 0, 0.1)",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <Logo />
        <div style={{ flex: 1 }} /> {/* Spacer */}
        <UserMenu />
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          backgroundColor: "#f6f7f7",
          overflow: "auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default AppLayout;
