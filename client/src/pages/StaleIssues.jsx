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
import {
  createScoreField,
  titleField,
  labelsField,
  commentsField,
  updatedAtField,
  createdAtField,
  assigneesField,
  milestoneField,
} from "../utils/issueFields.jsx";

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
  const [fetchStatus, setFetchStatus] = useState('not_started');
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
        scoreType: 'staleIssues',
        level: activeTab,
      });

      // Add search parameter if present
      if (view.search) {
        params.set("search", view.search);
      }

      const data = await api.get(
        `/api/repos/${owner}/${repo}/issues?${params}`
      );

      setIssues(data.issues || []);
      setTotalItems(data.totalItems || 0);
      setTotalPages(data.totalPages || 0);
      setStats(data.stats?.staleIssues || null);
      setThresholds(data.thresholds?.staleIssues || { veryStale: 60, moderatelyStale: 40, slightlyStale: 20 });
      setFetchStatus(data.fetchStatus || 'not_started');
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

  // Field definitions using shared utilities
  const fields = useMemo(
    () => [
      createScoreField("Stale Score", "staleIssues", [
        thresholds.veryStale,
        thresholds.moderatelyStale,
        thresholds.slightlyStale
      ]),
      titleField,
      labelsField,
      {
        id: "daysSinceUpdated",
        type: "integer",
        header: "Days Stale",
        enableSorting: false,
        width: "120px",
        getValue: ({ item }) => {
          const staleScore = item.scores.find(s => s.type === 'staleIssues');
          return staleScore?.metadata?.daysSinceUpdated || 0;
        },
        render: ({ item }) => {
          const staleScore = item.scores.find(s => s.type === 'staleIssues');
          const days = staleScore?.metadata?.daysSinceUpdated || 0;
          return (
            <span style={{ color: "#666", fontWeight: "500" }}>
              {days} {days === 1 ? "day" : "days"}
            </span>
          );
        },
      },
      commentsField,
      // Additional hidden fields (user can show via column selector)
      updatedAtField,
      createdAtField,
      assigneesField,
      milestoneField,
    ],
    [thresholds]
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
  if (loading && fetchStatus === 'not_started') {
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

  // Main view
  return (
    <Page
      title="Stale Issues"
      description="Issues that haven't been updated recently and may need attention."
    >
      {fetchStatus === 'not_started' ? (
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
                <Tabs.Tab tabId="veryStale">Very Stale ({stats?.veryStale || 0})</Tabs.Tab>
                <Tabs.Tab tabId="moderatelyStale">Moderately Stale ({stats?.moderatelyStale || 0})</Tabs.Tab>
                <Tabs.Tab tabId="slightlyStale">Slightly Stale ({stats?.slightlyStale || 0})</Tabs.Tab>
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
