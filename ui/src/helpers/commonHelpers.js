import { v4 as uuidv4 } from "uuid";
import * as colors from "./colors";

export const graphLayouts = {
  FORCE_DIRECTED: "cola",
  HIERARCHICAL: "dagre",
};

export const curveStyles = {
  ROUND_TAXI: "round-taxi",
  STRAIGHT: "straight",
  // BEZIER: "unbundled-bezier",
  SEGMENTS: "segments",
};

function removeTrailingSlashFromHostname(hostname) {
  if (hostname.endsWith("/")) {
    return hostname.slice(0, -1);
  } else {
    return hostname;
  }
}

export const generateRoomId = () => uuidv4();

export const defaultAppSettings = {
  roomId: generateRoomId(),
  graphSize: 50,
apiUrl: removeTrailingSlashFromHostname(
    process.env.API_URL || "http://0.0.0.0:5099"
  ),
uploadJsonToUiStreamUrl: `${process.env.API_URL}/upload_json_to_ui/stream`,
  appBasePath: process.env.REACT_APP_BASE_PATH || "/",
  staticContentPath:
    process.env.REACT_APP_STATIC_CONTENT_PATH || "http://localhost:4204",
  showStructures: false,
  edgeCurveStyle: curveStyles.ROUND_TAXI,
  productEdgeThickness: 7,
};

export const defaultGraphSettings = {
  linkDirectionalArrowLength: 3.5,
  linkDirectionalArrowRelPos: 1,
  linkCurvature: 0.25,
  nodeLabel: "inchikey",
};

export const genRandomTree = (N = 300, reverse = false) => {
  return {
    nodes: [...Array(N).keys()].map((i) => ({
      id: i,
      inchikey: "UCPYLLCMEDAXFR-UHFFFAOYSA-N",
    })),
    links: [...Array(N).keys()]
      .filter((id) => id)
      .map((id) => ({
        [reverse ? "target" : "source"]: id,
        [reverse ? "source" : "target"]: Math.round(Math.random() * (id - 1)),
      })),
  };
};

export const mapGraphData = (data) => {
  return {
    nodes: data.nodes.map((node) => ({
      id: node.node_label,
      inchikey: node.node_label,
    })),
    links: data.edges.map((edge) => ({
      source: edge.start_node,
      target: edge.end_node,
    })),
  };
};

export const mapGraphDataToCytoscape = (data, subgraphIndex = 0) => {
  const flattenObject = (obj) => {
    return Object.keys(obj).reduce((acc, key) => {
      const value = obj[key];
      if (typeof value === "object" && value !== null) {
        return { ...acc, ...flattenObject(value) };
      }
      return {
        ...acc,
        [key]: value !== undefined && value !== null ? String(value) : "", // <-- convert to string
      };
    }, {});
  };

  // Extract synth_graph
  const synthGraph = data.synth_graph || {};

  // Extract route_node_labels from the selected subgraph
  const routeNodeLabels = new Set();
  const subgraphs = data.routes?.subgraphs || [];

  if (subgraphs.length === 0) {
    throw new Error("No subgraphs found in the 'routes.subgraphs' section.");
  }

  if (subgraphIndex < -1 || subgraphIndex >= subgraphs.length) {
    throw new Error("Invalid subgraph index.");
  }
  let filteredNodes = synthGraph.nodes || [];
  let filteredEdges = synthGraph.edges || [];

  if (subgraphIndex !== -1) {
    const subgraph = subgraphs[subgraphIndex];
    subgraph.route_node_labels.forEach((label) => routeNodeLabels.add(label));
    // Filter nodes
    filteredNodes = (synthGraph.nodes || []).filter((node) =>
      routeNodeLabels.has(node.node_label)
    );
  
    // Filter edges: keep edge only if both ends are in routeNodeLabels
    filteredEdges = (synthGraph.edges || []).filter(
      (edge) =>
        routeNodeLabels.has(edge.start_node) &&
        routeNodeLabels.has(edge.end_node)
    );
  }

  // Map filtered nodes to Cytoscape format
  const nodes = filteredNodes.map((node) => {
    const flatNode = flattenObject(node);
    const nodeType = flatNode.node_type?.toLowerCase() || "unknown";
    return {
      data: {
        id: flatNode.node_label,
        svg: flatNode.base64svg
          ? `data:image/svg+xml;base64,${flatNode.base64svg}`
          : null,
        type: flatNode.base64svg || flatNode.srole === "tm" ? "custom" : null,
        nodeType,
        is_valid: String(flatNode.is_valid || ""),
        ...flatNode,
        provenance: flatNode.provenance || {},
        conditions_info: flatNode.conditions_info || {},
      },
    };
  });

  // Map filtered edges to Cytoscape format
  const edges = filteredEdges.map((edge) => {
    const flatEdge = flattenObject(edge);
    return {
      data: {
        id: flatEdge.uuid,
        source: flatEdge.start_node,
        target: flatEdge.end_node,
        ...flatEdge,
      },
    };
  });

  return [...nodes, ...edges];
};




