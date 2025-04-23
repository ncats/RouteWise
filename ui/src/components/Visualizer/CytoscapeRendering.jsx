import React, { useEffect, useRef, useContext, useState } from "react";
import { message } from "antd";
import cytoscape from "cytoscape";
import cola from "cytoscape-cola";
import dagre from "cytoscape-dagre";
import {
  cyOptions,
  graphLayouts,
  isDAG,
  mapStylesToCytoscape,
  removeAllReagents,
  cyStyles,
  duplicateGraphSubstances,
} from "../../helpers/commonHelpers";
import { MainContext } from "../../contexts/MainContext";

cytoscape.use(cola);
cytoscape.use(dagre);

const headerHeight = 45 + 134; // Height of the fixed header in pixels (adjust as needed)

const CytoscapeRendering = ({ graph, layout }) => {
  const cyRef = useRef(null);
  const {
    appSettings,
    setAppSettings,
    zoomLevel,
    setSelectedEntity,
    setPreviewEntity,
    showReagents,
    duplicateReagents,
  } = useContext(MainContext);

  const [popover, setPopover] = useState({
    visible: false,
    content: "",
    x: 0,
    y: 0,
    nodeId: null,
  });

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    // update cytoscape styles based on app settings
    const style = mapStylesToCytoscape(cyStyles, appSettings);

    cyRef.current = cytoscape({
      container: document.getElementById("cy"),
      elements: graph,
      style,
    });

    // Rework event listeners
    cyRef.current.on("mouseover", "node", function (event) {
      setPreviewEntity([event.target.id(), "node"]);
    });

    cyRef.current.on("mouseout", "node", function (event) {
      setPreviewEntity(null);
    });

    cyRef.current.on("click", "node", function (event) {
      setSelectedEntity([event.target.id(), "node"]);
    });

    cyRef.current.on("click", "edge", function (event) {
      setSelectedEntity([event.target.id(), "edge"]);
    });

    // Event listener for selecting a node
    cyRef.current.on("select", "node, edge", (event) => {
      const element = event.target;
      element.addClass("highlighted"); // Add the highlight class
    });

    // Event listener for unselecting a node
    cyRef.current.on("unselect", "node, edge", (event) => {
      const element = event.target;
      element.removeClass("highlighted"); // Remove the highlight class
    });

    // Cleanup function to unbind events when component unmounts
    return () => {
      if (cyRef.current) {
        cyRef.current.removeListener("mouseover");
        cyRef.current.removeListener("mouseout");
        cyRef.current.removeListener("click");
        cyRef.current.removeListener("select");
        cyRef.current.removeListener("unselect");
      }
    };
  }, [
    appSettings.showStructures,
    appSettings.edgeCurveStyle,
    appSettings.productEdgeThickness,
    graph,
    showReagents,
  ]);
  

  useEffect(() => {
    try {
      if (cyRef.current) {
        cyRef.current.elements().remove();

        let transformedGraph = graph;
        // Remove reagents
        if (!showReagents) {
          transformedGraph = removeAllReagents(transformedGraph);
        }

        // Duplicate starting substances
        if (duplicateReagents) {
          transformedGraph = duplicateGraphSubstances(transformedGraph);
        }
        cyRef.current.add(transformedGraph);

        const notDAGError =
          graphLayouts.HIERARCHICAL === layout && !isDAG(cyRef.current)
            ? "The graph is not a DAG, switching to force-directed layout is recommended"
            : null;

        setAppSettings({
          ...appSettings,
          notDAGError,
        });

        cyRef.current.layout({ name: layout, ...cyOptions }).run(); // we have to apply layout right before the run, otherwise it won't work (check `isHeadless` issue)
        cyRef.current.resize();
      }
    } catch (error) {
      messageApi.open({
        type: "error",
        content: error.message || error.name || "Unknown error",
        duration: 5,
      });

      console.error(error);
    }
  }, [
    graph, 
    layout, 
    showReagents, 
    duplicateReagents,
    appSettings.showStructures,
    appSettings.edgeCurveStyle,
    appSettings.productEdgeThickness
  ]);

  useEffect(() => {
    const cy = cyRef.current;
    const viewportHeight = window.innerHeight - headerHeight;
    const cyContainer = cy.container();
    cyContainer.style.height = `${viewportHeight}px`; // Set height of graph container

    // Center graph vertically within the available height
    const graphHeight = cyContainer.clientHeight;
    const yOffset = (viewportHeight - graphHeight) / 2;
    cy.panBy({ x: 0, y: yOffset }); // Pan the graph vertically

    // Optionally, trigger a redraw of the graph after adjustments
    cy.resize();
    cy.fit();
  }, [headerHeight, zoomLevel]);

  return (
    <>
      {contextHolder}
      <div id="cy" style={{ width: "100%", height: "100vh" }} />
    </>
  );
};

export default CytoscapeRendering;
