import { useState, useMemo, useCallback } from "react";
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
import { useIssues } from "../hooks/useIssues";
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
import { createRefreshIssueAction } from "../utils/issueActions.jsx";

function StaleIssues() {
  const { owner, repo } = useParams();
  const { startFetch } = useIssueFetch(owner, repo);

  // UI state (DataViews)
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

  // UI state (tabs)
  const [activeTab, setActiveTab] = useState("all");

  // Configuration for useIssues hook (memoized to prevent re-renders)
  const issuesConfig = useMemo(
    () => ({
      scoreType: 'staleIssues',
      defaultThresholds: {
        veryStale: 60,
        moderatelyStale: 40,
        slightlyStale: 20,
      },
      buildApiParams: ({ page, perPage, activeTab, search, scoreType }) => {
        const params = new URLSearchParams({
          page: page.toString(),
          per_page: perPage.toString(),
          scoreType,
          level: activeTab,
        });
        if (search) {
          params.set("search", search);
        }
        return params;
      },
      extractStats: (data) => data.stats?.staleIssues || null,
      extractThresholds: (data) =>
        data.thresholds?.staleIssues || { veryStale: 60, moderatelyStale: 40, slightlyStale: 20 },
    }),
    []
  );

  // Data fetching (hook handles all data state)
  const {
    issues,
    totalItems,
    totalPages,
    stats,
    thresholds,
    fetchStatus,
    loading,
    error,
    reloadIssues,
  } = useIssues(issuesConfig, {
    page: view.page,
    perPage: view.perPage,
    search: view.search,
    activeTab,
  });

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

  // Actions for DataViews
  const actions = useMemo(
    () => [createRefreshIssueAction(owner, repo, reloadIssues)],
    [owner, repo, reloadIssues]
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
              <Tabs.TabList>
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
                actions={actions}
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
