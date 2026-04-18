interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Auth temporarily disabled — pass through all children
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  return <>{children}</>;
}
