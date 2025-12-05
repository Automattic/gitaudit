import { useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DataViews, type Action, type Field, type View } from "@wordpress/dataviews";
import {
  Card,
  CardBody,
  Button,
  Notice,
  Spinner,
} from "@wordpress/components";
import { issuesQueryOptions, useStartIssueFetchMutation } from "@/data/queries/issues";
import type { Issue } from "@/data/api/issues/types";
import Page from "../components/page";
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
} from "../utils/issue-fields.jsx";
import { createRefreshIssueAction } from "../utils/issue-actions.jsx";

function StaleIssues() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  // UI state (DataViews)
  const [view, setView] = useState<View>({
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
  const [activeTab, setActiveTab] = useState<'all' | 'veryStale' | 'moderatelyStale' | 'slightlyStale'>("all");

  // Data fetching with TanStack Query
  const { data, isLoading, error, refetch } = useQuery(
    issuesQueryOptions(owner!, repo!, {
      page: view.page ?? 1,
      per_page: view.perPage ?? 20,
      search: view.search,
      scoreType: 'staleIssues',
      level: activeTab,  // Use 'level' for stale issues, not 'priority'
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
  const handleTabClick = useCallback((staleLevel: string) => {
    setActiveTab(staleLevel as 'all' | 'veryStale' | 'moderatelyStale' | 'slightlyStale');
    setView((prev) => ({
      ...prev,
      page: 1, // Reset to first page
    }));
  }, []);

  // Get thresholds with defaults
  const staleThresholds = thresholds?.staleIssues || {
    veryStale: 60,
    moderatelyStale: 40,
    slightlyStale: 20,
  };

  // Field definitions using shared utilities
  const fields: Field<Issue>[] = useMemo(
    () => [
      createScoreField("Staleness", "staleIssues", [
        staleThresholds.veryStale,
        staleThresholds.moderatelyStale,
        staleThresholds.slightlyStale
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
    [staleThresholds]
  );

  // Actions for DataViews
  const actions: Action<Issue>[] = useMemo(
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
      title="Stale Issues"
      description="Issues scored by inactivity and age."
    >
      <Card size="none">
        <CardBody>
          {/* Tabs - always visible */}
          <Tabs
            selectedTabId={activeTab}
            onSelect={(tabId: string) => handleTabClick(tabId as string)}
          >
            <Tabs.TabList>
              <Tabs.Tab tabId="all">All</Tabs.Tab>
              <Tabs.Tab tabId="veryStale">Very Stale</Tabs.Tab>
              <Tabs.Tab tabId="moderatelyStale">Moderately Stale</Tabs.Tab>
              <Tabs.Tab tabId="slightlyStale">Slightly Stale</Tabs.Tab>
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
                Fetch issues from GitHub to start analyzing stale issues.
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
              getItemId={(item) => String(item.id)}
            />
          )}
        </CardBody>
      </Card>
    </Page>
  );
}

export default StaleIssues;
