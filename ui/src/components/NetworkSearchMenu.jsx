import React, { useState, useContext, useEffect } from "react";
import UploadJson from "./GraphRetrieval/UploadJson";
import ExampleGraphs from "./GraphRetrieval/ExampleGraphs";
import { MainContext } from "../contexts/MainContext";
import { Select } from "antd";
import { mapGraphDataToCytoscape } from "../helpers/commonHelpers";

const NetworkSearchMenu = () => {
  const {
    setSelectedEntity,
    setPreviewEntity,
    setReactionSources,
    setCytoscapeGraph,
    setAicpGraph,
    aicpGraph,
    updateCytoscapeGraph,
    setUsePredictedGraph,
    preserveSubgraphIndexRef,
    subgraphIndex,
    setSubgraphIndex,
    resetReagentOriginalGraph
  } = useContext(MainContext);
  const [selectedRetrievalOption, setSelectedRetrievalOption] = useState(
    "json"
  );
  const [evidenceSynthGraph, setEvidenceSynthGraph] = useState(null);
  const [predictedSynthGraph, setPredictedSynthGraph] = useState(null);
  const [routeOptions, setRouteOptions] = useState(null);
  const [dropdownDisabled, setDropdownDisabled] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);

  const handleRetrievalOptionChange = (option) => {
    setSelectedRetrievalOption(option);
    setSubgraphIndex(0);
    setSelectedEntity(null);
    setPreviewEntity(null);
    setReactionSources({});
    setCytoscapeGraph([]);
    setAicpGraph(null);
  };

  // When aicpGraph changes, update the synth graph states
  useEffect(() => {
    if (aicpGraph) {
      setEvidenceSynthGraph(
        aicpGraph.synth_graph || aicpGraph.evidence_synth_graph || null
      );
      setPredictedSynthGraph(aicpGraph.predictive_synth_graph || null);
      setRouteOptions(aicpGraph.routes || null);
    }
  }, [aicpGraph]);

  // Update dropdownDisabled based on the updated state values
  useEffect(() => {
    const shouldDisable =
      evidenceSynthGraph == null &&
      predictedSynthGraph == null &&
      routeOptions == null;
    setDropdownDisabled(shouldDisable);

    if (!shouldDisable) {
      if (preserveSubgraphIndexRef.current) {
        preserveSubgraphIndexRef.current = false;
        return;
      }

      if (routeOptions) {
        onRouteChange("Route 0");
      } else if (evidenceSynthGraph) {
        onRouteChange("SynthGraph");
      } else if (predictedSynthGraph) {
        onRouteChange("PredictiveGraph");
      }
    }
  }, [evidenceSynthGraph, predictedSynthGraph, routeOptions]);

  // On route change
  const onRouteChange = (value) => {
    setSelectedOption(value);
    if (value == "SynthGraph") {
      setSubgraphIndex(-1);
      preserveSubgraphIndexRef.current = true;
      resetReagentOriginalGraph.current = true;
      setUsePredictedGraph(false);
    } else if (value == "PredictiveGraph") {
      setSubgraphIndex(-2);
      preserveSubgraphIndexRef.current = true;
      resetReagentOriginalGraph.current = true;
      setUsePredictedGraph(true);
    } else {
      const index = parseInt(value.split(" ")[1]);
      setSubgraphIndex(index);
      preserveSubgraphIndexRef.current = true;
      resetReagentOriginalGraph.current = true;
      if (aicpGraph.routes[index].predicted) {
        setUsePredictedGraph(true);
      } else {
        setUsePredictedGraph(false);
      }
    }
  };

  return (
    <div id="NetworkSearchMenu" className="Network-search-menu">
      <div
        className="Graph-selector-container"
        style={{ display: "flex", gap: "10px" }}
      >
        <Select
          defaultValue="json"
          onChange={handleRetrievalOptionChange}
          data-testid="GraphRetrievalDropdown"
        >
          <Select.Option value="json" >Upload JSON</Select.Option>
          <Select.Option value="cytoscape-json">
            Upload Cytoscape JSON
          </Select.Option>
          <Select.Option value="examples">Example Graphs</Select.Option>
        </Select>
        <Select
          placeholder="Select Synthesis Route"
          disabled={dropdownDisabled}
          value={selectedOption}
          onChange={(value) => onRouteChange(value)}
          data-testid="SynthesisRouteDropdown"
        >
          {aicpGraph && evidenceSynthGraph && (
            <Select.Option value="SynthGraph">
              Evidence Synth Graph
            </Select.Option>
          )}
          {aicpGraph && predictedSynthGraph && (
            <Select.Option value="PredictiveGraph">
              Predicted Synth Graph
            </Select.Option>
          )}
          {aicpGraph && aicpGraph.routes && aicpGraph.routes.length > 0 ? (
            Array.from({ length: aicpGraph.routes.length }, (_, i) => (
              <Select.Option key={i} value={`Route ${i}`}>
                {aicpGraph.routes[i].predicted
                  ? `Predicted ${i + 1}`
                  : `Evidence ${i + 1}`}
              </Select.Option>
            ))
          ) : (
            <Select.Option value="no-routes">No Routes Available</Select.Option>
          )}
        </Select>
      </div>
      <div id="GraphFormContainer" className="Graph-form-container">
        {selectedRetrievalOption === "json" && (
          <UploadJson convertToNormalFormat={false} />
        )}
        {selectedRetrievalOption === "cytoscape-json" && (
          <UploadJson convertToNormalFormat={true} />
        )}
        {selectedRetrievalOption === "examples" && <ExampleGraphs />}
      </div>
    </div>
  );
};

export default NetworkSearchMenu;