// Funciton to map reaction w/ components to a cytoscape graph, this is for one step reactions only
export const mapReactionDataToGraph = (raw_data) => {
  const data = { ...raw_data };
  const nodes = [];
  const edges = [];
  const raw_reactants = data.reactants;
  const raw_reagents = data.reagents;
  const raw_products = data.products;

  // Delete the reactants, reagents, and products from the data object
  delete data.reactants;
  delete data.reagents;
  delete data.products;

  // Push reaction node
  data.id = data.rxid;
  data.node_id = data.rxid;
  data.node_label = data.rxid;
  data.node_type = "reaction";
  data.uuid = uuidv4();
  nodes.push(data);


  // Push reactants
  if (raw_reactants) {
    raw_reactants.forEach((reactant) => {
      reactant.id = reactant.inchikey;
      reactant.node_id = reactant.inchikey;
      reactant.node_type = "substance";
      reactant.srole = "sm";
      reactant.node_label = reactant.inchikey;
      reactant.uuid = uuidv4();
      nodes.push(reactant);
      edges.push({
        start_node: reactant.inchikey,
        end_node: data.rxid,
        edge_label: `${reactant.inchikey}|${data.rxid}`,
        edge_type: "reactant_of",
        uuid: uuidv4(),
      });
    });
  }

  // Push reagents
  if (raw_reagents) {
    raw_reagents.forEach((reagent) => {
      reagent.id = reagent.inchikey;
      reagent.node_id = reagent.inchikey;
      reagent.node_type = "substance";
      reagent.srole = "sm";
      reagent.node_label = reagent.inchikey;
      reagent.uuid = uuidv4();
      nodes.push(reagent);
      edges.push({
        start_node: reagent.inchikey,
        end_node: data.rxid,
        edge_label: `${reagent.inchikey}|${data.rxid}`,
        edge_type: "reagent_of",
        uuid: uuidv4(),
      });
    });
  }

  // Push products
  if (raw_products) {
    raw_products.forEach((product) => {
      product.id = product.inchikey;
      product.node_id = product.inchikey;
      product.node_type = "substance";
      product.srole = "tm";
      product.node_label = product.inchikey;
      product.uuid = uuidv4();
      nodes.push(product);
      edges.push({
        start_node: data.rxid,
        end_node: product.inchikey,
        edge_label: `${data.rxid}|${product.inchikey}`,
        edge_type: "product_of",
        uuid: uuidv4(),
      });
    });
  }

  return {
    nodes,
    edges,
  }
}

