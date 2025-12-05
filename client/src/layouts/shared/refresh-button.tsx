import { useState, useEffect } from "react";
import { Button, Spinner } from "@wordpress/components";
import { update as updateIcon } from "@wordpress/icons";
import { useQuery } from "@tanstack/react-query";
import { repoStatusQueryOptions } from "@/data/queries/repos";
import { useRefreshIssuesMutation } from "@/data/queries/issues";

interface RefreshButtonProps {
  owner: string;
  repo: string;
}

function RefreshButton({ owner, repo }: RefreshButtonProps) {
  const [refreshClickedAt, setRefreshClickedAt] = useState<number | null>(null);
  const [forceShowSpinner, setForceShowSpinner] = useState(false);

  // Use TanStack Query for repo status with automatic polling
  const { data: statusData } = useQuery(repoStatusQueryOptions(owner, repo));
  const refreshMutation = useRefreshIssuesMutation(owner, repo);

  const status = statusData?.status;
  const currentJob = statusData?.currentJob;

  const handleRefresh = async () => {
    setRefreshClickedAt(Date.now());
    setForceShowSpinner(true);
    await refreshMutation.mutateAsync();
  };

  // Force spinner to show for at least 5 seconds after refresh
  useEffect(() => {
    if (refreshClickedAt && forceShowSpinner) {
      const elapsed = Date.now() - refreshClickedAt;
      const remaining = Math.max(0, 5000 - elapsed);

      const timer = setTimeout(() => {
        setForceShowSpinner(false);
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [refreshClickedAt, forceShowSpinner, status]);

  // Get status message for tooltip
  const getStatusMessage = () => {
    if (status === "in_progress") {
      if (currentJob === "issue-fetch") return "Fetching issues...";
      if (currentJob === "sentiment") return "Analyzing sentiment...";
      return "Pending...";
    }
    if (status === "failed") return "Failed";
    return null;
  };

  const statusMessage = getStatusMessage();
  const isProcessing = status === "in_progress" || forceShowSpinner;

  return (
    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", height: "30px" }}>
      {isProcessing ? (
        <div
          style={{
            width: "32px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 0,
          }}
          title={statusMessage || undefined}
        >
          <span style={{ display: "block", marginTop: "-2px" }}>
            <Spinner />
          </span>
        </div>
      ) : (
        <Button
          icon={updateIcon}
          onClick={handleRefresh}
          label="Refresh data"
          size="small"
          variant="secondary"
          isBusy={refreshMutation.isPending}
        />
      )}
    </div>
  );
}

export default RefreshButton;
