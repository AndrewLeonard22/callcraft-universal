import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CreateClient from "./pages/CreateClient";
import EditClient from "./pages/EditClient";
import ClientScripts from "./pages/ClientScripts";
import CreateScript from "./pages/CreateScript";
import ScriptViewer from "./pages/ScriptViewer";
import Templates from "./pages/Templates";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreateClient />} />
          <Route path="/edit/:clientId" element={<EditClient />} />
          <Route path="/client/:clientId" element={<ClientScripts />} />
          <Route path="/create-script/:clientId" element={<CreateScript />} />
          <Route path="/script/:scriptId" element={<ScriptViewer />} />
          <Route path="/templates" element={<Templates />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
