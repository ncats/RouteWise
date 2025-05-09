import React, { useContext, useEffect, useState, useRef } from "react";
import { MainContext } from "../contexts/MainContext";
import Draggable from "react-draggable";
import { Button, Typography } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { extractBase64FromDataURL } from "../helpers/commonHelpers";

const formatLabel = (key) => {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

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
    usePredictedGraph,
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
  const [expandYieldInfo, setExpandYieldInfo] = useState(false);
  const [svgToShow, setSvgToShow] = useState(null);

  const nodeRef = useRef(null);
  const [expandEvidenceProtocolInfo, setExpandEvidenceProtocolInfo] =
    useState(false);
  const [expandEvidenceConditionInfo, setExpandEvidenceConditionInfo] =
    useState(false);
  const [expandInventoryLocations, setExpandInventoryLocations] =
    useState(false);
  const [expandPredictedConditionInfo, setExpandPredictedConditionInfo] =
    useState(false);
  const [expandOriginalSmiles, setExpandOriginalSmiles] = useState(false);
  const [expandCommercialVendors, setExpandCommercialVendors] = useState(false);

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

  // Close the modal when aicpGraph changes
  useEffect(() => {
    handleClose();
  }, [aicpGraph]);

  const lookupEntity = async (entityId, entityType) => {
    // if entity id ends with '(#)', remove it
    entityId = entityId.replace(/\s\(\d+\)$/, "");

    if (entityType === "node") {
      const synthGraph = usePredictedGraph
        ? aicpGraph.predictive_synth_graph
        : aicpGraph.synth_graph || aicpGraph.evidence_synth_graph;

      const nodeInfo = synthGraph.nodes.find(
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

        if (nodeSvgs[entityId]) {
          setSvgToShow(extractBase64FromDataURL(nodeSvgs[entityId]));
        } else {
          setSvgToShow(nodeInfo.base64svg);
        }
      }

      if (nodeInfo) {
        if (nodeInfo.node_type === "substance") {
          const availabilityItem = aicpGraph.availability?.find(
            (item) => item.inchikey === nodeInfo.node_label
          );
          nodeInfo.inventory = availabilityItem
            ? {
                ...availabilityItem.inventory,
                available: availabilityItem.inventory?.available || false,
              }
            : { available: false };

          nodeInfo.commercial_availability = availabilityItem
            ? {
                ...availabilityItem.commercial_availability,
                vendors:
                  availabilityItem.commercial_availability?.vendors || [],
                available:
                  availabilityItem.commercial_availability?.available || false,
              }
            : { available: false };
        }
      }
      return nodeInfo;
    } else if (entityType === "edge") {
      const synthGraph = usePredictedGraph
        ? aicpGraph.predictive_synth_graph
        : aicpGraph.synth_graph || aicpGraph.evidence_synth_graph;

      return synthGraph.edges.find((edge) => edge.uuid === entityId); // edge id is uuid
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
                  {svgToShow && (
                    <img
                      src={`data:image/svg+xml;base64,${svgToShow}`}
                      alt="SVG"
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        border: "1px solid black",
                        cursor: "pointer",
                      }}
                    />
                  )}
                  {!svgToShow && (
                    <p>
                      <b>No SVG available.</b>
                    </p>
                  )}
                  <div style={{ maxHeight: "350px", overflowY: "scroll" }}>
                    {entityInfo.node_type && isSubstance && (
                      <>
                        <p>
                          <Text>
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
                        {isSubstance && (
                          <>
                            <p>
                              <b>Source Information:</b>{" "}
                              <span
                                className="link-like"
                                onClick={() =>
                                  setExpandSourceInfo(!expandSourceInfo)
                                }
                              >
                                [{expandSourceInfo ? "hide" : "show"}]
                              </span>
                            </p>
                            {expandSourceInfo && (
                              <div
                                style={{
                                  borderLeft: "2px solid #1890ff",
                                  paddingLeft: "1rem",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "1rem",
                                    alignItems: "center",
                                  }}
                                >
                                  {entityInfo.provenance &&
                                    Object.entries(entityInfo.provenance).map(
                                      ([key, value]) => (
                                        <Text key={key}>
                                          <b>{formatLabel(key)}:</b>{" "}
                                          {Array.isArray(value)
                                            ? value.join(", ")
                                            : String(value)}
                                        </Text>
                                      )
                                    )}
                                </div>
                              </div>
                            )}
                          </>
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
                            <div>
                              <p>
                                <Text>
                                  <b>Inventory Status:</b>{" "}
                                  {entityInfo?.inventory?.available ===
                                  undefined
                                    ? "Unknown"
                                    : entityInfo?.inventory?.available
                                    ? "Available"
                                    : "Not Available"}
                                </Text>
                              </p>
                              {entityInfo?.inventory?.available &&
                                entityInfo?.inventory?.locations && (
                                  <>
                                    <p>
                                      <Text>
                                        <b>Inventory Locations:</b>{" "}
                                        <span
                                          className="link-like"
                                          onClick={() =>
                                            setExpandInventoryLocations(
                                              !expandInventoryLocations
                                            )
                                          }
                                        >
                                          [
                                          {expandInventoryLocations
                                            ? "hide"
                                            : "show"}
                                          ]
                                        </span>
                                      </Text>
                                    </p>
                                    {expandInventoryLocations && (
                                      <div
                                        style={{
                                          borderLeft: "2px solid #1890ff",
                                          paddingLeft: "1rem",
                                          marginTop: "0.5rem",
                                        }}
                                      >
                                        {entityInfo.inventory.locations.map(
                                          (location, index) => (
                                            <div
                                              key={index}
                                              style={{ marginBottom: "1rem" }}
                                            >
                                              {Object.entries(location).map(
                                                ([key, value]) => (
                                                  <p key={key}>
                                                    <Text>
                                                      <b>{formatLabel(key)}:</b>{" "}
                                                      {value || "N/A"}
                                                    </Text>
                                                  </p>
                                                )
                                              )}
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              {entityInfo?.commercial_availability && (
                                <div style={{ marginTop: "1rem" }}>
                                  <p>
                                    <Text>
                                      <b>Commercial Availability:</b>{" "}
                                      {entityInfo.commercial_availability
                                        .available
                                        ? "Available"
                                        : "Not Available"}
                                    </Text>
                                  </p>
                                </div>
                              )}
                              {entityInfo?.commercial_availability?.available &&
                                entityInfo?.commercial_availability
                                  ?.vendors && (
                                  <>
                                    <p>
                                      <Text>
                                        <b>Commercial Vendors:</b>{" "}
                                        <span
                                          className="link-like"
                                          onClick={() =>
                                            setExpandCommercialVendors(
                                              !expandCommercialVendors
                                            )
                                          }
                                        >
                                          [
                                          {expandCommercialVendors
                                            ? "hide"
                                            : "show"}
                                          ]
                                        </span>
                                      </Text>
                                    </p>
                                    {expandCommercialVendors && (
                                      <div
                                        style={{
                                          borderLeft: "2px solid #1890ff",
                                          paddingLeft: "1rem",
                                          marginTop: "0.5rem",
                                        }}
                                      >
                                        {entityInfo.commercial_availability.vendors.map(
                                          (vendor, index) => (
                                            <div
                                              key={index}
                                              style={{ marginBottom: "1rem" }}
                                            >
                                              {Object.entries(vendor).map(
                                                ([key, value]) => (
                                                  <p key={key}>
                                                    <Text>
                                                      <b>{formatLabel(key)}:</b>{" "}
                                                      {key === "url" ? (
                                                        <a
                                                          href={
                                                            value.startsWith(
                                                              "http"
                                                            )
                                                              ? value
                                                              : `https://${value}`
                                                          }
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                        >
                                                          {value}
                                                        </a>
                                                      ) : (
                                                        value || "N/A"
                                                      )}
                                                    </Text>
                                                  </p>
                                                )
                                              )}
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                            </div>
                          </>
                        )}
                        {isAskcosNode && (
                          <>
                            <p>
                              <Text>
                                <b>Prediction Source:</b>{" "}
                                {entityInfo.data_source}
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
                            <b>RXID:</b> {entityInfo.rxid}
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
                        <p>
                          <b>Original RX SMILES:</b>{" "}
                          <span
                            className="link-like"
                            onClick={() =>
                              setExpandOriginalSmiles(!expandOriginalSmiles)
                            }
                          >
                            [{expandOriginalSmiles ? "hide" : "show"}]
                          </span>
                        </p>
                        {expandOriginalSmiles && (
                          <p>
                            <Text
                              copyable={{
                                text: entityInfo.original_rxsmiles || "N/A",
                              }}
                            >
                              {entityInfo.original_rxsmiles || "N/A"}
                            </Text>
                          </p>
                        )}
                        {/* Add the new line here */}
                        <p>
                          <b>rbi:</b> {entityInfo.rbi || "N/A"} <b>pbi:</b>{" "}
                          {entityInfo.pbi || "N/A"} <b>tbi:</b>{" "}
                          {entityInfo.tbi || "N/A"}{" "}
                        </p>
                        {isAskcosNode && (
                          <>
                            <p>
                              <Text>
                                <b>Prediction Source:</b>{" "}
                                {entityInfo.data_source}
                              </Text>
                            </p>
                          </>
                        )}
                        <p>
                          <Text>
                            <b>RX Name:</b> {entityInfo.rxname || "N/A"}
                          </Text>
                        </p>
                        <p>
                          <Text>
                            <b>RX Class:</b> {entityInfo.rxclass || "N/A"}
                          </Text>
                        </p>
                        <p>
                          <Text>
                            <b>RX Name Recognized:</b>{" "}
                            {entityInfo.validation?.is_rxname_recognized !==
                              undefined &&
                            entityInfo.validation?.is_rxname_recognized !== null
                              ? entityInfo.validation.is_rxname_recognized.toString()
                              : "N/A"}
                          </Text>
                        </p>
                        <p>
                          <Text>
                            <b>RX Valid:</b>{" "}
                            {entityInfo.validation?.is_valid !== undefined &&
                            entityInfo.validation?.is_valid !== null
                              ? entityInfo.validation.is_valid.toString()
                              : "N/A"}
                          </Text>
                        </p>
                        <p>
                          <Text>
                            <b>Is Balanced:</b>{" "}
                            {entityInfo.validation?.is_balanced !== undefined &&
                            entityInfo.validation?.is_balanced !== null
                              ? entityInfo.validation.is_balanced.toString()
                              : "N/A"}
                          </Text>
                        </p>
                        {isAskcosNode === false &&
                          ((
                            <p>
                              <b>Yield Information:</b>{" "}
                              <span
                                className="link-like"
                                onClick={() =>
                                  setExpandYieldInfo(!expandYieldInfo)
                                }
                              >
                                [{expandYieldInfo ? "hide" : "show"}]
                              </span>
                            </p>
                          ),
                          (
                            <>
                              <p>
                                <b>Yield Information:</b>{" "}
                                <span
                                  className="link-like"
                                  onClick={() =>
                                    setExpandYieldInfo(!expandYieldInfo)
                                  }
                                >
                                  [{expandYieldInfo ? "hide" : "show"}]
                                </span>
                              </p>
                              {expandYieldInfo && (
                                <div
                                  style={{
                                    borderLeft: "2px solid #1890ff",
                                    paddingLeft: "1rem",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "1rem",
                                      alignItems: "center",
                                    }}
                                  >
                                    {entityInfo.yield_info &&
                                      Object.entries(entityInfo.yield_info).map(
                                        ([key, value]) => (
                                          <Text key={key}>
                                            <b>{formatLabel(key)}:</b>{" "}
                                            {typeof value === "number"
                                              ? value.toFixed(2)
                                              : Array.isArray(value)
                                              ? value.join(", ")
                                              : String(value)}
                                          </Text>
                                        )
                                      )}
                                  </div>
                                </div>
                              )}

                              <>
                                <p>
                                  <b>Source Information:</b>{" "}
                                  <span
                                    className="link-like"
                                    onClick={() =>
                                      setExpandSourceInfo(!expandSourceInfo)
                                    }
                                  >
                                    [{expandSourceInfo ? "hide" : "show"}]
                                  </span>
                                </p>
                                {expandSourceInfo && (
                                  <div
                                    style={{
                                      borderLeft: "2px solid #1890ff",
                                      paddingLeft: "1rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "1rem",
                                        alignItems: "center",
                                      }}
                                    >
                                      {entityInfo.provenance &&
                                        Object.entries(
                                          entityInfo.provenance
                                        ).map(([key, value]) => (
                                          <Text key={key}>
                                            <b>{formatLabel(key)}:</b>{" "}
                                            {Array.isArray(value)
                                              ? value.join(", ")
                                              : String(value)}
                                          </Text>
                                        ))}
                                    </div>
                                  </div>
                                )}

                                <p>
                                  <b>Evidence Protocol:</b>{" "}
                                  <span
                                    className="link-like"
                                    onClick={() =>
                                      setExpandEvidenceProtocolInfo(
                                        !expandEvidenceProtocolInfo
                                      )
                                    }
                                  >
                                    [
                                    {expandEvidenceProtocolInfo
                                      ? "hide"
                                      : "show"}
                                    ]
                                  </span>
                                </p>
                                {expandEvidenceProtocolInfo &&
                                  entityInfo.evidence_protocol && (
                                    <div
                                      style={{
                                        borderLeft: "2px solid #1890ff",
                                        paddingLeft: "1rem",
                                      }}
                                    >
                                      {Object.entries(
                                        entityInfo.evidence_protocol
                                      ).map(([key, value]) => (
                                        <div
                                          key={key}
                                          style={{ marginBottom: "1rem" }}
                                        >
                                          <Text>
                                            <b>{key}:</b>
                                          </Text>
                                          <div
                                            style={{
                                              borderLeft: "2px solid #1890ff",
                                              paddingLeft: "1rem",
                                              marginTop: "0.5rem",
                                            }}
                                          >
                                            <p>
                                              <Text>{value}</Text>
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                <p>
                                  <b>Evidence Conditions Information:</b>{" "}
                                  <span
                                    className="link-like"
                                    onClick={() =>
                                      setExpandEvidenceConditionInfo(
                                        !expandEvidenceConditionInfo
                                      )
                                    }
                                  >
                                    [
                                    {expandEvidenceConditionInfo
                                      ? "hide"
                                      : "show"}
                                    ]
                                  </span>
                                </p>
                                {expandEvidenceConditionInfo &&
                                  entityInfo.evidence_conditions_info && (
                                    <div
                                      style={{
                                        borderLeft: "2px solid #1890ff",
                                        paddingLeft: "1rem",
                                      }}
                                    >
                                      {Object.entries(
                                        entityInfo.evidence_conditions_info
                                      ).map(([mainKey, subValue]) => (
                                        <div
                                          key={mainKey}
                                          style={{ marginBottom: "1rem" }}
                                        >
                                          <Text>
                                            <b>{mainKey}:</b>
                                          </Text>
                                          <div
                                            style={{
                                              borderLeft: "2px solid #1890ff",
                                              paddingLeft: "1rem",
                                              marginTop: "0.5rem",
                                            }}
                                          >
                                            {Object.entries(subValue).map(
                                              ([subKey, subVal]) => (
                                                <p key={subKey}>
                                                  <Text>
                                                    <b>
                                                      {formatLabel(subKey)}:
                                                    </b>{" "}
                                                    {subVal}
                                                  </Text>
                                                </p>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                <p>
                                  <b>Predicted Conditions Information:</b>{" "}
                                  <span
                                    className="link-like"
                                    onClick={() =>
                                      setExpandPredictedConditionInfo(
                                        !expandPredictedConditionInfo
                                      )
                                    }
                                  >
                                    [
                                    {expandPredictedConditionInfo
                                      ? "hide"
                                      : "show"}
                                    ]
                                  </span>
                                </p>
                                {expandPredictedConditionInfo &&
                                  entityInfo.predicted_conditions_info && (
                                    <div
                                      style={{
                                        borderLeft: "2px solid #1890ff",
                                        paddingLeft: "1rem",
                                      }}
                                    >
                                      {Object.entries(
                                        entityInfo.predicted_conditions_info
                                      ).map(([methodKey, methodValue]) => (
                                        <div
                                          key={methodKey}
                                          style={{ marginBottom: "1rem" }}
                                        >
                                          <Text>
                                            <b>Method:</b>
                                          </Text>
                                          <div
                                            style={{
                                              borderLeft: "2px solid #1890ff",
                                              paddingLeft: "1rem",
                                              marginTop: "0.5rem",
                                            }}
                                          >
                                            {Object.entries(methodValue).map(
                                              ([
                                                predictionKey,
                                                predictionValue,
                                              ]) => (
                                                <div
                                                  key={predictionKey}
                                                  style={{
                                                    marginBottom: "1rem",
                                                  }}
                                                >
                                                  <div
                                                    style={{
                                                      marginBottom: "1rem",
                                                    }}
                                                  >
                                                    <Text>
                                                      <b>{predictionKey}:</b>
                                                    </Text>
                                                    <div
                                                      style={{
                                                        borderLeft:
                                                          "2px solid #1890ff",
                                                        paddingLeft: "1rem",
                                                        marginTop: "0.5rem",
                                                      }}
                                                    >
                                                      {Object.entries(
                                                        predictionValue
                                                      ).map(([key, val]) => (
                                                        <div
                                                          key={key}
                                                          style={{
                                                            marginBottom:
                                                              "0.5rem",
                                                          }}
                                                        >
                                                          <Text>
                                                            <b>
                                                              {formatLabel(key)}
                                                              :
                                                            </b>
                                                          </Text>
                                                          <div
                                                            style={{
                                                              borderLeft:
                                                                "2px solid #1890ff",
                                                              paddingLeft:
                                                                "1rem",
                                                              marginTop:
                                                                "0.5rem",
                                                            }}
                                                          >
                                                            {typeof val ===
                                                              "object" &&
                                                            val !== null ? (
                                                              Object.entries(
                                                                val
                                                              ).map(
                                                                ([
                                                                  innerKey,
                                                                  innerVal,
                                                                ]) => (
                                                                  <p
                                                                    key={
                                                                      innerKey
                                                                    }
                                                                  >
                                                                    <Text>
                                                                      <b>
                                                                        {formatLabel(
                                                                          innerKey
                                                                        )}
                                                                        :
                                                                      </b>{" "}
                                                                      {innerVal}
                                                                    </Text>
                                                                  </p>
                                                                )
                                                              )
                                                            ) : (
                                                              <Text>{val}</Text>
                                                            )}
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                              </>
                            </>
                          ))}
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
