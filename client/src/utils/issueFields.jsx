import { Dropdown, Button } from "@wordpress/components";

// Shared helper: Format dates
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

// Shared helper: Get score color based on thresholds
export const getScoreColor = (score, thresholds) => {
  const [threshold1, threshold2, threshold3] = thresholds;
  if (score >= threshold1) return "#d63638";
  if (score >= threshold2) return "#f56e28";
  if (score >= threshold3) return "#f0b849";
  return "#50575e";
};

// Component: Score Badge with Dropdown
const ScoreBadge = ({ score, metadata, scoreType, thresholds }) => {
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
    }
    return null;
  };

  return (
    <Dropdown
      popoverProps={{
        placement: "bottom-start",
      }}
      focusOnMount="container"
      renderToggle={({ isOpen, onToggle }) => (
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
export const createScoreField = (header, scoreType, thresholds) => ({
  id: "score",
  type: "integer",
  header,
  enableSorting: false,
  enableHiding: false,
  width: "100px",
  render: ({ item }) => {
    const scoreObj = item.scores.find(s => s.type === scoreType);
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
export const titleField = {
  id: "title",
  type: "text",
  header: "Title",
  enableHiding: false,
  enableGlobalSearch: true,
  getValue: ({ item }) => `#${item.number} ${item.title}`,
  render: ({ item }) => {
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
export const labelsField = {
  id: "labels",
  type: "text",
  header: "Labels",
  enableSorting: false,
  getValue: ({ item }) => item.labels.join(", "),
  width: "20%",
  render: ({ item }) => {
    if (!item.labels || item.labels.length === 0) {
      return <span style={{ color: "#999" }}>—</span>;
    }
    return (
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {item.labels.slice(0, 3).map((label, idx) => (
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
export const commentsField = {
  id: "commentsCount",
  type: "integer",
  header: "Comments",
  enableSorting: false,
  width: "100px",
  render: ({ item }) => (
    <span style={{ color: "#666" }}>💬 {item.commentsCount}</span>
  ),
};

// Shared field: Updated At
export const updatedAtField = {
  id: "updatedAt",
  type: "datetime",
  header: "Updated",
  enableSorting: false,
  width: "120px",
  render: ({ item }) => (
    <span style={{ color: "#666" }}>{formatDate(item.updatedAt)}</span>
  ),
};

// Shared field: Created At
export const createdAtField = {
  id: "createdAt",
  type: "datetime",
  header: "Created",
  enableSorting: false,
  render: ({ item }) => (
    <span style={{ color: "#666" }}>{formatDate(item.createdAt)}</span>
  ),
};

// Shared field: Assignees
export const assigneesField = {
  id: "assignees",
  type: "text",
  header: "Assignees",
  enableSorting: false,
  render: ({ item }) => (
    <span style={{ color: "#666" }}>
      {item.assignees && item.assignees.length > 0
        ? item.assignees.join(", ")
        : "—"}
    </span>
  ),
};

// Shared field: Milestone
export const milestoneField = {
  id: "milestone",
  type: "text",
  header: "Milestone",
  enableSorting: false,
  render: ({ item }) => (
    <span style={{ color: "#666" }}>{item.milestone || "—"}</span>
  ),
};
