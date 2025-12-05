import { useParams, Outlet, NavLink } from "react-router-dom";
import { Button, __experimentalHStack as HStack } from "@wordpress/components";
import { update as updateIcon } from "@wordpress/icons";
import { useQuery } from "@tanstack/react-query";
import { repoStatusQueryOptions } from "@/data/queries/repos";
import { useRefreshIssuesMutation } from "@/data/queries/issues";
import { Badge } from "../utils/lock-unlock";
import Logo from "./shared/Logo";
import UserMenu from "./shared/UserMenu";

function RepositoryLayout() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  // Use TanStack Query for repo status with automatic polling
  const { data: statusData } = useQuery(repoStatusQueryOptions(owner!, repo!));
  const refreshMutation = useRefreshIssuesMutation(owner!, repo!);

  const status = statusData?.status;
  const currentJob = statusData?.currentJob;

  const handleRefresh = async () => {
    await refreshMutation.mutateAsync();
  };

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

              {/* Status badges */}
              {status === "in_progress" && currentJob === "issue-fetch" && (
                <Badge>Fetching issues...</Badge>
              )}
              {status === "in_progress" && currentJob === "sentiment" && (
                <Badge>Analyzing sentiment...</Badge>
              )}
              {status === "in_progress" && !currentJob && (
                <Badge>Pending...</Badge>
              )}
              {status === "failed" && (
                <Badge>Failed</Badge>
              )}
            </div>

            {/* Refresh button */}
            {(status === "completed" || status === "not_started" || status === "failed" || !status) && (
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                <Button
                  icon={updateIcon}
                  onClick={handleRefresh}
                  label="Refresh data"
                  size="small"
                  variant="secondary"
                  isBusy={refreshMutation.isPending}
                />
              </div>
            )}
          </HStack>
        </div>

        {/* Navigation Menu */}
        <nav style={{ paddingTop: "2rem", flex: 1 }}>
          <NavLink
            to={`/repos/${owner}/${repo}/bugs`}
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
            Important Bugs
          </NavLink>
          <NavLink
            to={`/repos/${owner}/${repo}/stale`}
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
            Stale Issues
          </NavLink>
          <NavLink
            to={`/repos/${owner}/${repo}/community`}
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
            Community Health
          </NavLink>
          <NavLink
            to={`/repos/${owner}/${repo}/settings`}
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
            Settings
          </NavLink>
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
