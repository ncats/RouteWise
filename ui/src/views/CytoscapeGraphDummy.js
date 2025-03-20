import React from "react";
import GraphPending from "../components/Visualizer/GraphPending";
import CytoscapeRendering from "../components/Visualizer/CytoscapeRendering";

import graph from './cy';
import { mapGraphDataToCytoscape } from "../helpers/commonHelpers";

const CytoscapeGraph = () => {
  const cytoscapeGraph = mapGraphDataToCytoscape(graph);

  if (!cytoscapeGraph) {
    return <GraphPending />;
  }

  return <CytoscapeRendering graph={cytoscapeGraph} />;
};

export default CytoscapeGraph;
