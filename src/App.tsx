import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import ProtectedRoute from "./components/ProtectedRoute";
import { ChunkLoadErrorBoundary } from "./components/ChunkLoadErrorBoundary";
import Auth from "./pages/Auth";

// Lazy load pages for better initial bundle size
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateClient = lazy(() => import("./pages/CreateClient"));
const EditClient = lazy(() => import("./pages/EditClient"));
const ClientScripts = lazy(() => import("./pages/ClientScripts"));
const CreateScript = lazy(() => import("./pages/CreateScript"));
const EditScript = lazy(() => import("./pages/EditScript"));
const ScriptViewer = lazy(() => import("./pages/ScriptViewer"));
const Templates = lazy(() => import("./pages/Templates"));
const ServiceTypes = lazy(() => import("./pages/ServiceTypes"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const ImageGenerator = lazy(() => import("./pages/ImageGenerator"));
const Training = lazy(() => import("./pages/Training"));
const TrainingManagement = lazy(() => import("./pages/TrainingManagement"));
const ServiceDetailFields = lazy(() => import("./pages/ServiceDetailFields"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized QueryClient configuration with caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <ChunkLoadErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><CreateClient /></ProtectedRoute>} />
            <Route path="/edit/:clientId" element={<ProtectedRoute><EditClient /></ProtectedRoute>} />
            <Route path="/client/:clientId" element={<ProtectedRoute><ClientScripts /></ProtectedRoute>} />
            <Route path="/create-script/:clientId" element={<ProtectedRoute><CreateScript /></ProtectedRoute>} />
            <Route path="/edit-script/:scriptId" element={<ProtectedRoute><EditScript /></ProtectedRoute>} />
            <Route path="/script/:scriptId" element={<ProtectedRoute><ScriptViewer /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="/service-types" element={<ProtectedRoute><ServiceTypes /></ProtectedRoute>} />
            <Route path="/service-detail-fields" element={<ProtectedRoute><ServiceDetailFields /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
            <Route path="/image-generator" element={<ProtectedRoute><ImageGenerator /></ProtectedRoute>} />
            <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
            <Route path="/training-management" element={<ProtectedRoute><TrainingManagement /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ChunkLoadErrorBoundary>
);

export default App;
