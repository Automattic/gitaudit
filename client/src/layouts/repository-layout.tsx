import { useParams, Outlet } from "react-router-dom";
import { __experimentalHStack as HStack } from "@wordpress/components";
import Logo from "./shared/logo";
import UserMenu from "./shared/user-menu";
import RefreshButton from "./shared/refresh-button";
import SidebarNavLink from "./shared/sidebar-nav-link";

function RepositoryLayout() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

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
        {/* Logo */}
        <Logo />

        {/* Active Repo Section */}
        <div
          style={{
            padding: "0.5rem 1.5rem",
          }}
        >
          <HStack justify="space-between" alignment="center" spacing={2}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 600,
                  color: "#1e1e1e",
                  fontSize: "0.9rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={`${owner}/${repo}`}
              >
                {owner}/{repo}
              </div>
            </div>

            <RefreshButton owner={owner!} repo={repo!} />
          </HStack>
        </div>

        {/* Navigation Menu */}
        <nav style={{ paddingTop: "2rem", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <SidebarNavLink to={`/repos/${owner}/${repo}/bugs`}>
              Important Bugs
            </SidebarNavLink>
            <SidebarNavLink to={`/repos/${owner}/${repo}/stale`}>
              Stale Issues
            </SidebarNavLink>
            <SidebarNavLink to={`/repos/${owner}/${repo}/features`}>
              Feature Requests
            </SidebarNavLink>
            <SidebarNavLink to={`/repos/${owner}/${repo}/community`}>
              Community Health
            </SidebarNavLink>
          </div>
          <div>
            <SidebarNavLink to={`/repos/${owner}/${repo}/settings`}>
              Settings
            </SidebarNavLink>
          </div>
        </nav>

        {/* User Menu */}
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
        <Outlet />
      </main>
    </div>
  );
}

export default RepositoryLayout;
