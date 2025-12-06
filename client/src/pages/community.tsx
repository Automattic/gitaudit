import IssuesPage from "./issues-page";

function Community() {
  return (
    <IssuesPage
      title="Community Health"
      description="Issues scored by community engagement and responsiveness."
      type="community"
      scoreLabel="Score"
      defaultThresholds={{ critical: 60, high: 40, medium: 20 }}
    />
  );
}

export default Community;
