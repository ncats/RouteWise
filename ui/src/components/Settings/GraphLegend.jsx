import React from "react";
import { Flex } from "antd";
import * as colors from "../../helpers/colors";

const GraphLegend = () => {
  const legendData = [
    {
      nodeLabel: "Reaction",
      nodeColor: colors.GOLD.primary,
      nodeType: "reaction",
      edgeLabel: "Product Of",
      edgeColor: colors.ORANGE.primary,
    },
    {
      nodeLabel: "Target Molecule",
      nodeColor: colors.BLUE.primary,
      nodeType: "molecule",
      edgeLabel: "Reactant Of",
      edgeColor: colors.BLUE.dark,
    },
    {
      nodeLabel: "Starting Material",
      nodeColor: colors.PINK.primary,
      nodeType: "molecule",
      edgeLabel: "Reagent Of",
      edgeColor: colors.GRAY.primary,
    },
    {
      nodeLabel: "Intermediate Material",
      nodeColor: colors.GRAY.primary,
      nodeType: "molecule",
      edgeLabel: null,
      edgeColor: null,
    },
    {
      nodeLabel: "Predicted",
      nodeColor: colors.WHITE.primary,
      nodeType: "molecule",
      edgeLabel: "Predicted Edge",
      edgeColor: colors.GRAY.primary,
      edgeDashed: true,
    },
  ];

  return (
    <Flex gap="middle" vertical>
      {/* Header Row */}
      <div className={"legendContainer"}>
        <span style={{ flex: 1 }}>Nodes</span>
        <span style={{ flex: 1 }}>Edges</span>
      </div>

      {/* Content Rows */}
      {legendData.map((item, index) => (
        <div
          key={index}
          className={`${"legendRow"} ${index === 0 ? "firstLegendRow" : ""}`}
        >
          {/* Nodes Column */}
          <div className={"legendNodeColumn"}>
            <div
              className={
                item.nodeType === "reaction"
                  ? "legendNodeRectangle"
                  : "legendNodeSquare"
              }
              style={{
                backgroundColor: item.nodeColor,
                borderStyle: item.nodeType === "molecule" && item.nodeColor === colors.WHITE.primary ? "dashed" : "solid",
                borderColor: item.nodeType === "molecule" && item.nodeColor === colors.WHITE.primary ? colors.GRAY.primary : item.nodeColor,
                borderWidth: "2px",
              }}
            ></div>
            <span className={"legendLabelText"}>{item.nodeLabel}</span>
          </div>

          {/* Edges Column */}
          <div className={"legendEdgeColumn"}>
            {item.edgeLabel && (
              <>
                <div
                  className={"legendEdgeColor"}
                  style={{
                    backgroundColor: item.edgeColor,
                    borderTop: item.edgeDashed
                      ? `2px dashed ${item.edgeColor}`
                      : "none",
                    backgroundColor: item.edgeDashed ? "transparent" : item.edgeColor,
                  }}
                ></div>
                <span className={"legendLabelText"}>{item.edgeLabel}</span>
              </>
            )}
          </div>
        </div>
      ))}
      
      {/* Info Note */}
      <div style={{ 
        marginTop: '12px', 
        paddingTop: '12px', 
        borderTop: '1px solid #d9d9d9',
        fontSize: '12px',
        color: '#8c8c8c',
        fontStyle: 'italic'
      }}>
        Note: Node colors may only be reflected in node borders when structure SVGs are present
      </div>
    </Flex>
  );
};

export default GraphLegend;
