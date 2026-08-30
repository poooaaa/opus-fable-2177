import { createFileRoute } from "@tanstack/react-router";
import App from "@/aichat/App";
import "@/aichat/index.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chat Replica" },
      {
        name: "description",
        content: "A 100% visual replica of the dark mode mobile chat interface.",
      },
      { property: "og:title", content: "Chat Replica" },
      {
        property: "og:description",
        content: "A 100% visual replica of the dark mode mobile chat interface.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <App />;
}
