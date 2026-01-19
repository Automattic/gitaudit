import { Dropdown } from "@wordpress/components";
import type { Field } from "@wordpress/dataviews";
import type { Issue } from "@/data/api/issues/types";
import { Badge } from "./lock-unlock";

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
  scoreType: 'bugs' | 'stale' | 'community' | 'features';
  thresholds: [number, number, number];
}

const ScoreBadge = ({ score, metadata, scoreType, thresholds }: ScoreBadgeProps) => {
  const renderMetadata = () => {
    if (scoreType === "bugs") {
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
                    color: "var(--wp-admin-theme-color)",
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
            <span style={{ color: "var(--wp-admin-theme-color)" }}>{score}</span>
          </div>
        </div>
      );
    } else if (scoreType === "stale") {
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
    } else if (scoreType === "community") {
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
    } else if (scoreType === "features") {
      const items = [];

      // Demand signals
      if (metadata.reactionsScore) {
        items.push({
          label: "User reactions",
          sublabel: `${metadata.reactionCount || 0} reactions`,
          points: metadata.reactionsScore,
        });
      }

      if (metadata.uniqueCommentersScore) {
        items.push({
          label: "Unique commenters",
          sublabel: `${metadata.uniqueCommenters || 0} different people`,
          points: metadata.uniqueCommentersScore,
        });
      }

      if (metadata.meTooCommentsScore) {
        items.push({
          label: '"Me too" comments',
          sublabel: `${metadata.meTooCount || 0} explicit requests`,
          points: metadata.meTooCommentsScore,
        });
      }

      // Engagement
      if (metadata.activeDiscussionScore) {
        items.push({
          label: "Active discussion",
          sublabel: `${metadata.commentsCount || 0} comments`,
          points: metadata.activeDiscussionScore,
        });
      }

      if (metadata.recentActivityScore) {
        items.push({
          label: "Recent activity",
          sublabel: `Updated ${metadata.daysSinceUpdate || 0} days ago`,
          points: metadata.recentActivityScore,
        });
      }

      // Feasibility
      if (metadata.milestoneScore) {
        items.push({
          label: "Has milestone",
          sublabel: metadata.milestone || "Scheduled for release",
          points: metadata.milestoneScore,
        });
      }

      if (metadata.assigneeScore) {
        items.push({
          label: "Has assignee",
          sublabel: `${metadata.assigneeCount || 1} assignee(s)`,
          points: metadata.assigneeScore,
        });
      }

      // User value
      if (metadata.authorTypeScore) {
        const authorTypeLabels = {
          'team': 'Team member',
          'contributor': 'Regular contributor',
          'first-time': 'First-time contributor',
        };
        items.push({
          label: "Author type",
          sublabel: authorTypeLabels[metadata.authorType as keyof typeof authorTypeLabels] || metadata.authorType,
          points: metadata.authorTypeScore,
        });
      }

      if (metadata.sentimentScore) {
        const intensity = (metadata.sentimentIntensity || 0) * 100;
        const sentimentLabel = metadata.sentimentRaw > 0 ? "Positive" : metadata.sentimentRaw < 0 ? "Negative" : "Neutral";
        items.push({
          label: "Sentiment intensity",
          sublabel: `${sentimentLabel} (${intensity.toFixed(0)}% intensity)`,
          points: metadata.sentimentScore,
        });
      }

      // Penalties
      if (metadata.stalePenalty) {
        items.push({
          label: "⚠️ Stale feature",
          sublabel: `Created ${metadata.daysSinceCreated || 0} days ago`,
          points: metadata.stalePenalty,
        });
      }

      if (metadata.rejectionPenalty) {
        items.push({
          label: "⚠️ Rejected",
          sublabel: "Has rejection label",
          points: metadata.rejectionPenalty,
        });
      }

      if (metadata.vagueDescriptionPenalty) {
        items.push({
          label: "⚠️ Vague description",
          sublabel: `Only ${metadata.bodyLength || 0} characters`,
          points: metadata.vagueDescriptionPenalty,
        });
      }

      return (
        <div style={{ padding: "12px", minWidth: "280px" }}>
          <div style={{ marginBottom: "12px", fontWeight: "600", fontSize: "0.95rem" }}>
            Feature Priority Breakdown
          </div>
          {items.length === 0 ? (
            <div style={{ fontSize: "0.85rem", color: "#666", fontStyle: "italic" }}>
              No priority factors detected
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
                    color: item.points < 0 ? "#d63638" : "var(--wp-admin-theme-color)",
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
            <span style={{ color: "var(--wp-admin-theme-color)" }}>{score}</span>
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
      focusOnMount="firstElement"
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
  scoreType: 'bugs' | 'stale' | 'community' | 'features',
  thresholds: [number, number, number]
): Field<Issue> => ({
  id: "score",
  type: "integer",
  header,
  enableSorting: false,
  enableHiding: false,
  filterBy: false,
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
  enableSorting: false,
  filterBy: false,
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

// Shared field: Labels (getElements will be injected by components)
export const labelsField: Field<Issue> = {
  id: "labels",
  type: "array",
  header: "Labels",
  enableSorting: false,
  filterBy: {
    operators: ['isAll'],
  },
  getValue: ({ item }: { item: Issue }) => item.labels,
  render: ({ item }: { item: Issue }) => {
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

// Shared field: Comments
export const commentsField: Field<Issue> = {
  id: "commentsCount",
  type: "integer",
  header: "Comments",
  enableSorting: false,
  filterBy: false,
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
  filterBy: false,
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
  filterBy: false,
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
  filterBy: false,
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
  filterBy: false,
  render: ({ item }: { item: Issue }) => (
    <span style={{ color: "#666" }}>{item.milestone || "—"}</span>
  ),
};
