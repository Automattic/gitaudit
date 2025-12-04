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

function CommunityHealth() {
  const { owner, repo } = useParams();
  const { startFetch } = useIssueFetch(owner, repo);

  // UI state (DataViews)
  const [view, setView] = useState({
    type: "table",
    page: 1,
    perPage: 20,
    filters: [],
    fields: ["score", "commentsCount", "updatedAt"],
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
      scoreType: 'communityHealth',
      defaultThresholds: {
        critical: 60,
        high: 40,
        medium: 20,
      },
      buildApiParams: ({ page, perPage, activeTab, search, scoreType }) => {
        const params = new URLSearchParams({
          page: page.toString(),
          per_page: perPage.toString(),
          scoreType,
          priority: activeTab,
        });
        if (search) {
          params.set("search", search);
        }
        return params;
      },
      extractStats: (data) => data.stats?.communityHealth || null,
      extractThresholds: (data) =>
        data.thresholds?.communityHealth || { critical: 60, high: 40, medium: 20 },
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
  const handleTabClick = useCallback((priorityLevel) => {
    setActiveTab(priorityLevel);
    setView((prev) => ({
      ...prev,
      page: 1, // Reset to first page
    }));
  }, []);

  // Field definitions using shared utilities
  const fields = useMemo(
    () => [
      createScoreField("Score", "communityHealth", [
        thresholds.critical,
        thresholds.high,
        thresholds.medium
      ]),
      titleField,
      labelsField,
      commentsField,
      updatedAtField,
      // Additional hidden fields (user can show via column selector)
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
      <Page title="Community Health">
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <Spinner />
          <p style={{ marginTop: "1rem", color: "#666" }}>
            Loading community health data...
          </p>
        </div>
      </Page>
    );
  }

  // Main view
  return (
    <Page
      title="Community Health"
      description="Issues indicating community engagement problems that need maintainer attention."
    >
      {fetchStatus === 'not_started' ? (
        <Card>
          <CardBody>
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>No Issues Yet</h3>
              <p style={{ marginBottom: "2rem", color: "#666" }}>
                Fetch issues from GitHub to start analyzing community health.
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
                <Tabs.Tab tabId="critical">Critical ({stats?.critical || 0})</Tabs.Tab>
                <Tabs.Tab tabId="high">High ({stats?.high || 0})</Tabs.Tab>
                <Tabs.Tab tabId="medium">Medium ({stats?.medium || 0})</Tabs.Tab>
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
                  Analyzing community health...
                </p>
              </div>
            ) : issues.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <p style={{ color: "#666", margin: 0 }}>
                  No issues found in this category.
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

export default CommunityHealth;
