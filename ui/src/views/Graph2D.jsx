import React, { useContext } from "react";
import { ForceGraph2D } from "react-force-graph";
import { MainContext } from "../contexts/MainContext";
import { genRandomTree } from "../helpers/commonHelpers";

const Graph2D = () => {
  const { appSettings } = useContext(MainContext);
  const myGraph = genRandomTree(appSettings.graphSize);

  return (
    <ForceGraph2D
      graphData={myGraph}
      linkDirectionalArrowLength={3.5}
      linkDirectionalArrowRelPos={1}
      linkCurvature={0.25}
      nodeLabel={"inchikey"}
    />
  );
};

export default Graph2D;
