import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  SearchControl,
  Spinner,
  Button,
  Notice,
} from "@wordpress/components";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { reposQueryOptions } from "@/data/queries/repos";
import { Repository } from "@/data/api/repos/types";
import AddRepositoryModal from "../components/AddRepositoryModal";
import Page from "../components/Page";

function RepoSelector() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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
    navigate(`/repos/${repo.owner}/${repo.name}/bugs`);
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
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f0f0" }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: "white",
          borderBottom: "1px solid #ddd",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>GitAudit</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: "#666" }}>@{user?.username}</span>
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Content */}
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
            style={{ marginBottom: "1rem" }}
          >
            {error instanceof Error
              ? error.message
              : "Failed to load repositories"}
          </Notice>
        )}

        {isLoading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <Spinner />
            <p style={{ marginTop: "1rem", color: "#666" }}>
              Loading repositories...
            </p>
          </div>
        ) : repos.length === 0 && !searchTerm ? (
          <Card>
            <CardBody>
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <h3 style={{ marginBottom: "1rem" }}>No Repositories Yet</h3>
                <p style={{ marginBottom: "2rem", color: "#666" }}>
                  Add a repository from GitHub to start auditing its issues.
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
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
                          color: "#0073aa",
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
                      <div>⭐ {repo.stars}</div>
                      <div>Updated {formatDate(repo.updatedAt)}</div>
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
    </div>
  );
}

export default RepoSelector;
