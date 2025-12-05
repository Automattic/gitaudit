import { useParams, useNavigate, Outlet, NavLink } from "react-router-dom";
import { Button } from "@wordpress/components";
import { update as updateIcon } from "@wordpress/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { repoStatusQueryOptions } from "@/data/queries/repos";
import { useRefreshIssuesMutation } from "@/data/queries/issues";
import { Badge } from "../utils/lock-unlock";

function RepositoryLayout() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Use TanStack Query for repo status with automatic polling
  const { data: statusData } = useQuery(repoStatusQueryOptions(owner!, repo!));
  const refreshMutation = useRefreshIssuesMutation(owner!, repo!);

  const status = statusData?.status;
  const currentJob = statusData?.currentJob;

  const handleRefresh = async () => {
    await refreshMutation.mutateAsync();
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f0f0" }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: "white",
          borderBottom: "1px solid #ddd",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1
            style={{ margin: 0, fontSize: "1.5rem", cursor: "pointer" }}
            onClick={() => navigate("/repos")}
          >
            GitAudit
          </h1>
          <span style={{ color: "#999" }}>/</span>
          <span style={{ color: "#666", fontWeight: 500 }}>
            {owner}/{repo}
          </span>
          {status === "in_progress" && currentJob === "issue-fetch" && (
            <Badge>Fetching issues...</Badge>
          )}
          {status === "in_progress" && currentJob === "sentiment" && (
            <Badge>Analyzing sentiment...</Badge>
          )}
          {status === "in_progress" && !currentJob && (
            <Badge>Pending...</Badge>
          )}
          {status === "failed" && <Badge>Failed</Badge>}
          {(status === "completed" || status === "not_started" || status === "failed" || !status) && (
            <Button
              icon={updateIcon}
              onClick={handleRefresh}
              label="Refresh data"
              size="small"
              isBusy={refreshMutation.isPending}
            />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: "#666" }}>@{user?.username}</span>
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content Area with Sidebar */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 65px)" }}>
        {/* Left Sidebar */}
        <aside
          style={{
            width: "220px",
            backgroundColor: "white",
            borderRight: "1px solid #ddd",
            padding: "1.5rem 0",
          }}
        >
          <nav>
            <NavLink
              to={`/repos/${owner}/${repo}/bugs`}
              style={({ isActive }) => ({
                display: "block",
                padding: "0.75rem 1.5rem",
                color: isActive ? "#2271b1" : "#50575e",
                backgroundColor: isActive ? "#f0f6fc" : "transparent",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
                borderLeft: isActive
                  ? "3px solid #2271b1"
                  : "3px solid transparent",
              })}
            >
              Important Bugs
            </NavLink>
            <NavLink
              to={`/repos/${owner}/${repo}/stale`}
              style={({ isActive }) => ({
                display: "block",
                padding: "0.75rem 1.5rem",
                color: isActive ? "#2271b1" : "#50575e",
                backgroundColor: isActive ? "#f0f6fc" : "transparent",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
                borderLeft: isActive
                  ? "3px solid #2271b1"
                  : "3px solid transparent",
              })}
            >
              Stale Issues
            </NavLink>
            <NavLink
              to={`/repos/${owner}/${repo}/community`}
              style={({ isActive }) => ({
                display: "block",
                padding: "0.75rem 1.5rem",
                color: isActive ? "#2271b1" : "#50575e",
                backgroundColor: isActive ? "#f0f6fc" : "transparent",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
                borderLeft: isActive
                  ? "3px solid #2271b1"
                  : "3px solid transparent",
              })}
            >
              Community Health
            </NavLink>
            <NavLink
              to={`/repos/${owner}/${repo}/settings`}
              style={({ isActive }) => ({
                display: "block",
                padding: "0.75rem 1.5rem",
                color: isActive ? "#2271b1" : "#50575e",
                backgroundColor: isActive ? "#f0f6fc" : "transparent",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
                borderLeft: isActive
                  ? "3px solid #2271b1"
                  : "3px solid transparent",
              })}
            >
              Settings
            </NavLink>
          </nav>
        </aside>

        {/* Right Content Area */}
        <main style={{ flex: 1, overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default RepositoryLayout;
