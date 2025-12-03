import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { DataViews } from "@wordpress/dataviews";
import {
  Card,
  CardBody,
  Button,
  Notice,
  Spinner,
} from "@wordpress/components";
import { useIssueFetch } from "../hooks/useIssueFetch";
import api from "../utils/api";
import Page from "../components/Page";
import { Tabs } from "../utils/lock-unlock";

function StaleIssues() {
  const { owner, repo } = useParams();
  const { startFetch } = useIssueFetch(owner, repo);

  // DataViews state
  const [view, setView] = useState({
    type: "table",
    page: 1,
    perPage: 20,
    filters: [],
    fields: ["score", "daysSinceUpdated", "commentsCount"],
    layout: {},
    search: "",
    titleField: "title",
    descriptionField: "labels",
  });

  // Data state
  const [issues, setIssues] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState(null);
  const [thresholds, setThresholds] = useState({
    veryStale: 60,
    moderatelyStale: 40,
    slightlyStale: 20,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  const loadIssues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: view.page.toString(),
        per_page: view.perPage.toString(),
        level: activeTab,
      });

      // Add search parameter if present
      if (view.search) {
        params.set("search", view.search);
      }

      const data = await api.get(
        `/api/repos/${owner}/${repo}/issues/stale-issues?${params}`
      );

      setIssues(data.issues || []);
      setTotalItems(data.totalItems || 0);
      setTotalPages(data.totalPages || 0);
      setStats(data.stats);
      setThresholds(data.thresholds || { veryStale: 60, moderatelyStale: 40, slightlyStale: 20 });
      setError(null);
    } catch (err) {
      console.error("Error loading stale issues:", err);
      setError(err.message || "Failed to load stale issues");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [owner, repo, view.page, view.perPage, view.search, activeTab]);

  // Load issues on mount and when dependencies change
  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  // Tab click handler
  const handleTabClick = useCallback((staleLevel) => {
    setActiveTab(staleLevel);
    setView((prev) => ({
      ...prev,
      page: 1, // Reset to first page
    }));
  }, []);

  // Helper function to format dates
  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }, []);

  // Helper function to get score color
  const getScoreColor = useCallback(
    (score) => {
      if (score >= thresholds.veryStale) return "#d63638";
      if (score >= thresholds.moderatelyStale) return "#f56e28";
      if (score >= thresholds.slightlyStale) return "#f0b849";
      return "#50575e";
    },
    [thresholds]
  );

  // Field definitions
  const fields = useMemo(
    () => [
      {
        id: "score",
        type: "integer",
        header: "Stale Score",
        enableSorting: false,
        enableHiding: false,
        width: "100px",
        render: ({ item }) => (
          <div
            style={{
              backgroundColor: getScoreColor(item.score),
              color: "white",
              padding: "4px 12px",
              borderRadius: "4px",
              fontWeight: "bold",
              textAlign: "center",
              display: "inline-block",
              minWidth: "50px",
            }}
          >
            {item.score}
          </div>
        ),
      },
      {
        id: "title",
        type: "text",
        header: "Title",
        enableHiding: false,
        enableGlobalSearch: true,
        getValue: ({ item }) => `#${item.number} ${item.title}`,
        render: ({ item }) => {
          const maxLength = 60;
          const titleText =
            item.title.length > maxLength
              ? `${item.title.substring(0, maxLength)}...`
              : item.title;
          return (
            <span title={item.title}>
              #{item.number} {titleText}
            </span>
          );
        },
      },
      {
        id: "labels",
        type: "text",
        header: "Labels",
        enableSorting: false,
        getValue: ({ item }) => item.labels.join(", "),
        width: "20%",
        render: ({ item }) => {
          if (!item.labels || item.labels.length === 0) {
            return <span style={{ color: "#999" }}>—</span>;
          }
          return (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {item.labels.slice(0, 3).map((label, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    backgroundColor: "#f0f0f0",
                    borderRadius: "12px",
                    color: "#50575e",
                  }}
                >
                  {label}
                </span>
              ))}
              {item.labels.length > 3 && (
                <span style={{ fontSize: "0.75rem", color: "#666" }}>
                  +{item.labels.length - 3}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "daysSinceUpdated",
        type: "integer",
        header: "Days Stale",
        enableSorting: false,
        width: "120px",
        getValue: ({ item }) => item.scoreMetadata?.daysSinceUpdated || 0,
        render: ({ item }) => {
          const days = item.scoreMetadata?.daysSinceUpdated || 0;
          return (
            <span style={{ color: "#666", fontWeight: "500" }}>
              {days} {days === 1 ? "day" : "days"}
            </span>
          );
        },
      },
      {
        id: "commentsCount",
        type: "integer",
        header: "Comments",
        enableSorting: false,
        width: "100px",
        render: ({ item }) => (
          <span style={{ color: "#666" }}>💬 {item.commentsCount}</span>
        ),
      },
      // Additional hidden fields (user can show via column selector)
      {
        id: "updatedAt",
        type: "datetime",
        header: "Last Updated",
        enableSorting: false,
        render: ({ item }) => (
          <span style={{ color: "#666" }}>{formatDate(item.updatedAt)}</span>
        ),
      },
      {
        id: "createdAt",
        type: "datetime",
        header: "Created",
        enableSorting: false,
        render: ({ item }) => (
          <span style={{ color: "#666" }}>{formatDate(item.createdAt)}</span>
        ),
      },
      {
        id: "assignees",
        type: "text",
        header: "Assignees",
        enableSorting: false,
        render: ({ item }) => (
          <span style={{ color: "#666" }}>
            {item.assignees && item.assignees.length > 0
              ? item.assignees.join(", ")
              : "—"}
          </span>
        ),
      },
      {
        id: "milestone",
        type: "text",
        header: "Milestone",
        enableSorting: false,
        render: ({ item }) => (
          <span style={{ color: "#666" }}>{item.milestone || "—"}</span>
        ),
      },
    ],
    [thresholds, formatDate, getScoreColor]
  );

  // Pagination info for DataViews
  const paginationInfo = useMemo(
    () => ({
      totalItems,
      totalPages,
    }),
    [totalItems, totalPages]
  );

  // Render item link for DataViews
  const renderItemLink = useCallback(
    ({ item, ...props }) => (
      <a href={item.url} target="_blank" rel="noopener noreferrer" {...props} />
    ),
    []
  );

  // Show initial loading state
  if (loading && stats === null) {
    return (
      <Page title="Stale Issues">
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <Spinner />
          <p style={{ marginTop: "1rem", color: "#666" }}>
            Loading stale issues...
          </p>
        </div>
      </Page>
    );
  }

  // No data fetched yet (stats will be null on 404 or error)
  const hasNoData = stats === null || stats.all === 0;

  // Main view
  return (
    <Page
      title="Stale Issues"
      description="Issues that haven't been updated recently and may need attention."
    >
      {hasNoData ? (
        <Card>
          <CardBody>
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>No Issues Yet</h3>
              <p style={{ marginBottom: "2rem", color: "#666" }}>
                Fetch issues from GitHub to start detecting stale issues.
                This may take a few minutes depending on the repository size.
              </p>
              <Button variant="primary" onClick={startFetch}>
                Fetch Issues from GitHub
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card size="none">
          <CardBody>
            {/* Tabs */}
            <Tabs
              selectedTabId={activeTab}
              onSelect={(tabId) => handleTabClick(tabId)}
            >
              <Tabs.TabList style={{ marginBottom: "1.5rem" }}>
                <Tabs.Tab tabId="all">All ({stats?.all || 0})</Tabs.Tab>
                <Tabs.Tab tabId="very-stale">Very Stale ({stats?.veryStale || 0})</Tabs.Tab>
                <Tabs.Tab tabId="moderately-stale">Moderately Stale ({stats?.moderatelyStale || 0})</Tabs.Tab>
                <Tabs.Tab tabId="slightly-stale">Slightly Stale ({stats?.slightlyStale || 0})</Tabs.Tab>
              </Tabs.TabList>
            </Tabs>

            {/* Error notice */}
            {error && (
              <Notice
                status="error"
                isDismissible={false}
                style={{ marginBottom: "1rem" }}
              >
                {error}
              </Notice>
            )}

            {/* Loading state for initial load */}
            {loading && issues.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem" }}>
                <Spinner />
                <p style={{ marginTop: "1rem", color: "#666" }}>
                  Analyzing stale issues...
                </p>
              </div>
            ) : issues.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <p style={{ color: "#666", margin: 0 }}>
                  No stale issues found in this category.
                </p>
              </div>
            ) : (
              <DataViews
                data={issues}
                fields={fields}
                view={view}
                onChangeView={setView}
                renderItemLink={renderItemLink}
                isItemClickable={() => true}
                paginationInfo={paginationInfo}
                defaultLayouts={{ table: {} }}
                getItemId={(item) => item.id}
              />
            )}
          </CardBody>
        </Card>
      )}
    </Page>
  );
}

export default StaleIssues;
