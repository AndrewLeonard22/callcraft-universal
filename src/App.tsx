import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CreateClient from "./pages/CreateClient";
import EditClient from "./pages/EditClient";
import ClientScripts from "./pages/ClientScripts";
import CreateScript from "./pages/CreateScript";
import EditScript from "./pages/EditScript";
import ScriptViewer from "./pages/ScriptViewer";
import Templates from "./pages/Templates";
import ServiceTypes from "./pages/ServiceTypes";
import TeamManagement from "./pages/TeamManagement";
import ImageGenerator from "./pages/ImageGenerator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
          <Route path="/image-generator" element={<ProtectedRoute><ImageGenerator /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
