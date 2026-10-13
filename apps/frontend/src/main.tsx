import "@fontsource-variable/inter/index.css";
import "./globals.css";
import { Toaster } from "@entwine/ui/components/ui/toast";
import { TooltipProvider } from "@entwine/ui/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { followTheme } from "./preferences/theme";
import { queryClient, router } from "./router";

followTheme();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delay={400}>
      <RouterProvider router={router} />
    </TooltipProvider>
    <Toaster />
  </QueryClientProvider>,
);
