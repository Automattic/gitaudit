// The MCP server runs on Spacefast, not on the Railway deployment, so builds for
// Railway leave out everything that points to it.
export const isMcpEnabled = import.meta.env.VITE_MCP_ENABLED === 'true';

export const getMcpUrl = () => `${window.location.origin}/mcp`;