// Function to map substance/reaction smiles to a graph
export const mapGraphWithSmiles = (graph, reactions, substances) => {
  const nodes = graph.nodes.map((node) => {
    const nodeType = node.node_type.toLowerCase(); // Cast to lowercase for consistency
    const mappedNode = node;

    if (["substance"].includes(nodeType)) {
      const substance = substances.find(
        (substance) => substance.inchikey === node.node_label
      );
      return {
        ...mappedNode,
        canonical_smiles: substance.canonical_smiles,
      };
    } else if (["reaction"].includes(nodeType)) {
      const reaction = reactions.find(
        (reaction) => reaction.rxid === node.node_label
      );
      return {
        ...mappedNode,
        rxsmiles: reaction.rxsmiles,
      };
    }
  });

  graph.nodes = nodes;
  return graph;
};

// default layout options for cytoscape cola
export const cyOptions = {
  animate: true, // whether to show the layout as it's running
  refresh: 1, // number of ticks per frame; higher is faster but more jerky
  maxSimulationTime: 4000, // max length in ms to run the layout
  ungrabifyWhileSimulating: false, // so you can't drag nodes during layout
  fit: true, // on every layout reposition of nodes, fit the viewport
  padding: 30, // padding around the simulation
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  nodeDimensionsIncludeLabels: false, // whether labels should be included in determining the space used by a node

  // layout event callbacks
  ready: function () {}, // on layoutready
  stop: function () {}, // on layoutstop

  // positioning options
  randomize: false, // use random node positions at beginning of layout
  avoidOverlap: true, // if true, prevents overlap of node bounding boxes
  handleDisconnected: true, // if true, avoids disconnected components from overlapping
  convergenceThreshold: 0.01, // when the alpha value (system energy) falls below this value, the layout stops
  nodeSpacing: function (node) {
    return 10;
  }, // extra spacing around nodes
  flow: undefined, // use DAG/tree flow layout if specified, e.g. { axis: 'y', minSeparation: 30 }
  alignment: undefined, // relative alignment constraints on nodes, e.g. {vertical: [[{node: node1, offset: 0}, {node: node2, offset: 5}]], horizontal: [[{node: node3}, {node: node4}], [{node: node5}, {node: node6}]]}
  gapInequalities: undefined, // list of inequality constraints for the gap between the nodes, e.g. [{"axis":"y", "left":node1, "right":node2, "gap":25}]
  centerGraph: true, // adjusts the node positions initially to center the graph (pass false if you want to start the layout from the current position)

  // different methods of specifying edge length
  // each can be a constant numerical value or a function like `function( edge ){ return 2; }`
  edgeLength: undefined, // sets edge length directly in simulation
  edgeSymDiffLength: undefined, // symmetric diff edge length in simulation
  edgeJaccardLength: undefined, // jaccard edge length in simulation

  // iterations of cola algorithm; uses default values on undefined
  unconstrIter: undefined, // unconstrained initial layout iterations
  userConstIter: undefined, // initial layout iterations with user-specified constraints
  allConstIter: undefined, // initial layout iterations with all constraints including non-overlap

  // hierarchical related options
  rankDir: "BT", // 'TB' for top to bottom layout, 'BT' for bottom to top, 'LR' for left to right, 'RL' for right to left
  directed: true, // whether the tree is directed downwards (or edges can point in any direction if false)
};

