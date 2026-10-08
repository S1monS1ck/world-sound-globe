import React from "react";
import { createRoot } from "react-dom/client";
import { WorldExperience } from "@/components/world-experience";
import "@/app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("World / Sound root element was not found.");
}

createRoot(root).render(
  <React.StrictMode>
    <WorldExperience />
  </React.StrictMode>,
);
