import { Button, __experimentalHStack as HStack } from "@wordpress/components";
import { useAuth } from "../../context/auth-context";

function UserMenu() {
  const { user, logout } = useAuth();

  return (
    <div
      style={{
        padding: "1rem 1.5rem",
      }}
    >
      <HStack justify="space-between" alignment="center">
        <div
          style={{
            fontSize: "0.875rem",
            color: "#666",
            fontWeight: 500,
          }}
        >
          @{user?.username}
        </div>
        <Button
          variant="secondary"
          onClick={logout}
          size="compact"
        >
          Logout
        </Button>
      </HStack>
    </div>
  );
}

export default UserMenu;