export const cyStyles = [
  {
    selector: "node",
    style: {
      shape: "rectangle",
      "border-width": 1,
      "border-color": colors.GRAY.dark,
      "background-color": colors.WHITE.primary,
      "font-size": "2px",
      "text-margin-y": "-5px",
    },
  },
  {
    selector: 'node[nodeType="reaction"][width][height]',
    style: {
      shape: "rectangle",
      width: "data(width)",
      height: "data(height)",
      "border-color": colors.PINK.primary,
      "background-color": colors.PINK.primary,
      "border-width": 2,
    },
  },
  {
    selector: 'node[nodeType="reaction"][is_valid="false"]',
    style: {
      shape: "ellipse",
      width: 50, // Ensure circular shape
      height: 50, // Match width for circle
    },
  },
  {
    selector: 'node[srole="sm"]',
    style: {
      "border-color": colors.GOLD.primary,
      "background-color": colors.GOLD.primary,
    },
  },
  {
    selector: 'node[srole="im"]',
    style: {
      "border-color": colors.GRAY.primary,
      "background-color": colors.GRAY.primary,
    },
  },
  {
    selector: 'node[srole="tm"]',
    style: {
      "border-color": colors.BLUE.primary,
      "background-color": colors.BLUE.primary,
      width: "data(width)",
      height: "data(height)",
      "border-width": 2,
    },
  },
  {
    selector: 'node[type="custom"][svg]',
    style: {
      "background-image": "data(svg)",
      "background-fit": "contain",
    },
  },
  {
    selector: 'node[is_predicted="true"]',
    style: {
      "border-style": "dashed",
    },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "target-arrow-shape": "vee",
      "taxi-turn": 20,
      "taxi-turn-min-distance": 5,
      "taxi-radius": 10,
    },
  },
  {
    selector: "edge[edge_type = 'product_of']",
    style: {
      "line-color": colors.ORANGE.primary,
      "target-arrow-color": colors.ORANGE.primary,
      width: 7,
    },
  },
  {
    selector: "edge[edge_type = 'reactant_of']",
    style: {
      "line-color": colors.BLUE.dark,
      "target-arrow-color": colors.BLUE.dark,
    },
  },
  {
    selector: 'edge[is_predicted="true"]',
    style: {
      opacity: 0.5,
      "line-style": "dashed",
    },
  },
  {
    selector: ".highlighted",
    style: {
      // Highlight style for selected nodes/edges
      "line-color": colors.ORANGE.primary,
      "target-arrow-color": colors.ORANGE.primary,
      "border-color": colors.ORANGE.primary,
      "border-width": 3,
    },
  },
];


export const isDAG = (cy) => {
  let visited = {}; // Track visited nodes
  let recStack = {}; // Track nodes in the current recursion stack

  // Helper function to perform DFS, looking for cycles
  function dfs(node) {
    if (!visited[node.id()]) {
      visited[node.id()] = true;
      recStack[node.id()] = true;

      // Get successors of the node
      let neighbors = node.outgoers().nodes();

      for (let i = 0; i < neighbors.length; i++) {
        let neighbor = neighbors[i];
        if (!visited[neighbor.id()] && dfs(neighbor)) {
          return true; // Cycle found
        } else if (recStack[neighbor.id()]) {
          return true; // Cycle found
        }
      }
    }
    recStack[node.id()] = false; // Remove the node from recursion stack before backtrack
    return false; // No cycles found
  }

  // Iterate over all nodes to check for cycles, considering disconnected components
  for (let i = 0; i < cy.nodes().length; i++) {
    if (dfs(cy.nodes()[i])) {
      return false; // Graph is not a DAG
    }
  }
  return true; // No cycles detected, graph is a DAG
};

export const requestOptions = {
  method: "POST",
  headers: {
    Accept: "image/svg+xml",
  },
};

// create flat array of inchikeys and reactions
export const getFlatIds = (data) => {
  const flatArray = [];

  data.forEach((el) => {
    // we also need to filter out elements that already have svg
    if (el.data.inchikey && !el.data.svg) {
      flatArray.push(el.data.inchikey);
    }
    if (el.data.rxid) {
      flatArray.push(el.data.rxid);
    }
  });

  return flatArray;
};

export const mapStylesToCytoscape = (styles, appSettings) => {
  // clone it to prevent mutation
  const _styles = [...styles];

  // find the edge style and update it based on current app settings
  const edgeStyle = _styles.find((style) => style.selector === "edge");

  // additional check to prevent error if edgeStyle is not found
  if (edgeStyle) {
    edgeStyle.style["curve-style"] = appSettings.edgeCurveStyle;
  }

  return _styles;
};

