import { Dropdown } from "@wordpress/components";
import type { Field } from "@wordpress/dataviews";
import type { Issue } from "@/data/api/issues/types";

// Shared helper: Format dates
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

// Shared helper: Get score color based on thresholds
export const getScoreColor = (score: number, thresholds: [number, number, number]): string => {
  const [threshold1, threshold2, threshold3] = thresholds;
  if (score >= threshold1) return "#d63638";
  if (score >= threshold2) return "#f56e28";
  if (score >= threshold3) return "#f0b849";
  return "#50575e";
};

// Component: Score Badge with Dropdown
interface ScoreBadgeProps {
  score: number;
  metadata: Record<string, any>;
  scoreType: 'importantBugs' | 'staleIssues' | 'communityHealth';
  thresholds: [number, number, number];
}

const ScoreBadge = ({ score, metadata, scoreType, thresholds }: ScoreBadgeProps) => {
  const renderMetadata = () => {
    if (scoreType === "importantBugs") {
      const items = [];

      if (metadata.priorityLabels) {
        items.push({
          label: "Priority label",
          sublabel: "Critical, urgent, or high priority",
          points: metadata.priorityLabels,
        });
      }

      if (metadata.recentActivity) {
        items.push({
          label: "Recent activity",
          sublabel: `Updated ${metadata.daysSinceUpdate} days ago`,
          points: metadata.recentActivity,
        });
      }

      if (metadata.highReactions) {
        items.push({
          label: "High engagement",
          sublabel: `${metadata.totalReactions} reactions`,
          points: metadata.highReactions,
        });
      }

      if (metadata.assigned) {
        items.push({
          label: "Has assignee",
          sublabel: "Issue is assigned to someone",
          points: metadata.assigned,
        });
      }

      if (metadata.milestone) {
        items.push({
          label: "Has milestone",
          sublabel: "Scheduled for release",
          points: metadata.milestone,
        });
      }

      if (metadata.activeDiscussion) {
        items.push({
          label: "Active discussion",
          sublabel: `${metadata.commentsCount} comments`,
          points: metadata.activeDiscussion,
        });
      }

      if (metadata.longstandingButActive) {
        items.push({
          label: "Long-standing but active",
          sublabel: `${metadata.daysSinceCreation} days old, still being updated`,
          points: metadata.longstandingButActive,
        });
      }

      if (metadata.sentimentScore) {
        items.push({
          label: "Negative sentiment",
          sublabel: "Detected negative language",
          points: metadata.sentimentScore,
        });
      }

      return (
        <div style={{ padding: "12px", minWidth: "280px" }}>
          <div style={{ marginBottom: "12px", fontWeight: "600", fontSize: "0.95rem" }}>
            Score Breakdown
          </div>
          {items.length === 0 ? (
            <div style={{ fontSize: "0.85rem", color: "#666", fontStyle: "italic" }}>
              No scoring factors detected
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
                    color: "#2271b1",
                    marginLeft: "12px",
                    flexShrink: 0
                  }}>
                    +{item.points}
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
            <span style={{ color: "#2271b1" }}>{score}</span>
          </div>
        </div>
      );
    } else if (scoreType === "staleIssues") {
      const items = [];

      // Base time range score - show as the primary staleness indicator
      if (metadata.activityTimeRange) {
        const rangeName = metadata.activityTimeRangeName || "inactive";
        items.push({
          label: `No activity for ${metadata.daysSinceUpdated} days`,
          sublabel: rangeName,
          points: metadata.activityTimeRange,
        });
      }

      if (metadata.waitingForResponse) {
        items.push({
          label: "Waiting for response",
          sublabel: "Has 'waiting for response' label",
          points: metadata.waitingForResponse,
        });
      }

      if (metadata.abandonedByAssignee) {
        items.push({
          label: "Abandoned by assignee",
          sublabel: "Assigned but no updates",
          points: metadata.abandonedByAssignee,
        });
      }

      if (metadata.neverAddressed) {
        items.push({
          label: "Never addressed",
          sublabel: "No comments since creation",
          points: metadata.neverAddressed,
        });
      }

      if (metadata.highInterestButStale) {
        const hasReactions = metadata.totalReactions && metadata.totalReactions > 0;
        const hasComments = metadata.commentsCount && metadata.commentsCount > 0;
        let details = "";
        if (hasReactions && hasComments) {
          details = `${metadata.totalReactions} reactions, ${metadata.commentsCount} comments`;
        } else if (hasReactions) {
          details = `${metadata.totalReactions} reactions`;
        } else if (hasComments) {
          details = `${metadata.commentsCount} comments`;
        }
        items.push({
          label: "High interest but stale",
          sublabel: details,
          points: metadata.highInterestButStale,
        });
      }

      if (metadata.staleMilestone) {
        items.push({
          label: "Stale milestone",
          sublabel: "In milestone but no recent updates",
          points: metadata.staleMilestone,
        });
      }

      if (metadata.markedForClosure) {
        items.push({
          label: "Marked for closure",
          sublabel: "Has duplicate or wontfix label",
          points: metadata.markedForClosure,
        });
      }

      return (
        <div style={{ padding: "12px", minWidth: "280px" }}>
          <div style={{ marginBottom: "12px", fontWeight: "600", fontSize: "0.95rem" }}>
            Stale Score Breakdown
          </div>
          <div style={{
            fontSize: "0.85rem",
            color: "#666",
            marginBottom: "12px",
            paddingBottom: "8px",
            borderBottom: "1px solid #f0f0f0"
          }}>
            Created {metadata.daysSinceCreated} days ago
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
                    color: "#d63638",
                    marginLeft: "12px",
                    flexShrink: 0
                  }}>
                    +{item.points}
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
    } else if (scoreType === "communityHealth") {
      const items = [];

      if (metadata.firstTimeContributor) {
        items.push({
          label: "First-time contributor",
          sublabel: `No maintainer response for ${metadata.daysSinceCreation || 0} days`,
          points: metadata.firstTimeContributor,
        });
      }

      if (metadata.meTooComments) {
        items.push({
          label: '"Me too" pile-on',
          sublabel: `${metadata.meTooCount || 0} "me too" style comments`,
          points: metadata.meTooComments,
        });
      }

      if (metadata.sentimentScore) {
        const sentimentData = metadata.sentimentMetadata || {};
        const negativeComments = sentimentData.negativeComments || 0;
        const totalComments = sentimentData.totalComments || 0;
        items.push({
          label: "Sentiment analysis",
          sublabel: `${negativeComments}/${totalComments} negative comments`,
          points: metadata.sentimentScore,
        });
      }

      return (
        <div style={{ padding: "12px", minWidth: "280px" }}>
          <div style={{ marginBottom: "12px", fontWeight: "600", fontSize: "0.95rem" }}>
            Community Health Score
          </div>
          <div style={{
            fontSize: "0.85rem",
            color: "#666",
            marginBottom: "12px",
            paddingBottom: "8px",
            borderBottom: "1px solid #f0f0f0"
          }}>
            {metadata.hasMaintainerResponse
              ? "Has maintainer response"
              : "No maintainer response yet"} • {metadata.commentsCount || 0} comments
          </div>
          {items.length === 0 ? (
            <div style={{ fontSize: "0.85rem", color: "#666", fontStyle: "italic" }}>
              No community health concerns detected
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
                    color: "#d63638",
                    marginLeft: "12px",
                    flexShrink: 0
                  }}>
                    +{item.points}
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
    }
    return null;
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
            padding: "4px 12px",
            borderRadius: "4px",
            fontWeight: "bold",
            textAlign: "center",
            display: "inline-block",
            minWidth: "50px",
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
  scoreType: 'importantBugs' | 'staleIssues' | 'communityHealth',
  thresholds: [number, number, number]
): Field<Issue> => ({
  id: "score",
  type: "integer",
  header,
  enableSorting: false,
  enableHiding: false,
  render: ({ item }: { item: Issue }) => {
    const scoreObj = item.scores?.find((s: { type: string; score: number; metadata: any }) => s.type === scoreType);
    const score = scoreObj?.score || 0;
    const metadata = scoreObj?.metadata || {};
    return (
      <ScoreBadge
        score={score}
        metadata={metadata}
        scoreType={scoreType}
        thresholds={thresholds}
      />
    );
  },
});

// Shared field: Title
export const titleField: Field<Issue> = {
  id: "title",
  type: "text",
  header: "Title",
  enableHiding: false,
  enableGlobalSearch: true,
  getValue: ({ item }: { item: Issue }) => `#${item.number} ${item.title}`,
  render: ({ item }: { item: Issue }) => {
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
};

// Shared field: Labels
export const labelsField: Field<Issue> = {
  id: "labels",
  type: "text",
  header: "Labels",
  enableSorting: false,
  getValue: ({ item }: { item: Issue }) => item.labels.join(", "),
  render: ({ item }: { item: Issue }) => {
    if (!item.labels || item.labels.length === 0) {
      return <span style={{ color: "#999" }}>—</span>;
    }
    return (
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {item.labels.slice(0, 3).map((label: string, idx: number) => (
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
};

// Shared field: Comments
export const commentsField: Field<Issue> = {
  id: "commentsCount",
  type: "integer",
  header: "Comments",
  enableSorting: false,
  render: ({ item }: { item: Issue }) => (
    <span style={{ color: "#666" }}>💬 {item.commentsCount}</span>
  ),
};

// Shared field: Updated At
export const updatedAtField: Field<Issue> = {
  id: "updatedAt",
  type: "datetime",
  header: "Updated",
  enableSorting: false,
  render: ({ item }: { item: Issue }) => (
    <span style={{ color: "#666" }}>{formatDate(item.updatedAt)}</span>
  ),
};

// Shared field: Created At
export const createdAtField: Field<Issue> = {
  id: "createdAt",
  type: "datetime",
  header: "Created",
  enableSorting: false,
  render: ({ item }: { item: Issue }) => (
    <span style={{ color: "#666" }}>{formatDate(item.createdAt)}</span>
  ),
};

// Shared field: Assignees
export const assigneesField: Field<Issue> = {
  id: "assignees",
  type: "text",
  header: "Assignees",
  enableSorting: false,
  render: ({ item }: { item: Issue }) => (
    <span style={{ color: "#666" }}>
      {item.assignees && item.assignees.length > 0
        ? item.assignees.join(", ")
        : "—"}
    </span>
  ),
};

// Shared field: Milestone
export const milestoneField: Field<Issue> = {
  id: "milestone",
  type: "text",
  header: "Milestone",
  enableSorting: false,
  render: ({ item }: { item: Issue }) => (
    <span style={{ color: "#666" }}>{item.milestone || "—"}</span>
  ),
};
