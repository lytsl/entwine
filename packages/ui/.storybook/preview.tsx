import { Toaster } from "@entwine/ui/components/ui/toast";
import type { Preview } from "@storybook/react-vite";
import "@fontsource-variable/inter/index.css";
import "../src/styles/globals.css";

// Dark by default, as the app's `index.html` is; the toolbar switches it so a component can be checked in both.
const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "error" },
  },
  globalTypes: {
    theme: {
      description: "The `dark` class on <html>",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "dark" },
  decorators: [
    (Story, context) => {
      document.documentElement.classList.toggle("dark", context.globals.theme !== "light");
      return (
        <div className="bg-background text-foreground min-h-svh p-8">
          <Story />
          <Toaster />
        </div>
      );
    },
  ],
};

export default preview;