export const findNodeOrEdgeInGraph = (graph, entityId) => {
  // First look in graph.nodes
  let entity = graph.nodes.find((node) => node.node_label === entityId);
  // If not found look in graph.edges
  if (!entity) {
    entity = graph.edges.find((edge) => edge.uuid === entityId);
  }
  return entity;
};

// Function to extract Base64 string from a data URL
export const extractBase64FromDataURL = (dataURL) => {
  // Check if the input is a data URL with SVG and base64 encoding
  const base64Prefix = "data:image/svg+xml;base64,";
  if (dataURL.startsWith(base64Prefix)) {
    // Remove the prefix and return only the Base64 string
    return dataURL.slice(base64Prefix.length);
  } else {
    throw new Error("Invalid SVG Base64 data URL format.");
  }
};

export const getSvgDimensions = (base64String) => {
  // Step 1: Decode the base64 string (removing the data URL part if present)
  const svgData = atob(base64String.split(",")[1]);

  // Step 2: Parse the decoded SVG string into an SVG DOM element
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgData, "image/svg+xml");
  const svgElement = svgDoc.documentElement;

  // Step 3: Extract width and height attributes
  const width = svgElement.getAttribute("width");
  const height = svgElement.getAttribute("height");

  // In case width/height are not set, check the viewBox for potential scaling dimensions
  if (!width || !height) {
    const viewBox = svgElement.getAttribute("viewBox");
    if (viewBox) {
      const viewBoxDimensions = viewBox.split(" ");
      return {
        width: viewBoxDimensions[2], // width from viewBox
        height: viewBoxDimensions[3], // height from viewBox
      };
    }
  }

  return {
    width: width || "unknown",
    height: height || "unknown",
  };
};

/**
 * Determines if the input string is in SMILES or InChIKey format.
 * @param {string} input - The chemical structure representation to validate
 * @returns {"inchikey" | "smiles" | "unknown"} The detected format type
 * @throws {Error} If input is null, undefined, or not a string
 */
