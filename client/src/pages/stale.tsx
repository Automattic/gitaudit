import IssuesPage from "./issues-page";

function Stale() {
  return (
    <IssuesPage
      title="Stale Issues"
      description="Issues scored by inactivity and age."
      type="stale"
      scoreLabel="Staleness"
      defaultThresholds={{ critical: 60, high: 40, medium: 20 }}
    />
  );
}

export default Stale;
