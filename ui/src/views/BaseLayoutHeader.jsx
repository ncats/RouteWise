import React, { useContext, useState } from "react";
import { Button, Flex, Modal, Typography, Switch } from "antd";
import { MainContext } from "../contexts/MainContext";
import { sendToCytoscape } from "../helpers/apiHelpers";
import { defaultAppSettings, mapGraphDataToCytoscape } from "../helpers/commonHelpers";

const { Text } = Typography;

const BaseLayoutHeader = () => {
  const [appSettings, setAppSettings] = useState(defaultAppSettings);
  const { aicpGraph, setShowReagents, showReagents, setAicpGraph, updateCytoscapeGraph } = useContext(MainContext);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCytoscape, setIsCytoscape] = useState(false);

  const showModal = () => setIsModalVisible(true);
  const handleCancel = () => setIsModalVisible(false);

  const filterGraphForReagents = (graph, showReagents) => {
    if (!graph || !graph.synth_graph) return graph;
    
    const { nodes, edges } = graph.synth_graph;
    
    if (showReagents) {
      return graph; // Return original graph if reagents should be shown
    }
    
    // Identify reagent edges and nodes
    const reagentEdges = edges.filter(edge => edge.edge_type === "reagent_of");
    const reagentNodeLabels = new Set(reagentEdges.map(edge => edge.start_node));
    
    // Filter out reagent nodes and edges
    const filteredNodes = nodes.filter(node => !reagentNodeLabels.has(node.node_label));
    const filteredEdges = edges.filter(edge => edge.edge_type !== "reagent_of");
    
    return {
      ...graph,
      synth_graph: {
        nodes: filteredNodes,
        edges: filteredEdges,
      },
    };
  };
  
  const handleToggleReagents = (checked) => {
    setShowReagents(checked);
    const filteredGraph = filterGraphForReagents(aicpGraph, checked);
    setAicpGraph(filteredGraph);
    const mappedData = mapGraphDataToCytoscape(filteredGraph);
    updateCytoscapeGraph(mappedData);
  };
  

  // Convert the graph to Cytoscape JSON format
const convertToCytoscapeJson = () => {
  if (!aicpGraph || !aicpGraph.synth_graph) return {};

  const synthGraph = aicpGraph.synth_graph;
  const subgraphs = aicpGraph.routes?.subgraphs || [];

  if (subgraphs.length === 0) {
    throw new Error("No subgraphs found in the 'routes.subgraphs' section.");
  }

  const subgraph = subgraphs[0];
  const routeNodeLabels = new Set(subgraph.route_node_labels);

  // Filter nodes
  const filteredNodes = synthGraph.nodes
    .filter(node => routeNodeLabels.has(node.node_label))
    .map(node => ({
      data: { ...node, id: node.node_label },
    }));

  // Filter edges
  const filteredEdges = synthGraph.edges
    .filter(edge => routeNodeLabels.has(edge.start_node) && routeNodeLabels.has(edge.end_node))
    .map(edge => ({
      data: { ...edge, source: edge.start_node, target: edge.end_node },
    }));

  // Retain "routes" and "inventory" sections
  return {
    data: { name: "test" },
    directed: true,
    multigraph: false,
    elements: { nodes: filteredNodes, edges: filteredEdges },
    routes: aicpGraph.routes,
    inventory: aicpGraph.inventory,
  };
};

  return (
    <Flex justify="space-between" align="center" style={{ padding: "10px", paddingRight: "20px", maxHeight: 70 }}>
      <Flex gap="middle" wrap="wrap">
        {/* Toggle Show Reagents */}
        <Switch
          checkedChildren="Show Reagents"
          unCheckedChildren="No Reagents"
          checked={showReagents}
          onChange={(checked) => {
            handleToggleReagents(checked);
          }}
        />
      </Flex>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <pre style={{ margin: 0 }}><b>Nodes:</b> {aicpGraph ? aicpGraph.synth_graph.nodes.length : "N/A"}</pre>
          <pre style={{ margin: 0 }}><b>Edges:</b> {aicpGraph ? aicpGraph.synth_graph.edges.length : "N/A"}</pre>
          <pre style={{ margin: 0 }}>
            <b>Agg Yield:</b> {aicpGraph ? aicpGraph.routes.subgraphs[0].aggregate_yield.toFixed(2) : "N/A"}
          </pre>

          <Button disabled={!aicpGraph} type="primary" onClick={showModal} size="small">
            View JSON
          </Button>

          {/* Toggle JSON Format */}
          <Switch
            checkedChildren="Cytoscape Format"
            unCheckedChildren="AICP Format"
            onChange={() => setIsCytoscape(!isCytoscape)}
            style={{ marginLeft: "10px" }}
          />

          {/* Send to Cytoscape Button */}
          <Button
            type="primary"
            disabled={!aicpGraph}
            onClick={() => sendToCytoscape(appSettings.apiUrl, convertToCytoscapeJson(showReagents))}
            style={{ marginTop: "10px" }}
          >
            Send to Cytoscape
          </Button>
        </div>

        {/* Modal for Viewing JSON */}
        <Modal
          title={
            <Text strong copyable={{ text: isCytoscape ? JSON.stringify(convertToCytoscapeJson(), null, 2) : JSON.stringify(aicpGraph, null, 2) }}>
              {isCytoscape ? "Cytoscape Graph JSON" : "Graph JSON"}
            </Text>
          }
          open={isModalVisible}
          onCancel={handleCancel}
          width={1200}
          styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
        >
          <pre>{isCytoscape ? JSON.stringify(convertToCytoscapeJson(), null, 2) : JSON.stringify(aicpGraph, null, 2)}</pre>
        </Modal>
      </div>
    </Flex>
  );
};

export default BaseLayoutHeader;
