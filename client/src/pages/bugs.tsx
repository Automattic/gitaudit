import IssuesPage from "./issues-page";

function Bugs() {
  return (
    <IssuesPage
      title="Important Bugs"
      description="Bugs scored by severity, activity, and sentiment."
      type="bugs"
      scoreLabel="Score"
      defaultThresholds={{ critical: 120, high: 80, medium: 50 }}
      extraFilters={{ issueType: "bugs" }}
    />
  );
}

export default Bugs;
