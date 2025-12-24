import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './data/queries/query-client';
import { AuthProvider } from './context/auth-context';
import { routes } from './routes';

// Root component that provides auth context inside router
function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

// Create router with data loader support
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: routes,
  },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />

      {/* Dev tools - only in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
