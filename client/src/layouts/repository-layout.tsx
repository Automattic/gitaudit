import { useParams, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { repoPermissionQueryOptions } from "../data/queries/repos";
import SiteHeader, { SITE_HEADER_HEIGHT } from "../components/site-header";
import HeaderNavLink from "./shared/header-nav-link";

function RepositoryLayout() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  // Check if user has admin permission
  const { data: permissionData } = useQuery(
    repoPermissionQueryOptions(owner!, repo!)
  );

  const isAdmin = permissionData?.isAdmin ?? false;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f6f7f7", paddingTop: SITE_HEADER_HEIGHT }}>
      <SiteHeader />

      {/* Sub-header with the repo and its pages */}
      <div
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid #e0e0e0",
          padding: "0.75rem 2rem",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem 1.5rem",
          }}
        >
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#1e1e1e",
              minWidth: 0,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={`${owner}/${repo}`}
          >
            {owner}/{repo}
          </span>

          <nav style={{ display: "flex", gap: "1rem" }}>
            <HeaderNavLink to={`/repos/${owner}/${repo}/metrics`}>Metrics</HeaderNavLink>
            {isAdmin && (
              <HeaderNavLink to={`/repos/${owner}/${repo}/settings`}>Settings</HeaderNavLink>
            )}
          </nav>
        </div>
      </div>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default RepositoryLayout;
