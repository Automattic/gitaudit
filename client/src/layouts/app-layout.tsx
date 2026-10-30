import type { ReactNode } from "react";
import SiteHeader, { SITE_HEADER_HEIGHT } from "../components/site-header";

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayout({ children }: AppLayoutProps) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f6f7f7", paddingTop: SITE_HEADER_HEIGHT }}>
      <SiteHeader />
      <main>{children}</main>
    </div>
  );
}

export default AppLayout;
