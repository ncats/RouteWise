import React, { useContext, useState, useEffect } from "react";
import { MainContext } from "../contexts/MainContext";
import GraphPending from "../components/Visualizer/GraphPending";
import CytoscapeRendering from "../components/Visualizer/CytoscapeRendering";
import GraphAlerts from "../components/Visualizer/GraphAlerts";

const CytoscapeGraph = () => {
  const { cytoscapeGraph, layout, showReagents } = useContext(MainContext);

  const init = [
    {
      data: { id: "one", label: "Node 1" },
      position: { x: 0, y: 0 },
    },
    {
      data: { id: "two", label: "Node 2" },
      position: { x: 100, y: 0 },
    },
    {
      data: { source: "one", target: "two" },
    },
  ];

  const [elements, setElements] = useState(init);

  useEffect(() => {
    setElements(cytoscapeGraph);
  }, [cytoscapeGraph]);

  if (!cytoscapeGraph || cytoscapeGraph.length === 0) {
    return <GraphPending />;
  }

  return (
    <>
      <GraphAlerts />
      <CytoscapeRendering key="myRender" graph={elements} layout={layout} />
    </>
  );
};

export default CytoscapeGraph;
