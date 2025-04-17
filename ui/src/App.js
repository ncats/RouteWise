import React, { useState, useEffect } from "react";

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
  validateRxnSmiles,
} from "./helpers/apiHelpers";

const defaultApiStatus = { error: false };

function App() {
  const navigate = useNavigate();

  useEffect(() => {
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
        if (data.room_id) {
            // Navigate to the new URL with the room ID
            const newUrl = `/room/${data.room_id}`;
            navigate(newUrl);
        } else if (data.data) {
            // Update the graph object with the received data
            const finalData = data.data;
            setAicpGraph(finalData);
            const mappedData = mapGraphDataToCytoscape(finalData);
            updateCytoscapeGraph(mappedData);
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
  }, [navigate]);
  const [appSettings, setAppSettings] = useState(defaultAppSettings);
  const [graphSettings, setGraphSettings] = useState(defaultGraphSettings);
  const [networkGraph, setNetworkGraph] = useState(null);
  const [cytoscapeGraph, setCytoscapeGraph] = useState([]);
  const [aicpGraph, setAicpGraph] = useState(null);
  const [layout, setLayout] = useState(graphLayouts.HIERARCHICAL);
  const [nodeSvgs, setNodeSvgs] = useState({});
  const [reactionSources, setReactionSources] = useState({});
  const [zoomLevel, setZoomLevel] = useState();
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [previewEntity, setPreviewEntity] = useState(null);
  const [apiStatus, setApiStatus] = useState(defaultApiStatus);
  const [showReagents, setShowReagents] = useState(false);
  const [duplicateReagents, setDuplicateReagents] = useState(true);
  const [highlightAtoms, setHighlightAtoms] = useState(true);
  const [showKetcher, setShowKetcher] = useState(false);
  const [ketcherSmiles, setKetcherSmiles] = useState("");
  const [balanceData, setBalanceData] = useState({});
  const [isValidData, setIsValidData] = useState({});

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

  const addIsValidData = (reactionId, isValid) => {
    setIsValidData((prev) => ({
      ...prev,
      [reactionId]: isValid,
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
      if (graphElement.data.svg) {
        const svgUrl = graphElement.data.svg;
        const dimensions = getSvgDimensions(svgUrl);
        graphElement.data.width = dimensions.width;
        graphElement.data.height = dimensions.height;
        addNodeSvg({ [molId]: svgUrl });
      } else {
        if (nodeType === "substance" && graphElement.data.canonical_smiles) {
          const smiles = graphElement.data.canonical_smiles;
          const substancePromise = getMoleculeRdkitSvgBySmiles(
            appSettings.apiUrl,
            smiles
          ).then((svg) => {
            if (svg) {
              const svgUrl = `data:image/svg+xml;base64,${svg}`;
              graphElement.data.svg = svgUrl;
              const dimensions = getSvgDimensions(svgUrl);
              graphElement.data.width = dimensions.width;
              graphElement.data.height = dimensions.height;
              addNodeSvg({ [molId]: svgUrl });
            } else {
              console.error("Failed to fetch substance SVG");
            }
          });
          promises.push(substancePromise);
        } else if (nodeType === "reaction" && graphElement.data.rxsmiles) {
          const { rxid, rxsmiles, isPredicted } = graphElement.data;
  
          let updatedRxsmiles = rxsmiles;

          // Check if RXSMILES has atom mapping
          if (hasAtomMapping(rxsmiles)) {
            promises.push(
              normalizeRoles(appSettings.apiUrl, rxsmiles).then((normalizedRxsmiles) => {
                updatedRxsmiles = normalizedRxsmiles;
                graphElement.data.rxsmiles = updatedRxsmiles; // Update RXSMILES in graph data
              })
            );
          }

          const reactionSvgPromise = getReactionRdkitSvgByRxsmiles(
            appSettings.apiUrl,
            updatedRxsmiles,
            highlightAtoms
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

          let balanceDataPromise;
          if (hasAtomMapping(rxsmiles)) {
            balanceDataPromise = compute_balance(appSettings.apiUrl, rxsmiles).then((balanceData) => {
              if (balanceData) {
                graphElement.data.pbi = balanceData["pbi"];
                graphElement.data.rbi = balanceData["rbi"];
                graphElement.data.tbi = balanceData["tbi"];
                addBalanceData(rxid, balanceData);
              } else {
                console.error(`Failed to fetch balance data for reaction ${rxid}`);
              }
            });
          }
  
          const isValidPromise = validateRxnSmiles(appSettings.apiUrl, rxsmiles).then((isValid) => {
            graphElement.data.is_valid = String(isValid);
            graphElement.data.type = isValid === false ? "" : "custom";
            addIsValidData(rxid, isValid);
          });

          promises.push(reactionSvgPromise, balanceDataPromise, isValidPromise);
        }
      }
    });

    Promise.all(promises)
      .then(() => {
      })
      .catch((error) => {
        console.error("Error fetching one or more SVGs or balance data:", error);
      })
      .finally(() => {
        setCytoscapeGraph(mappedGraph);
      });
  };

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
        highlightAtoms,
        setHighlightAtoms,
        reactionSources,
        setReactionSources,
        balanceData,
        setIsValidData,
        isValidData,
        setBalanceData,
      }}
    >
      <NetworkVisualizer />
    </MainContext.Provider>
  );
}

export default App;
