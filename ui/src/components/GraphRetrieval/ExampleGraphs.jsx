import React, { useContext, useState } from "react";
import { Button, Flex, message, Select } from "antd";
import { MainContext } from "../../contexts/MainContext";
import { convert2aicp } from "../../helpers/apiHelpers";

// File name in the public assets directory
const exampleJsonFiles = [
  {
    name: "Example 1",
    fileName: "json_example_1.json",
  },
  {
    name: "Example 2",
    fileName: "json_example_2.json",
  },
  {
    name: "ASKCOS Route Sample",
    fileName: "askcos_route_sample.json",
    askcosRoute: true
  }
];

const ExampleGraphs = () => {
  const { setAicpGraph, updateCytoscapeGraph, appSettings } =
    useContext(MainContext);

  const handleLoadExample = async (exampleFileName, askcosRoute) => {
    if (exampleFileName) {
      try {
        const response = await fetch(
          `${appSettings.staticContentPath}/public/${exampleFileName}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        let data = await response.json();

        if (askcosRoute) {
          data = await convert2aicp(data, askcosRoute);
        }
        // Clear the existing graph data
        setAicpGraph(null);

        // Update the graph with the new data
        setAicpGraph(data);
      } catch (error) {
        message.error("Error loading example JSON");
      }
    } else {
      message.error("Example not found");
    }
  };

  const EXAMPLES_TITLE = "Load Example JSON";

  return (
    <div className="example-container">
      <h4>{EXAMPLES_TITLE}</h4>
{/* Removed the dropdown for routes as it should only exist in NetworkSearchMenu */}
      <Flex align="flex-start" gap="small">
        {exampleJsonFiles.map((example) => (
          <div key={"load_div_" + example.fileName}>
            <Button onClick={() => handleLoadExample(example.fileName, example.askcosRoute || false)}>
              {example.name}
            </Button>
            <br />
          </div>
        ))}
      </Flex>
    </div>
  );
};

export default ExampleGraphs;
