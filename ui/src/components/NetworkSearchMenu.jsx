import React, { useState, useContext, useEffect } from "react";
import UploadJson from "./GraphRetrieval/UploadJson";
import WebSocketConnection from "./GraphRetrieval/WebSocketConnection";
import ExampleGraphs from "./GraphRetrieval/ExampleGraphs";
import { MainContext } from "../contexts/MainContext";
import { Select } from "antd";
import { mapGraphDataToCytoscape } from "../helpers/commonHelpers";

const NetworkSearchMenu = () => {
  const { setSelectedEntity, setPreviewEntity, setReactionSources, setCytoscapeGraph, setAicpGraph, aicpGraph, updateCytoscapeGraph } = useContext(MainContext);
  const [selectedRetrievalOption, setSelectedRetrievalOption] = useState("synthesis-route-search");
  const [subgraphIndex, setSubgraphIndex] = useState(0);

  const handleRetrievalOptionChange = (option) => {
    setSelectedRetrievalOption(option);
    setSubgraphIndex(0);
    setSelectedEntity(null);
    setPreviewEntity(null);
    setReactionSources({});
    setCytoscapeGraph([]);
    setAicpGraph(null);
  };

  useEffect(() => {
    if (aicpGraph && aicpGraph.routes.subgraphs && aicpGraph.routes.subgraphs.length > 0 && subgraphIndex < aicpGraph.routes.subgraphs.length) {
      let data = aicpGraph;
      const mappedData = mapGraphDataToCytoscape(data, subgraphIndex);
      updateCytoscapeGraph(mappedData);
    }
  }, [subgraphIndex, aicpGraph]);

  return (
    <div id="NetworkSearchMenu" className="Network-search-menu">
      <div className="Graph-selector-container" style={{ display: 'flex', gap: '10px' }}>
        <Select
          defaultValue="Upload-JSON"
          onChange={handleRetrievalOptionChange}
        >
          <Select.Option value="json">Upload JSON</Select.Option>
          <Select.Option value="cytoscape-json">Upload Cytoscape JSON</Select.Option>
          <Select.Option value="examples">Example Graphs</Select.Option>
        </Select>
        <Select
          defaultValue="Route 0"
          onChange={(value) => setSubgraphIndex(parseInt(value.replace('Route ', ''), 10))}
        >
          {aicpGraph && aicpGraph.routes.subgraphs && aicpGraph.routes.subgraphs.length > 0 ? (
            Array.from({ length: aicpGraph.routes.subgraphs.length }, (_, i) => (
              <Select.Option key={i} value={`Route ${i}`}>
                {aicpGraph.routes.predicted ? `Predicted ${i + 1}` : `Evidence ${i + 1}`}
              </Select.Option>
            ))
          ) : (
            <Select.Option value="no-routes">No Routes Available</Select.Option>
          )}
        </Select>
      </div>
      <div className="Graph-form-container">
      {selectedRetrievalOption === "json" && <UploadJson convertToNormalFormat={false} />}
      {selectedRetrievalOption === "cytoscape-json" && <UploadJson convertToNormalFormat={true} />}
      {selectedRetrievalOption === "websocket" && <WebSocketConnection />}
      {selectedRetrievalOption === "examples" && <ExampleGraphs />}
    </div>

    </div>
  );
};

export default NetworkSearchMenu;
