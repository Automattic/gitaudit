import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  DataViews,
  type Action,
  type Field,
  type View,
} from "@wordpress/dataviews";
import { Card, CardBody, Notice } from "@wordpress/components";
import { getErrorMessage } from "@/utils/error-handling";
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
} from "../utils/issue-fields";
import { createRefreshIssueAction } from "../utils/issue-actions";
import { fetchLabels } from "@/data/api/issues/fetchers";

interface IssuesPageProps {
  title: string;
  description: string;
  type: "bugs" | "stale" | "community" | "features";
  scoreLabel: string;
  defaultThresholds: { critical: number; high: number; medium: number };
  extraFilters?: Record<string, unknown>;
}

// All pages use the same tabs
const TABS = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
];

function IssuesPage({
  title,
  description,
  type,
  scoreLabel,
  defaultThresholds,
  extraFilters = {},
}: IssuesPageProps) {
  const { owner, repo, tabId } = useParams<{
    owner: string;
    repo: string;
    tabId: string;
  }>();
  const navigate = useNavigate();

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

  // Get activeTab from URL parameter with validation (first tab is default)
  const validTabIds = TABS.map((t) => t.id);
  const activeTab = (tabId && validTabIds.includes(tabId) ? tabId : TABS[0].id) as "all" | "critical" | "high" | "medium";

  // Extract labels filter from view.filters
  const labelsFilter = useMemo(() => {
    const labelsFilterObj = view.filters?.find(
      (f) => f.field === "labels" && f.operator === "isAll"
    );
    return labelsFilterObj?.value as string[] | undefined;
  }, [view.filters]);

  // Build query params - always use level param
  const queryParams = useMemo(() => {
    return {
      page: view.page ?? 1,
      per_page: view.perPage ?? 20,
      search: view.search,
      scoreType: type,
      level: activeTab,
      labels: labelsFilter,
      ...extraFilters,
    };
  }, [view.page, view.perPage, view.search, type, activeTab, labelsFilter, extraFilters]);

  // Data fetching with TanStack Query
  const { data, isLoading, error, refetch } = useQuery(
    issuesQueryOptions(owner!, repo!, queryParams)
  );

  const startFetchMutation = useStartIssueFetchMutation(owner!, repo!);

  // Destructure data with defaults
  const issues = data?.issues ?? [];
  const totalItems = data?.totalItems ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const thresholds = data?.thresholds;
  const fetchStatus = data?.fetchStatus;

  // Tab click handler - navigate to new URL
  const handleTabClick = useCallback(
    (newTabId: string) => {
      navigate(`/repos/${owner}/${repo}/${type}/${newTabId}`);
      setView((prev) => ({
        ...prev,
        page: 1, // Reset to first page
      }));
    },
    [navigate, owner, repo, type]
  );

  // Get thresholds with defaults (all types now use critical/high/medium)
  const scoreThresholds = thresholds?.[type] || defaultThresholds;

  // Get threshold values as array for createScoreField
  const thresholdValues = useMemo((): [number, number, number] => {
    return [
      scoreThresholds.critical,
      scoreThresholds.high,
      scoreThresholds.medium,
    ];
  }, [scoreThresholds]);

  // Create cached label fetcher using the new API endpoint
  const getLabelsElements = useCallback(async () => {
    const labels = await fetchLabels(owner!, repo!);
    return labels.map((label) => ({ value: label, label }));
  }, [owner, repo]);

  // Field definitions using shared utilities
  const fields: Field<Issue>[] = useMemo(
    () => [
      createScoreField(scoreLabel, type, thresholdValues),
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
    [scoreLabel, type, thresholdValues, getLabelsElements]
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
    <Page title={title} description={description}>
      <Card size="none">
        <CardBody>
          {/* Tabs - always visible */}
          <Tabs
            selectedTabId={activeTab}
            onSelect={(tabId: string) => handleTabClick(tabId)}
          >
            <Tabs.TabList>
              {TABS.map((tab) => (
                <Tabs.Tab key={tab.id} tabId={tab.id}>
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.TabList>
          </Tabs>

          {/* Error notice */}
          {error && (
            <Notice status="error" isDismissible={false}>
              {getErrorMessage(error, "Failed to load issues")}
            </Notice>
          )}

          {/* Content area - conditional based on fetchStatus */}
          {fetchStatus === "not_started" ? (
            <NoIssuesPlaceholder
              description={description.toLowerCase()}
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

export default IssuesPage;
