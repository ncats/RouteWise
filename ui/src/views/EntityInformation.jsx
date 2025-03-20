import React, { useContext, useEffect, useState, useRef } from "react";
import { MainContext } from "../contexts/MainContext";
import Draggable from "react-draggable";
import { Button, Typography } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { extractBase64FromDataURL } from "../helpers/commonHelpers";

const { Text } = Typography;

const EntityInformation = () => {
  const {
    selectedEntity,
    setSelectedEntity,
    previewEntity,
    setPreviewEntity,
    aicpGraph,
    nodeSvgs,
    balanceData,
    reactionSources
  } = useContext(MainContext);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null);
  const [entityType, setEntityType] = useState(null);
  const [entityId, setEntityId] = useState(null);
  const [entityInfo, setEntityInfo] = useState(null);
  const [inchikey, setInchikey] = useState(null);
  const [isSubstance, setIsSubstance] = useState(false);
  const [isReaction, setIsReaction] = useState(false);
  const [isAskcosNode, setIsAskcosNode] = useState(false);
  const [expandSmiles, setExpandSmiles] = useState(false);
  const [expandSourceInfo, setExpandSourceInfo] = useState(false);

  const nodeRef = useRef(null);

  const handleClose = () => {
    setOpen(false);
    setMode(null);
    setEntityId(null);
    setSelectedEntity(null);
    setPreviewEntity(null);
    setEntityInfo(null);
    setExpandSmiles(false);
    setExpandSourceInfo(false);
  };

  const lookupEntity = async (entityId, entityType) => {
    // if entity id ends with '(#)', remove it
    entityId = entityId.replace(/\s\(\d+\)$/, "");
  
    if (entityType === "node") {
      const nodeInfo = aicpGraph.synth_graph.nodes.find(
        (node) => node.node_label === entityId || node.node_id === entityId
      ); // Look up by node_label or node_id to work with askcos and aicp nodes
      
      if (nodeInfo) {
        // Add pbi, rbi, and tbi from balanceData if they exist
        const balanceEntity = balanceData[nodeInfo.rxid];
        if (balanceEntity) {
          nodeInfo.pbi = balanceEntity.pbi;
          nodeInfo.rbi = balanceEntity.rbi;
          nodeInfo.tbi = balanceEntity.tbi;
        }
        
        if (!nodeInfo.base64svg && nodeSvgs[entityId]) {
          nodeInfo.base64svg = extractBase64FromDataURL(nodeSvgs[entityId]);
        }
      }
      
      if (nodeInfo) {
  const availabilityItem = aicpGraph.availability?.find(
    (item) => item.inchikey === nodeInfo.node_label
  );
  nodeInfo.inventory = availabilityItem
    ? { available: availabilityItem.inventory?.available || false }
    : { available: false };
}
return nodeInfo;
    } else if (entityType === "edge") {
      return aicpGraph.synth_graph.edges.find((edge) => edge.uuid === entityId); // edge id is uuid
    } else {
      return null;
    }
  };
  

  useEffect(() => {
    if (!(open && mode === "selected")) {
      if (previewEntity) {
        setEntityId(previewEntity[0]);
        setEntityType(previewEntity[1]);
        setOpen(true);
        setMode("preview");
        setExpandSmiles(false);
        setExpandSourceInfo(false);
      } else {
        setOpen(false);
        setMode(null);
        setExpandSourceInfo(false);
      }
    }
  }, [previewEntity]);

  useEffect(() => {
if (selectedEntity) {
      setEntityId(selectedEntity[0]);
      setEntityType(selectedEntity[1]);
      setOpen(true);
      setMode("selected");
      setExpandSmiles(false);
      setExpandSourceInfo(false);
    } else if (!(open && mode === "preview")) {
      setOpen(false);
      setMode(null);
      setExpandSourceInfo(false);
    }
  }, [selectedEntity]);

  useEffect(() => {
const fillEntityData = async () => {
      try {
        if (entityId && entityType) {
          const entity = await lookupEntity(entityId, entityType);
          setInchikey(!!entity && (entity.inchikey || entity.rxid));
          setIsSubstance(
            !!entity &&
              entityType === "node" &&
              entity.node_type.toLowerCase() === "substance"
          );
          setIsReaction(
            !!entity &&
              entityType === "node" &&
              entity.node_type.toLowerCase() === "reaction"
          );
          setIsAskcosNode(
            !!entity &&
              entityType === "node" &&
              entity.data_type === "predicted" &&
              entity.data_source === "ASKCOS v2"
          );
          setEntityInfo(entity);
        } else {
          setEntityInfo(null);
          setInchikey(null);
          setIsSubstance(false);
          setIsReaction(false);
          setIsAskcosNode(false);
          setExpandSmiles(false);
        }
      } catch (error) {
        console.error(error.message);
      }
    };

    fillEntityData();
  }, [entityId]);

  // Set the width of the component
  const componentWidth = 600;

  // Calculate x-coordinate for top-right alignment
  const startPosition = {
    x: window.innerWidth - componentWidth - 20, // 20px padding from the right
    y: 10, // 15px padding from the top
  };

  return (
    <>
      {open && entityInfo && (
        <Draggable
          defaultPosition={startPosition}
          bounds="parent"
          handle=".draggable-header"
          nodeRef={nodeRef}
        >
          <div ref={nodeRef} className="draggable-panel">
            <div className="draggable-header">
              <h4 className="panel-title">
                {entityType === "node"
                  ? "Node " + entityInfo.node_label
                  : "Edge"}{" "}
                {mode === "preview" && " (Preview)"}
              </h4>
              {mode === "selected" && (
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={handleClose}
                  className="close-button"
                />
              )}
            </div>
            <div className="panel-content">
              {entityInfo && entityType === "edge" && (
                <>
                  <p>
                    <b>Edge Label:</b> {entityInfo.edge_label}
                  </p>
                  <p>
                    <b>Edge Type:</b>{" "}
                    {entityInfo.edge_type
                      ? entityInfo.edge_type.toUpperCase()
                      : ""}
                  </p>
                  <p>
                    <b>Start Node:</b> {entityInfo.start_node}
                  </p>
                  <p>
                    <b>End Node:</b> {entityInfo.end_node}
                  </p>
                </>
              )}
              {entityInfo && entityType === "node" && (
                <>
                  {entityInfo.base64svg && (
                    <img
                      src={`data:image/svg+xml;base64,${entityInfo.base64svg}`}
                      alt="SVG"
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        border: "1px solid black",
                        cursor: "pointer",
                      }}
                    />
                  )}
                  {!entityInfo.base64svg && (
                    <p>
                      <b>No SVG available.</b>
                    </p>
                  )}
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {entityInfo.node_type && isSubstance && (
                      <>
                        <p>
                          <Text copyable={{ text: entityInfo.inchikey }}>
                            <b>Inchikey:</b> {entityInfo.inchikey}
                          </Text>
                        </p>
                        <p>
                          <b>SMILES:</b>{" "}
                          <span
                            className="link-like"
                            onClick={() => setExpandSmiles(!expandSmiles)}
                          >
                            [{expandSmiles ? "hide" : "show"}]
                          </span>
                        </p>
                        {expandSmiles && (
                          <p>
                            <Text
                              copyable={{ text: entityInfo.canonical_smiles }}
                            >
                              {entityInfo.canonical_smiles}
                            </Text>
                          </p>
                        )}
                        {isAskcosNode === false && (
                          <>
                            <p>
                              <Text>
                                <b>Substance Role:</b>{" "}
                                {entityInfo.srole
                                  ? entityInfo.srole.toUpperCase()
                                  : "N/A"}
                              </Text>
                            </p>
                            <p>
                              <Text>
                                <b>In Savi:</b>{" "}
                                {entityInfo.is_in_savi_130k ? "Yes" : "No"}
                              </Text>
                            </p>
                            <p>
                              <Text>
                                <b>In ASPIRE Benchmark RXNs:</b>{" "}
                                {entityInfo.is_in_aicp ? "Yes" : "No"}
                              </Text>
                            </p>
                            <p>
                              <Text>
                            <p>
                            <b>In USPTO:</b>{" "}
                            {entityInfo.is_in_uspto_full ? "Yes" : "No"}
                            </p>
                            <Text>
                              <b>Inventory Status:</b> {entityInfo?.inventory?.available === undefined ? "Unknown" : entityInfo?.inventory?.available ? "Available" : "Not Available"}
                            </Text>
                              </Text>
                            </p>
                          </>
                        )}
                        {isAskcosNode && (
                          <>
                            <p>
                              <Text>
                                <b>Prediction Source:</b> {entityInfo.data_source}
                              </Text>
                            </p>
                          </>
                        )}
                      </>
                    )}
                    {entityInfo.node_type && isReaction && (
                    <>
                      <p>
                        <Text copyable={{ text: entityInfo.rxid }}>
                          <b>
                            {String(entityInfo.rxid).startsWith("ASPIRE")
                              ? "ASPIRE RXID"
                              : "RXID"}
                            :
                          </b>{" "}
                          {entityInfo.rxid}
                        </Text>
                      </p>
                      <p>
                        <b>RX SMILES:</b>{" "}
                        <span
                          className="link-like"
                          onClick={() => setExpandSmiles(!expandSmiles)}
                        >
                          [{expandSmiles ? "hide" : "show"}]
                        </span>
                      </p>
                      {expandSmiles && (
                        <p>
                          <Text
                            copyable={{ text: entityInfo.rxsmiles || "N/A" }}
                          >
                            {entityInfo.rxsmiles || "N/A"}
                          </Text>
                        </p>
                      )}
                      {/* Add the new line here */}
                      <p>
                        <b>rbi:</b> {entityInfo.rbi || "N/A"}{" "}
                        <b>pbi:</b> {entityInfo.pbi || "N/A"}{" "}
                        <b>tbi:</b> {entityInfo.tbi || "N/A"}
                      </p>
                      {isAskcosNode && (
                        <>
                          <p>
                            <Text>
                              <b>Prediction Source:</b> {entityInfo.data_source}
                            </Text>
                          </p>
                        </>
                      )}
                      {!!entityInfo.rxname && (
                        <p>
                          <Text>
                            <b>RX Name:</b> {entityInfo.rxname}
                          </Text>
                        </p>
                      )}
                      {!!entityInfo.rxclass && (
                        <p>
                          <Text>
                            <b>RX Class:</b> {entityInfo.rxclass}
                          </Text>
                        </p>
                      )}
                      {isAskcosNode === false && (
                        <p>
                          <b>Source Information:</b>{" "}
                          <span
                            className="link-like"
                            onClick={() => setExpandSourceInfo(!expandSourceInfo)}
                          >
                            [{expandSourceInfo ? "hide" : "show"}]
                          </span>
                        </p>
                      )}
                      {isAskcosNode === false && expandSourceInfo && (
                        <div style={{ borderLeft: "2px solid #1890ff", paddingLeft: "1rem" }}>
                          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                            <Text>
                              <b>In Savi:</b> {entityInfo.is_in_savi_130k ? "Yes" : "No"}
                            </Text>
                            <Text>
                              <b>In USPTO:</b> {entityInfo.is_in_uspto_full ? "Yes" : "No"}
                            </Text>
                          <Text>
                            <b>Inventory Status:</b> {entityInfo?.inventory?.availability === "false" ? "Not Available" : "Available" || "Not Available"}
                          </Text>
                            <Text>
                              <b>In ASPIRE Benchmark RXNs:</b> {entityInfo.is_in_aicp ? "Yes" : "No"}
                            </Text>
                          </div>
                          {reactionSources[entityInfo.rxid] && <p>
                            <Text copyable={{ text: reactionSources[entityInfo.rxid]['rxsmiles_original'] }}>
                              <b>Original RXSmiles:</b> {reactionSources[entityInfo.rxid]['rxsmiles_original'] }
                            </Text>
                          </p>}
                          {reactionSources[entityInfo.rxid] && reactionSources[entityInfo.rxid]['patent_number'] && <p>
                            <Text>
                              <b>USPTO Patent:</b> {reactionSources[entityInfo.rxid]['patent_number']} - Paragraph: {reactionSources[entityInfo.rxid]['paragraph_number']}
                            </Text>
                          </p>}
                        </div>
                      )}
                    </>
                  )}

                  </div>
                </>
              )}
            </div>
          </div>
        </Draggable>
      )}
    </>
  );
};

export default EntityInformation;
