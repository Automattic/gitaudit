import { useNavigate } from "react-router-dom";

function Logo() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        padding: "1.5rem 1.5rem 1.25rem",
        cursor: "pointer",
      }}
      onClick={() => navigate("/")}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "1.5rem",
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: "var(--wp-admin-theme-color)",
          letterSpacing: "-0.5px",
        }}
      >
        CodeVitals
      </h1>
    </div>
  );
}

export default Logo;
