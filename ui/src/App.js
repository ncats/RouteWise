import React, { useState, useEffect, useRef } from "react";

// components
import NetworkVisualizer from "./views/Cytoscape";
import { useNavigate } from "react-router-dom";

// context
import { MainContext } from "./contexts/MainContext";

// utils
import {
  defaultAppSettings,
  defaultGraphSettings,
  getSvgDimensions,
  graphLayouts,
  mapGraphDataToCytoscape,
} from "./helpers/commonHelpers";
import {
  getReactionRdkitSvgByRxsmiles,
  getMoleculeRdkitSvgBySmiles,
  checkApiStatus,
  compute_balance,
  hasAtomMapping,
  normalizeRoles,
} from "./helpers/apiHelpers";

const defaultApiStatus = { error: false };

function App() {
  const navigate = useNavigate();
  useEffect(() => {
    // Create a WebSocket connection
    const websocket = new WebSocket(`${process.env.API_URL}/ws`);

    websocket.onopen = () => {
      console.log("WebSocket connection established");
    };

    websocket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        console.error("Invalid JSON received:", event.data);
        return;
      }
      const messageType = data.type;
      if (messageType === "new-room") {
        // Navigate to the new URL with the room ID
        const newUrl = `?room_id=${data.room_id}`;
        navigate(newUrl);
      } else if (messageType === "new-graph") {
        // Update the graph object with the received data
        const finalData = data.data;
        setAicpGraph(finalData);
        // const mappedData = mapGraphDataToCytoscape(finalData);
        // updateCytoscapeGraph(mappedData);
      } else {
        console.error("Unknown message type:", messageType);
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    websocket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      websocket.close();
    };
  }, []);
  const [appSettings, setAppSettings] = useState(defaultAppSettings);
  const [graphSettings, setGraphSettings] = useState(defaultGraphSettings);
  const [networkGraph, setNetworkGraph] = useState(null);
  const [cytoscapeGraph, setCytoscapeGraph] = useState([]);
  const [aicpGraph, setAicpGraph] = useState(null);
  const [layout, setLayout] = useState(graphLayouts.HIERARCHICAL);
  const [subgraphIndex, setSubgraphIndex] = useState(0);
  const [nodeSvgs, setNodeSvgs] = useState({});
  const [reactionSources, setReactionSources] = useState({});
  const [zoomLevel, setZoomLevel] = useState();
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [previewEntity, setPreviewEntity] = useState(null);
  const [apiStatus, setApiStatus] = useState(defaultApiStatus);
  const [showReagents, setShowReagents] = useState(false);
  const [duplicateReagents, setDuplicateReagents] = useState(true);
  const [showKetcher, setShowKetcher] = useState(false);
  const [ketcherSmiles, setKetcherSmiles] = useState("");
  const [balanceData, setBalanceData] = useState({});
  const [normalizeRolesEnabled, setNormalizeRolesEnabled] = useState(false);
  const [highlightAtoms, setHighlightAtoms] = useState(true);
  const [showAtomIndices, setAtomIndices] = useState(false);
  const [usePredictedGraph, setUsePredictedGraph] = useState(false);
  const preserveSubgraphIndexRef = useRef(false);


  useEffect(() => {
    const checkStatus = async () => {
      try {
        const apiStatusRes = await checkApiStatus(appSettings.apiUrl);
        setApiStatus(!!apiStatusRes.error ? { error: true } : defaultApiStatus);
      } catch (error) {
        console.error("Error fetching API status:", error);
      }
    };

    checkStatus();
  }, []);

  const addNodeSvg = (nodeSvg) => {
    setNodeSvgs((prev) => ({
      ...prev,
      ...nodeSvg,
    }));
  };

  const addBalanceData = (reactionId, balance) => {
    setBalanceData((prev) => ({
      ...prev,
      [reactionId]: balance,
    }));
  };

  const updateCytoscapeGraph = async (mappedGraph) => {
    const promises = [];
    setSelectedEntity(null);
    setPreviewEntity(null);
    setReactionSources({});

    mappedGraph.forEach((graphElement) => {
      const molId = graphElement.data.id;
      const nodeType = graphElement.data.nodeType;
      if (nodeType === "substance" && graphElement.data.canonical_smiles) {
        const smiles = graphElement.data.canonical_smiles;
        const srole = graphElement.data.srole;

        // Change width and height dependent on srole
        var width = 100;
        var height = 100;
        if (srole === "tm") {
          width = 250;
          height = 250;
        }

        // Fetch the SVG for the molecule
        const substancePromise = getMoleculeRdkitSvgBySmiles(
          appSettings.apiUrl,
          smiles,
          width,
          height
        )
          .then((svg) => {
            if (svg) {
              const svgUrl = `data:image/svg+xml;base64,${svg}`;
              graphElement.data.svg = svgUrl;
              const dimensions = getSvgDimensions(svgUrl);
              graphElement.data.width = dimensions.width;
              graphElement.data.height = dimensions.height;
              addNodeSvg({ [molId]: svgUrl });

              if (appSettings.showAllSubstanceStructure) {
                // show all substances structures
                graphElement.data.type = "custom";
              } else {
                // show only TM reaction depictions
                graphElement.data.type =
                  graphElement.data.node_type !== "substance" &&
                  graphElement.data.is_valid === "false"
                    ? ""
                    : graphElement.data.node_type === "substance" &&
                      graphElement.data.srole !== "tm"
                    ? ""
                    : "custom";
              }
            } else {
              console.error("Failed to fetch substance SVG");
            }
          })
          .catch((error) => {
            console.error("Error fetching substance SVG:", error);
            if (graphElement.data.svg) {
              console.log("Falling back to existing substance SVG from JSON");
              const svgUrl = graphElement.data.svg;
              const dimensions = getSvgDimensions(svgUrl);
              graphElement.data.width = dimensions.width;
              graphElement.data.height = dimensions.height;
              addNodeSvg({ [molId]: svgUrl });
            }
          });
        promises.push(substancePromise);
      } else if (nodeType === "reaction" && graphElement.data.rxsmiles) {
        const { rxid, rxsmiles, isPredicted } = graphElement.data;
        let updatedRxsmiles = rxsmiles;

        // Check if RXSMILES has atom mapping
        if (hasAtomMapping(rxsmiles)) {
          const combinedPromise = normalizeRoles(
            appSettings.apiUrl,
            rxsmiles,
            normalizeRolesEnabled
          ).then((normalizedRxsmiles) => {
            updatedRxsmiles = normalizedRxsmiles;
            graphElement.data.rxsmiles = updatedRxsmiles; // Update RXSMILES in graph data

            return getReactionRdkitSvgByRxsmiles(
              appSettings.apiUrl,
              updatedRxsmiles,
              highlightAtoms,
              showAtomIndices
            ).then((svg) => {
              if (svg) {
                const svgUrl = `data:image/svg+xml;base64,${svg}`;
                graphElement.data.svg = svgUrl;
                graphElement.data.type = "custom";
                addNodeSvg({ [molId]: svgUrl });
                const dimensions = getSvgDimensions(svgUrl);
                graphElement.data.width = dimensions.width;
                graphElement.data.height = dimensions.height;
              } else {
                console.error("Failed to fetch reaction SVG");
              }
            });
          });
          promises.push(combinedPromise);
        } else {
          const combinedPromise = getReactionRdkitSvgByRxsmiles(
            appSettings.apiUrl,
            rxsmiles,
            highlightAtoms,
            showAtomIndices
          ).then((svg) => {
            if (svg) {
              const svgUrl = `data:image/svg+xml;base64,${svg}`;
              graphElement.data.svg = svgUrl;
              graphElement.data.type = "custom";
              addNodeSvg({ [molId]: svgUrl });
              const dimensions = getSvgDimensions(svgUrl);
              graphElement.data.width = dimensions.width;
              graphElement.data.height = dimensions.height;
            } else {
              console.error("Failed to fetch reaction SVG");
            }
            promises.push(combinedPromise);
          })
          .catch((error) => {
            console.error("Error fetching reaction SVG:", error);
            if (graphElement.data.svg) {
              console.log("Falling back to existing reaction SVG from JSON");
              const svgUrl = graphElement.data.svg;
              const dimensions = getSvgDimensions(svgUrl);
              graphElement.data.width = dimensions.width;
              graphElement.data.height = dimensions.height;
              addNodeSvg({ [molId]: svgUrl });
            }
          });
        }

        let balanceDataPromise;
        if (hasAtomMapping(rxsmiles)) {
          balanceDataPromise = compute_balance(
            appSettings.apiUrl,
            rxsmiles
          ).then((balanceData) => {
            if (balanceData) {
              graphElement.data.pbi = balanceData["pbi"];
              graphElement.data.rbi = balanceData["rbi"];
              graphElement.data.tbi = balanceData["tbi"];
              addBalanceData(rxid, balanceData);
            } else {
              console.error(
                `Failed to fetch balance data for reaction ${rxid}`
              );
            }
            promises.push(balanceDataPromise);
          });
        }
      }
    });

    Promise.all(promises)
      .then(() => {
        setCytoscapeGraph(mappedGraph);
      })
      .catch((error) => {
        console.error(
          "Error fetching one or more SVGs or balance data:",
          error
        );
      });
  };

  useEffect(() => {
    if (
      aicpGraph &&
      aicpGraph.routes &&
      aicpGraph.routes.length > 0 &&
      subgraphIndex < aicpGraph.routes.length
    ) {
      let data = aicpGraph;
      const mappedData = mapGraphDataToCytoscape(data, subgraphIndex);
      updateCytoscapeGraph(mappedData);
    }
  }, [subgraphIndex, aicpGraph]);

  return (
    <MainContext.Provider
      value={{
        appSettings,
        setAppSettings,
        graphSettings,
        setGraphSettings,
        networkGraph,
        setNetworkGraph,
        cytoscapeGraph,
        setCytoscapeGraph,
        aicpGraph,
        setAicpGraph,
        layout,
        setLayout,
        nodeSvgs,
        setNodeSvgs,
        addNodeSvg,
        updateCytoscapeGraph,
        zoomLevel,
        setZoomLevel,
        selectedEntity,
        setSelectedEntity,
        previewEntity,
        setPreviewEntity,
        apiStatus,
        showReagents,
        setShowReagents,
        showKetcher,
        setShowKetcher,
        ketcherSmiles,
        setKetcherSmiles,
        duplicateReagents,
        setDuplicateReagents,
        subgraphIndex,
        setSubgraphIndex,
        reactionSources,
        setReactionSources,
        balanceData,
        setBalanceData,
        normalizeRolesEnabled,
        setNormalizeRolesEnabled,
        highlightAtoms,
        setHighlightAtoms,
        showAtomIndices,
        setAtomIndices,
        usePredictedGraph,
        setUsePredictedGraph,
        preserveSubgraphIndexRef,
      }}
    >
      <NetworkVisualizer />
    </MainContext.Provider>
  );
}

export default App;
