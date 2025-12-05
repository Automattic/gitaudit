import { useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  DataViews,
  type Action,
  type Field,
  type View,
} from "@wordpress/dataviews";
import { Card, CardBody, Notice } from "@wordpress/components";
import {
  issuesQueryOptions,
  useStartIssueFetchMutation,
} from "@/data/queries/issues";
import type { Issue } from "@/data/api/issues/types";
import Page from "../components/page";
import { NoIssuesPlaceholder } from "../components/no-issues-placeholder";
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
import { fetchLabels } from "@/data/api/issues/fetchers";

function CommunityHealth() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  // UI state (DataViews)
  const [view, setView] = useState<View>({
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
  const [activeTab, setActiveTab] = useState<
    "all" | "critical" | "high" | "medium"
  >("all");

  // Extract labels filter from view.filters
  const labelsFilter = useMemo(() => {
    const labelsFilterObj = view.filters?.find(
      (f) => f.field === "labels" && f.operator === "isAll"
    );
    return labelsFilterObj?.value as string[] | undefined;
  }, [view.filters]);

  // Data fetching with TanStack Query
  const { data, isLoading, error, refetch } = useQuery(
    issuesQueryOptions(owner!, repo!, {
      page: view.page ?? 1,
      per_page: view.perPage ?? 20,
      search: view.search,
      scoreType: "communityHealth",
      priority: activeTab,
      labels: labelsFilter,
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
    setActiveTab(priorityLevel as "all" | "critical" | "high" | "medium");
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

  // Create cached label fetcher using the new API endpoint
  const getLabelsElements = useCallback(async () => {
    const labels = await fetchLabels(owner!, repo!);
    return labels.map((label) => ({ value: label, label }));
  }, [owner, repo]);

  // Field definitions using shared utilities
  const fields: Field<Issue>[] = useMemo(
    () => [
      createScoreField("Score", "communityHealth", [
        communityHealthThresholds.critical,
        communityHealthThresholds.high,
        communityHealthThresholds.medium,
      ]),
      titleField,
      {
        ...labelsField,
        getElements: getLabelsElements,
      },
      commentsField,
      updatedAtField,
      // Additional hidden fields (user can show via column selector)
      createdAtField,
      assigneesField,
      milestoneField,
    ],
    [communityHealthThresholds, getLabelsElements]
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
      title="Community Health"
      description="Issues scored by community engagement and responsiveness."
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
              <Tabs.Tab tabId="critical">Critical</Tabs.Tab>
              <Tabs.Tab tabId="high">High</Tabs.Tab>
              <Tabs.Tab tabId="medium">Medium</Tabs.Tab>
            </Tabs.TabList>
          </Tabs>

          {/* Error notice */}
          {error && (
            <Notice status="error" isDismissible={false}>
              {error instanceof Error ? error.message : "Failed to load issues"}
            </Notice>
          )}

          {/* Content area - conditional based on fetchStatus */}
          {fetchStatus === "not_started" ? (
            <NoIssuesPlaceholder
              description="community health"
              onFetchClick={() => startFetchMutation.mutate()}
            />
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
              isLoading={isLoading}
              empty={<div style={{ padding: "2rem 0" }}>No Results</div>}
            />
          )}
        </CardBody>
      </Card>
    </Page>
  );
}

export default CommunityHealth;
