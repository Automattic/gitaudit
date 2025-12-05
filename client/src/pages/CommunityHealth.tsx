import { useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DataViews } from "@wordpress/dataviews";
import {
  Card,
  CardBody,
  Button,
  Notice,
  Spinner,
} from "@wordpress/components";
import { issuesQueryOptions, useStartIssueFetchMutation } from "@/data/queries/issues";
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
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  // UI state (DataViews)
  const [view, setView] = useState({
    type: "table" as const,
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
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'high' | 'medium'>("all");

  // Data fetching with TanStack Query
  const { data, isLoading, error, refetch } = useQuery(
    issuesQueryOptions(owner!, repo!, {
      page: view.page,
      per_page: view.perPage,
      search: view.search,
      scoreType: 'communityHealth',
      priority: activeTab,
    })
  );

  const startFetchMutation = useStartIssueFetchMutation(owner!, repo!);

  // Destructure data with defaults
  const issues = data?.issues ?? [];
  const totalItems = data?.totalItems ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const thresholds = data?.thresholds;
  const fetchStatus = data?.fetchStatus;

  // Tab click handler
  const handleTabClick = useCallback((priorityLevel: string) => {
    setActiveTab(priorityLevel as 'all' | 'critical' | 'high' | 'medium');
    setView((prev) => ({
      ...prev,
      page: 1, // Reset to first page
    }));
  }, []);

  // Get thresholds with defaults
  const communityHealthThresholds = thresholds?.communityHealth || {
    critical: 60,
    high: 40,
    medium: 20,
  };

  // Field definitions using shared utilities
  const fields = useMemo(
    () => [
      createScoreField("Score", "communityHealth", [
        communityHealthThresholds.critical,
        communityHealthThresholds.high,
        communityHealthThresholds.medium
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
    [communityHealthThresholds]
  );

  // Actions for DataViews
  const actions = useMemo(
    () => [createRefreshIssueAction(owner!, repo!, refetch)],
    [owner, repo, refetch]
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
    ({ item, ...props }: any) => (
      <a href={item.url} target="_blank" rel="noopener noreferrer" {...props} />
    ),
    []
  );

  // Main view - always show page structure
  return (
    <Page
      title="Community Health"
      description="Issues scored by community engagement and responsiveness."
    >
      <Card size="none">
        <CardBody>
          {/* Tabs - always visible */}
          <Tabs
            selectedTabId={activeTab}
            onSelect={(tabId) => handleTabClick(tabId as string)}
          >
            <Tabs.TabList>
              <Tabs.Tab tabId="all">All</Tabs.Tab>
              <Tabs.Tab tabId="critical">Critical</Tabs.Tab>
              <Tabs.Tab tabId="high">High</Tabs.Tab>
              <Tabs.Tab tabId="medium">Medium</Tabs.Tab>
            </Tabs.TabList>
          </Tabs>

          {/* Error notice */}
          {error && (
            <Notice
              status="error"
              isDismissible={false}
            >
              {error instanceof Error ? error.message : 'Failed to load issues'}
            </Notice>
          )}

          {/* Content area - conditional based on fetchStatus */}
          {fetchStatus === 'not_started' ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>No Issues Yet</h3>
              <p style={{ marginBottom: "2rem", color: "#666" }}>
                Fetch issues from GitHub to start analyzing community health.
                This may take a few minutes depending on the repository size.
              </p>
              <Button variant="primary" onClick={() => startFetchMutation.mutate()}>
                Fetch Issues from GitHub
              </Button>
            </div>
          ) : isLoading ? (
            <div style={{ textAlign: "center", padding: "1rem" }}>
              <Spinner />
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
    </Page>
  );
}

export default CommunityHealth;
