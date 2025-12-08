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
import { prsQueryOptions } from "@/data/queries/prs";
import { useFetchRepoDataMutation } from "@/data/queries/repos";
import type { PR } from "@/data/api/prs/types";
import Page from "../components/page";
import { NoIssuesPlaceholder } from "../components/no-issues-placeholder";
import { Tabs } from "../utils/lock-unlock";
import {
  createScoreField,
  titleField,
  labelsField,
  reviewDecisionField,
  reviewersField,
  commentsField,
  updatedAtField,
  createdAtField,
  authorField,
  changesField,
} from "../utils/pr-fields";
import { createRefreshPRAction } from "../utils/pr-actions";

// All pages use the same tabs
const TABS = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
];

const defaultThresholds = { critical: 80, high: 50, medium: 25 };

function StalePRsPage() {
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
    fields: ["score", "reviewDecision", "commentsCount", "updatedAt"],
    layout: {},
    search: "",
    titleField: "title",
    descriptionField: "labels",
  });

  // Get activeTab from URL parameter with validation (first tab is default)
  const validTabIds = TABS.map((t) => t.id);
  const activeTab = (tabId && validTabIds.includes(tabId) ? tabId : TABS[0].id) as "all" | "critical" | "high" | "medium";

  // Build query params
  const queryParams = useMemo(() => {
    return {
      page: view.page ?? 1,
      per_page: view.perPage ?? 20,
      search: view.search,
      scoreType: 'stale-prs' as const,
      level: activeTab,
    };
  }, [view.page, view.perPage, view.search, activeTab]);

  // Data fetching with TanStack Query
  const { data, isLoading, error, refetch } = useQuery(
    prsQueryOptions(owner!, repo!, queryParams)
  );

  const startFetchMutation = useFetchRepoDataMutation(owner!, repo!);

  // Destructure data with defaults
  const prs = data?.prs ?? [];
  const totalItems = data?.totalItems ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const thresholds = data?.thresholds || defaultThresholds;
  const fetchStatus = data?.fetchStatus;

  // Tab click handler - navigate to new URL
  const handleTabClick = useCallback(
    (newTabId: string) => {
      navigate(`/repos/${owner}/${repo}/stale-prs/${newTabId}`);
      setView((prev) => ({
        ...prev,
        page: 1, // Reset to first page
      }));
    },
    [navigate, owner, repo]
  );

  // Get threshold values as array for createScoreField
  const thresholdValues = useMemo((): [number, number, number] => {
    return [
      thresholds.critical,
      thresholds.high,
      thresholds.medium,
    ];
  }, [thresholds]);

  // Field definitions using shared utilities
  const fields: Field<PR>[] = useMemo(
    () => [
      createScoreField("Staleness", thresholdValues),
      titleField,
      labelsField,
      reviewDecisionField,
      reviewersField,
      commentsField,
      updatedAtField,
      // Additional hidden fields (user can show via column selector)
      createdAtField,
      authorField,
      changesField,
    ],
    [thresholdValues]
  );

  // Actions for DataViews
  const actions: Action<PR>[] = useMemo(
    () => [createRefreshPRAction(owner!, repo!, refetch)],
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
      title="Stale Pull Requests"
      description="Pull requests that haven't been updated or reviewed in a while"
    >
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
              {getErrorMessage(error, "Failed to load PRs")}
            </Notice>
          )}

          {/* Content area - conditional based on fetchStatus */}
          {fetchStatus === "not_started" ? (
            <NoIssuesPlaceholder
              description="stale pull requests"
              onFetchClick={() => startFetchMutation.mutate()}
            />
          ) : (
            <DataViews
              data={prs}
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

export default StalePRsPage;
