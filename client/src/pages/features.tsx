import IssuesPage from "./issues-page";

function Features() {
  return (
    <IssuesPage
      title="Feature Requests"
      description="Feature requests prioritized by demand, engagement, and feasibility."
      type="features"
      scoreLabel="Priority Score"
      defaultThresholds={{ critical: 70, high: 50, medium: 30 }}
      extraFilters={{ issueType: "features" }}
    />
  );
}

export default Features;
