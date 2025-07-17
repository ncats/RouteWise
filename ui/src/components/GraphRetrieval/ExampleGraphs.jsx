import React, { useContext } from "react";
import { Button, Flex, message } from "antd";
import { MainContext } from "../../contexts/MainContext";
import { convert2aicp } from "../../helpers/apiHelpers";

// Import JSON files from the data folder
const exampleJsonFiles = [
  { name: "Example 1", path: "/data/json_example_1.json" },
  { name: "Example 2", path: "/data/json_example_2.json" },
  {
    name: "Predicted Route Example",
    path: "/data/askcos_route_sample.json",
    askcosRoute: true,
  },
  { name: "Hybrid Routes Example", path: "/data/hybrid_routes_example.json" },
];

const ExampleGraphs = () => {
  const { setAicpGraph, appSettings, setSubgraphIndex, preserveSubgraphIndexRef } = useContext(MainContext);

  const handleLoadExample = async (examplePath, askcosRoute) => {
    try {
      const response = await fetch(examplePath);
      let data = await response.json();

      if (askcosRoute) {
        data = await convert2aicp(data, askcosRoute);
      }

      // Update the graph with the new data
      setAicpGraph(null);
      preserveSubgraphIndexRef.current = false;
      setSubgraphIndex(0);
      setAicpGraph(data);
    } catch (error) {
      message.error("Error loading example JSON");
    }
  };

  const EXAMPLES_TITLE = "Load Example JSON";

  return (
    <div className="example-container">
      <h4>{EXAMPLES_TITLE}</h4>
      <Flex align="flex-start" gap="small">
        {exampleJsonFiles.map((example) => (
          <div key={"load_div_" + example.name}>
            <Button
              onClick={() =>
                handleLoadExample(example.path, example.askcosRoute || false)
              }
            >
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
