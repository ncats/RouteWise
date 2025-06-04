import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import App from "./App";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />
  }
]);

reportWebVitals();

class ChildReactElement extends HTMLElement {
  connectedCallback() {
    // Create a new div element to serve as the React root.
    const reactRoot = document.createElement("div");

    // Append the new div to the custom element.
    this.appendChild(reactRoot);

    // Use the newly created div as the container for the React root.
    const root = ReactDOM.createRoot(reactRoot);

    root.render(
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>
    );
  }
}

if (!customElements.get("child-react-element")) {
  customElements.define("child-react-element", ChildReactElement);
}

// Set page tab title
document.title = "RouteWise";
