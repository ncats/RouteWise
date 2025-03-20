import React from "react";
import BaseLayout from "./BaseLayout";
import CytoscapeGraph from "./CytoscapeGraph";
import EntityInformation from "./EntityInformation";

function Cytoscape() {
  return (
    <BaseLayout>
      <EntityInformation />
      <CytoscapeGraph />
    </BaseLayout>
  );
}

export default Cytoscape;
