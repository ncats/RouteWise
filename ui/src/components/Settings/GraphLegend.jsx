import React from "react";
import { Flex } from "antd";
import * as colors from "../../helpers/colors";

const GraphLegend = () => {
  const legendData = [
    {
      nodeLabel: "Reaction",
      nodeColor: colors.GOLD.primary,
      edgeLabel: "Product Of",
      edgeColor: colors.ORANGE.primary,
    },
    {
      nodeLabel: "Target Molecule",
      nodeColor: colors.BLUE.primary,
      edgeLabel: "Reactant Of",
      edgeColor: colors.BLUE.dark,
    },
    {
      nodeLabel: "Starting Material",
      nodeColor: colors.PINK.primary,
      edgeLabel: "Reagent Of",
      edgeColor: colors.GRAY.primary,
    },
    {
      nodeLabel: "Intermediate Material",
      nodeColor: colors.GRAY.primary,
      edgeLabel: null,
      edgeColor: null,
    },
    {
      nodeLabel: "Predicted",
      nodeColor: colors.WHITE.primary,
      edgeLabel: null,
      edgeColor: colors.GRAY.primary,
      dashed: true,
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
              className={"legendNodeColor"}
              style={{
                backgroundColor: item.nodeColor,
                borderStyle: item.dashed ? "dashed" : "none",
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
                  style={{ backgroundColor: item.edgeColor }}
                ></div>
                <span className={"legendLabelText"}>{item.edgeLabel}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </Flex>
  );
};

export default GraphLegend;