export const isSMILESorInChIKey = (input) => {
  if (input == null || typeof input !== "string") {
    throw new Error("Input must be a non-null string");
  }

  // Regex for InChIKey: 27 characters, 2 dashes at positions 15 and 26
  const inchiKeyPattern = /^[A-Z0-9]{14}-[A-Z0-9]{10}-[A-Z0-9]{1,2}$/;

  // Basic pattern for SMILES (allows common characters used in SMILES)
  const smilesPattern = /^[A-Za-z0-9@+\-\[\]\(\)=#\$:%\.\\/,*{}~]+$/;

  if (inchiKeyPattern.test(input)) {
    return "inchikey";
  } else if (smilesPattern.test(input)) {
    return "smiles";
  } else {
    return "unknown";
  }
};

export const removeAllReagents = (graph) => {
  // first, find out all nodes that are reagents
  const reagents = Array.from(
    new Set(
      graph
        .filter((item) => item.data.edge_type === "reagent_of")
        .map((item) => item.data.source)
    )
  );

  // second, find out all nodes that are reactants
  const reactants = Array.from(
    new Set(
      graph
        .filter((item) => item.data.edge_type === "reactant_of")
        .map((item) => item.data.source)
    )
  );

  // third, find out all nodes that are reagents and not reactants
  const reagentsNotReactants = reagents.filter(
    (reagent) => !reactants.includes(reagent)
  );

  // now, filter out all edges for reagents, then - get rid of reagent nodes
  return graph
    .filter((item) => !reagentsNotReactants.includes(item.data.id))
    .filter((item) => item.data.edge_type !== "reagent_of");
};

export const duplicateGraphSubstances = (graph) => {
  /**
   * Function to duplicate nodes substances within a graph that are reagents/reactants in multiple reactions. Only
   * substances with the starting material role are duplicated.
   */
  // Clone the graph to prevent mutation
  let new_graph = JSON.parse(JSON.stringify(graph));
  const substance_nodes = {};
  const sm_edges_map = {};

  // Loop through all nodes to create substance node map
  for (const entity of new_graph) {
    if (entity.data.nodeType && entity.data.nodeType === "substance") {
      substance_nodes[entity.data.id] = entity;
    }
  }

  // Loop through all edges to create sm_edges_map map
  for (const entity of new_graph) {
    if (
      entity.data.edge_type &&
      (entity.data.edge_type === "reactant_of" ||
        entity.data.edge_type === "reagent_of")
    ) {
      const source = entity.data.source;
      if (substance_nodes[source].data.srole === "sm") {
        if (!sm_edges_map[entity.data.source]) {
          sm_edges_map[entity.data.source] = [];
        }
        sm_edges_map[entity.data.source].push(entity);
      }
    }
  }

  // Create list of nodes to duplicate
  const nodes_to_duplicate = Object.keys(sm_edges_map).filter(
    (key) => sm_edges_map[key].length > 1
  );

  // Duplicate nodes and update edges
  nodes_to_duplicate.forEach((node_id) => {
    const dup_count = sm_edges_map[node_id].length;

    // Remove the original node
    new_graph = new_graph.filter((item) => item.data.id !== node_id);

    // Duplicate nodes
    for (let i = 1; i <= dup_count; i++) {
      const new_node_id = `${node_id} (${i})`;

      // Add the new node
      new_graph.push({
        ...substance_nodes[node_id],
        data: {
          ...substance_nodes[node_id].data,
          id: new_node_id,
        },
      });

      // Update the corresponding edge
      const edge = sm_edges_map[node_id][i - 1];
      edge.data.source = new_node_id;
      edge.data.id = `${edge.data.id} (${i})`;
    }
  });

  return new_graph;
};

export const convertCytoscapeToNormalFormat = (cytoData) => {
  const convertedData = {};
  // Retain "availability" and "routes" from the original JSON
  if (cytoData.availability) {
    convertedData.availability = cytoData.availability;
  }
  if (cytoData.routes) {
    convertedData.routes = cytoData.routes;
  }

  // If there are nodes, process them
  if (cytoData.elements && cytoData.elements.nodes) {
    convertedData.nodes = cytoData.elements.nodes.map((node) => node.data);  // Extracting the `data` field from each node
  }

  // If there are edges, process them
  if (cytoData.elements && cytoData.elements.edges) {
    convertedData.edges = cytoData.elements.edges.map((edge) => edge.data);  // Extracting the `data` field from each edge
  }

  return convertedData;
};


export const parseASKCOSroutes = (ascosData) => {
  // Initialize the result structure
  const parsedData = {
    synth_graph: {
      nodes: [],
      edges: []
    },
    routes: {
      method: "ASKCOS",
      predicted: true,
      subgraphs: [],
      num_subgraphs: 0
    }
  };

  // Access the actual data from the 'result' field
  const result = ascosData?.result || {};

  // Parsing graph nodes
  const availability = [];
  result?.graph?.nodes?.forEach((node) => {
    const isReaction = node?.type === 'reaction';
    const isSubstance = node?.type === 'chemical';

    const nodeData = {
      node_label: node?.id,
      node_type: isReaction ? 'reaction' : 'substance',
      uuid: node?.id || '',
      route_assembly_type: {
        is_predicted: true,
        is_evidence: false,
      },
    };

    if (isReaction) {
      Object.assign(nodeData, {
        rxid: node?.template?.index || '',
        rxsmiles: node?.id || '',
        yield_info: {
          yield_predicted: node?.scscore || null,
          yield_score: node?.scscore || null
        },
        validation: {
          is_balanced: false
        },
      });
    } else if (isSubstance) {
      Object.assign(nodeData, {
        inchikey: node?.id || '',
        canonical_smiles: node?.id || '',
        srole: '',
      });
      if (isSubstance && node?.properties) {
        const availabilityItem = {
          inchikey: node?.id || '',
          inventory: {
            available: false,
            locations: [
              {
                smiles: node?.smiles || '',
                room: '',
                position: '',
                quantity_weight: '',
                unit: ''
              }
            ]
          },
          commercial_availability: {
            available: false,
            vendors: [
              {
                smiles: node?.smiles || '',
                source: '',
                ppg: '',
                lead_time: '',
                url: ''
              }
            ]
          }
        };
        availability.push(availabilityItem);
      }
    }

    parsedData.synth_graph.nodes.push(nodeData);
});

  const nodeTypeMap = {};
  parsedData.synth_graph.nodes.forEach((node) => {
    nodeTypeMap[node.node_label] = node.node_type;
  });


  // Parsing graph edges (links)
  result?.graph?.links?.forEach((link) => {
    const target = link?.target || '';
    const source = link?.source || '';

    const targetNodeType = nodeTypeMap[source];
    const edge_type = targetNodeType === 'reaction' ? 'reactant_of' : 'product_of';

    const edgeData = {
      start_node: target,
      end_node: source,
      edge_label: `${target}|${source}`,
      edge_type: edge_type,
      provenance: {
        is_in_aicp: false
      },
      uuid: `${target}|${source}`,
      inchikey: edge_type === "product_of" ? target : source,
      rxid: edge_type === "product_of" ? source : '',
      route_assembly_type: {
        is_predicted: true,
        is_evidence: false
      }
    };

    parsedData.synth_graph.edges.push(edgeData);
});

  assignSubstanceRoles(parsedData.synth_graph);

  // Parse routes
  parsedData.routes.subgraphs = [];
  parsedData.routes.num_subgraphs = result?.paths?.length || 0;

  const nodeIdToSmiles = new Map();
  result?.paths?.forEach((path) => {
    path?.nodes?.forEach((node) => {
      if (node?.id && node?.smiles) {
        nodeIdToSmiles.set(node.id, node.smiles);
      }
    });
  });
  
  result?.paths?.forEach((path, index) => {
    const subgraphData = {
      aggregate_yield: 0.0,
      route_index: index, 
      route_status: "Viable Route",
      route_node_labels: path?.nodes?.map((node) => node?.smiles || '') || [],
    };
    parsedData.routes.subgraphs.push(subgraphData);
  });


  // Filter availability to include only substances in route subgraphs
  const routeNodeLabels = new Set();
  parsedData.routes.subgraphs.forEach((subgraph) => {
    subgraph.route_node_labels.forEach((label) => routeNodeLabels.add(label));
  });

  parsedData.availability = availability.filter((item) =>
    routeNodeLabels.has(item.smiles)
  );
  return parsedData;
};


// Helper to assign 'srole' based on in/out degree
const assignSubstanceRoles = (synth_graph) => {
  const inDegrees = {};
  const outDegrees = {};

  // Initialize degrees
  synth_graph.nodes.forEach(node => {
    if (node.node_type === 'substance') {
      inDegrees[node.node_label] = 0;
      outDegrees[node.node_label] = 0;
    }
  });

  // Count in-degrees and out-degrees
  synth_graph.edges.forEach(edge => {
    const from = edge.start_node;
    const to = edge.end_node;

    if (from in outDegrees) {
      outDegrees[from]++;
    }
    if (to in inDegrees) {
      inDegrees[to]++;
    }
  });

  // Assign roles
  synth_graph.nodes.forEach(node => {
    if (node.node_type === 'substance') {
      const inDeg = inDegrees[node.node_label];
      const outDeg = outDegrees[node.node_label];

      if (outDeg === 0) {
        node.srole = "tm";  // terminal material
      } else if (inDeg === 0) {
        node.srole = "sm";  // starting material
      } else {
        node.srole = "im";  // intermediate
      }
    }
  });
};
