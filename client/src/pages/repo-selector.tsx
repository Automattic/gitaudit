import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  SearchControl,
  Button,
  Notice,
} from "@wordpress/components";
import { useQuery } from "@tanstack/react-query";
import { reposQueryOptions } from "@/data/queries/repos";
import { Repository } from "@/data/api/repos/types";
import { getErrorMessage } from "@/utils/error-handling";
import AddRepositoryModal from "../components/add-repository-modal";
import Page from "../components/page";
import Loading from "../components/loading";

function RepoSelector() {
  const navigate = useNavigate();

  const [filteredRepos, setFilteredRepos] = useState<Repository[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch repos using TanStack Query
  const { data, isLoading, error, refetch } = useQuery(reposQueryOptions());
  const repos = data?.repos ?? [];

  // Filter repos based on search term
  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = repos.filter((repo) =>
        repo.fullName.toLowerCase().includes(term)
      );
      setFilteredRepos(filtered);
    } else {
      setFilteredRepos(repos);
    }
  }, [searchTerm, repos]);

  function handleRepoAdded() {
    refetch(); // Refresh list after adding
    setIsModalOpen(false);
  }

  function handleSelectRepo(repo: Repository) {
    // Navigate to dashboard for all repos (dashboard handles GitHub vs non-GitHub)
    navigate(`/repos/${repo.owner}/${repo.name}`);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <Page
        title="My Repositories"
        description="Choose a repository to audit its issues"
        actions={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            Add Repository
          </Button>
        }
      >
        <SearchControl
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search your repositories..."
          style={{ maxWidth: "400px", marginBottom: "1rem" }}
        />

        {error && (
          <Notice
            status="error"
            isDismissible={false}
          >
            {getErrorMessage(error, "Failed to load repositories")}
          </Notice>
        )}

        {isLoading ? (
          <Loading />
        ) : repos.length === 0 && !searchTerm ? (
          <Card>
            <CardBody>
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <h3 style={{ marginBottom: "1rem" }}>No Repositories Yet</h3>
                <p style={{ marginBottom: "2rem", color: "#666" }}>
                  Add a repository to get started.
                </p>
                <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                  Add Your First Repository
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : filteredRepos.length === 0 ? (
          <Card>
            <CardBody>
              <p
                style={{ textAlign: "center", color: "#666", margin: "2rem 0" }}
              >
                No repositories match your search
              </p>
            </CardBody>
          </Card>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
              gap: "1rem",
            }}
          >
            {filteredRepos.map((repo) => (
              <Card
                key={repo.id}
                style={{
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onClick={() => handleSelectRepo(repo)}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <CardBody>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: "var(--wp-admin-theme-color)",
                        }}
                      >
                        {repo.fullName}
                      </h3>
                      {repo.isPrivate && (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            backgroundColor: "#f0f0f0",
                            borderRadius: "3px",
                          }}
                        >
                          Private
                        </span>
                      )}
                    </div>

                    {repo.description && (
                      <p
                        style={{
                          margin: "0.5rem 0",
                          fontSize: "0.875rem",
                          color: "#666",
                          lineHeight: 1.4,
                        }}
                      >
                        {repo.description.length > 100
                          ? repo.description.substring(0, 100) + "..."
                          : repo.description}
                      </p>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: "1rem",
                        alignItems: "center",
                        marginTop: "0.75rem",
                        fontSize: "0.75rem",
                        color: "#666",
                      }}
                    >
                      {repo.language && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              backgroundColor: repo.languageColor || "#ccc",
                            }}
                          />
                          {repo.language}
                        </div>
                      )}
                      {repo.isGithub && <div>⭐ {repo.stars}</div>}
                      {repo.updatedAt && <div>Updated {formatDate(repo.updatedAt)}</div>}
                      {!repo.isGithub && (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            backgroundColor: "#e8f4fc",
                            borderRadius: "3px",
                            color: "#0073aa",
                          }}
                        >
                          Custom
                        </span>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {/* Add Repository Modal */}
        {isModalOpen && (
          <AddRepositoryModal
            onClose={() => setIsModalOpen(false)}
            onRepoAdded={handleRepoAdded}
          />
        )}
      </Page>
  );
}

export default RepoSelector;
