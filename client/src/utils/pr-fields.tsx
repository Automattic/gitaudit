import { Dropdown } from "@wordpress/components";
import type { Field } from "@wordpress/dataviews";
import type { PR } from "@/data/api/prs/types";
import { Badge } from "./lock-unlock";
import { formatDate, getScoreColor } from "./issue-fields";

// Metadata type for PR scoring
interface PRMetadata {
  activityTimeRange?: number;
  activityTimeRangeName?: string;
  daysSinceUpdated?: number;
  daysSinceCreated?: number;
  reviewStatus?: number;
  draftPenalty?: number;
  abandonedByContributor?: number;
  mergeConflicts?: number;
  highInterestButStale?: number;
  totalReactions?: number;
  commentsCount?: number;
}

// Component: PR Score Badge with Dropdown
interface PRScoreBadgeProps {
  pr: PR;
  thresholds: [number, number, number];
}

const PRScoreBadge = ({ pr, thresholds }: PRScoreBadgeProps) => {
  const score = pr.score || 0;
  const metadata: PRMetadata = pr.metadata || {};

  const renderMetadata = () => {
    const items = [];

    // Base time range score
    if (metadata.activityTimeRange) {
      items.push({
        label: `No activity for ${metadata.daysSinceUpdated || 0} days`,
        sublabel: metadata.activityTimeRangeName || "inactive",
        points: metadata.activityTimeRange,
      });
    }

    // Review status
    if (metadata.reviewStatus) {
      let sublabel = "";
      if (pr.reviewDecision === 'CHANGES_REQUESTED') {
        sublabel = "Changes requested but not addressed";
      } else if (pr.reviewDecision === 'APPROVED') {
        sublabel = "Approved but not merged";
      } else if (!pr.reviewDecision) {
        sublabel = "No reviews yet";
      }
      items.push({
        label: "Review status",
        sublabel,
        points: metadata.reviewStatus,
      });
    }

    // Draft status
    if (metadata.draftPenalty && pr.draft) {
      items.push({
        label: "Draft PR",
        sublabel: "Expected to be work in progress",
        points: metadata.draftPenalty,
      });
    }

    // Author abandonment
    if (metadata.abandonedByContributor) {
      const isExternal = pr.authorAssociation === 'NONE' || pr.authorAssociation === 'FIRST_TIME_CONTRIBUTOR';
      items.push({
        label: isExternal ? "Abandoned by contributor" : "Abandoned by team member",
        sublabel: `No updates for ${metadata.daysSinceUpdated || 0} days`,
        points: metadata.abandonedByContributor,
      });
    }

    // Merge conflicts
    if (metadata.mergeConflicts) {
      items.push({
        label: "Has merge conflicts",
        sublabel: "Needs rebase or conflict resolution",
        points: metadata.mergeConflicts,
      });
    }

    // High interest but stale
    if (metadata.highInterestButStale) {
      const hasReactions = metadata.totalReactions && metadata.totalReactions > 0;
      const hasComments = pr.commentsCount > 0;
      let details = "";
      if (hasReactions && hasComments) {
        details = `${metadata.totalReactions} reactions, ${pr.commentsCount} comments`;
      } else if (hasReactions) {
        details = `${metadata.totalReactions} reactions`;
      } else if (hasComments) {
        details = `${pr.commentsCount} comments`;
      }
      items.push({
        label: "High interest but stale",
        sublabel: details,
        points: metadata.highInterestButStale,
      });
    }

    return (
      <div style={{ padding: "12px", minWidth: "280px" }}>
        <div style={{ marginBottom: "12px", fontWeight: "600", fontSize: "0.95rem" }}>
          Stale PR Score Breakdown
        </div>
        <div style={{
          fontSize: "0.85rem",
          color: "#666",
          marginBottom: "12px",
          paddingBottom: "8px",
          borderBottom: "1px solid #f0f0f0"
        }}>
          Created {metadata.daysSinceCreated || 0} days ago • {pr.changedFiles} file{pr.changedFiles !== 1 ? 's' : ''} changed
        </div>
        {items.length === 0 ? (
          <div style={{ fontSize: "0.85rem", color: "#666", fontStyle: "italic" }}>
            No staleness factors detected
          </div>
        ) : (
          <div>
            {items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "8px 0",
                  borderBottom: idx < items.length - 1 ? "1px solid #f0f0f0" : "none"
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", color: "#333", fontWeight: "500" }}>
                    {item.label}
                  </div>
                  {item.sublabel && (
                    <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "2px" }}>
                      {item.sublabel}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  color: item.points < 0 ? "var(--wp-admin-theme-color)" : "#d63638",
                  marginLeft: "12px",
                  flexShrink: 0
                }}>
                  {item.points > 0 ? '+' : ''}{item.points}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "2px solid #ddd",
          fontSize: "0.9rem",
          fontWeight: "600",
          display: "flex",
          justifyContent: "space-between"
        }}>
          <span>Total Score:</span>
          <span style={{ color: "#d63638" }}>{score}</span>
        </div>
      </div>
    );
  };

  return (
    <Dropdown
      popoverProps={{
        placement: "bottom-start",
      }}
      focusOnMount="container"
      renderToggle={({ onToggle }: { onToggle: () => void }) => (
        <div
          onClick={onToggle}
          style={{
            backgroundColor: getScoreColor(score, thresholds),
            color: "white",
            borderRadius: "4px",
            fontWeight: "bold",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "30px",
            height: "30px",
            lineHeight: 1,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {score}
        </div>
      )}
      renderContent={() => renderMetadata()}
    />
  );
};

// Shared field: Score badge
export const createScoreField = (
  header: string,
  thresholds: [number, number, number]
): Field<PR> => ({
  id: "score",
  type: "integer",
  header,
  enableSorting: false,
  enableHiding: false,
  filterBy: false,
  render: ({ item }: { item: PR }) => {
    return <PRScoreBadge pr={item} thresholds={thresholds} />;
  },
});

// Shared field: Title
export const titleField: Field<PR> = {
  id: "title",
  type: "text",
  header: "Title",
  enableHiding: false,
  enableSorting: false,
  filterBy: false,
  enableGlobalSearch: true,
  getValue: ({ item }: { item: PR }) => `#${item.number} ${item.title}`,
  render: ({ item }: { item: PR }) => {
    const maxLength = 60;
    const titleText =
      item.title.length > maxLength
        ? `${item.title.substring(0, maxLength)}...`
        : item.title;
    return (
      <span title={item.title}>
        #{item.number} {titleText}
        {item.draft && (
          <Badge style={{ marginLeft: "8px" }}>Draft</Badge>
        )}
      </span>
    );
  },
};

// Shared field: Labels
export const labelsField: Field<PR> = {
  id: "labels",
  type: "array",
  header: "Labels",
  enableSorting: false,
  filterBy: false,
  getValue: ({ item }: { item: PR }) => item.labels,
  render: ({ item }: { item: PR }) => {
    if (!item.labels || item.labels.length === 0) {
      return <span style={{ color: "#999" }}>—</span>;
    }
    return (
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {item.labels.slice(0, 3).map((label: string, idx: number) => (
          <Badge key={idx}>{label}</Badge>
        ))}
        {item.labels.length > 3 && (
          <span style={{ fontSize: "0.75rem", color: "#666" }}>
            +{item.labels.length - 3}
          </span>
        )}
      </div>
    );
  },
};

// Review Decision field
export const reviewDecisionField: Field<PR> = {
  id: "reviewDecision",
  type: "text",
  header: "Review",
  enableSorting: false,
  filterBy: false,
  render: ({ item }: { item: PR }) => {
    if (!item.reviewDecision) {
      return <span style={{ color: "#999" }}>No reviews</span>;
    }
    const statusColors = {
      'APPROVED': '#2ea44f',
      'CHANGES_REQUESTED': '#d73a49',
      'REVIEW_REQUIRED': '#f0b849',
    };
    const statusLabels = {
      'APPROVED': '✓ Approved',
      'CHANGES_REQUESTED': '✗ Changes requested',
      'REVIEW_REQUIRED': '⋯ Review required',
    };
    return (
      <span style={{
        color: statusColors[item.reviewDecision as keyof typeof statusColors] || "#666",
        fontWeight: "500"
      }}>
        {statusLabels[item.reviewDecision as keyof typeof statusLabels] || item.reviewDecision}
      </span>
    );
  },
};

// Reviewers field
export const reviewersField: Field<PR> = {
  id: "reviewers",
  type: "text",
  header: "Reviewers",
  enableSorting: false,
  filterBy: false,
  render: ({ item }: { item: PR }) => (
    <span style={{ color: "#666" }}>
      {item.reviewers && item.reviewers.length > 0
        ? item.reviewers.join(", ")
        : "—"}
    </span>
  ),
};

// Comments field
export const commentsField: Field<PR> = {
  id: "commentsCount",
  type: "integer",
  header: "Comments",
  enableSorting: false,
  filterBy: false,
  render: ({ item }: { item: PR }) => (
    <span style={{ color: "#666" }}>💬 {item.commentsCount}</span>
  ),
};

// Updated At field
export const updatedAtField: Field<PR> = {
  id: "updatedAt",
  type: "datetime",
  header: "Updated",
  enableSorting: false,
  filterBy: false,
  render: ({ item }: { item: PR }) => (
    <span style={{ color: "#666" }}>{formatDate(item.updatedAt)}</span>
  ),
};

// Created At field
export const createdAtField: Field<PR> = {
  id: "createdAt",
  type: "datetime",
  header: "Created",
  enableSorting: false,
  filterBy: false,
  render: ({ item }: { item: PR }) => (
    <span style={{ color: "#666" }}>{formatDate(item.createdAt)}</span>
  ),
};

// Author field
export const authorField: Field<PR> = {
  id: "authorLogin",
  type: "text",
  header: "Author",
  enableSorting: false,
  filterBy: false,
  render: ({ item }: { item: PR }) => (
    <span style={{ color: "#666" }}>{item.authorLogin}</span>
  ),
};

// Changes field (additions + deletions)
export const changesField: Field<PR> = {
  id: "changes",
  type: "text",
  header: "Changes",
  enableSorting: false,
  filterBy: false,
  render: ({ item }: { item: PR }) => (
    <span style={{ color: "#666", fontSize: "0.85rem" }}>
      <span style={{ color: "#2da44e" }}>+{item.additions}</span>
      {" "}
      <span style={{ color: "#cf222e" }}>−{item.deletions}</span>
    </span>
  ),
};
