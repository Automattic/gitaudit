import { Button } from "@wordpress/components";

interface NoIssuesPlaceholderProps {
  description: string;
  onFetchClick: () => void;
}

export function NoIssuesPlaceholder({
  description,
  onFetchClick,
}: NoIssuesPlaceholderProps) {
  return (
    <div style={{ textAlign: "center", padding: "2rem" }}>
      <h3 style={{ marginBottom: "1rem" }}>No Issues Yet</h3>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Fetch issues from GitHub to start analyzing {description}. This may
        take a few minutes depending on the repository size.
      </p>
      <Button variant="primary" onClick={onFetchClick}>
        Fetch Issues from GitHub
      </Button>
    </div>
  );
}
