const rxnSmiles2RdkitSvgPath = "rxsmiles2svg";
const molSmiles2RdkitSvgPath = "molsmiles2svg";
const apiStatusPath = "status";
const computeAllBiPath = "compute_all_bi";


export const hasAtomMapping = (rxsmiles) => {
  // Check if the RXSMILES contains atom mapping by looking for atom map numbers in the format [n]
  const atomMappingRegex = /:\d+\]/;
  return atomMappingRegex.test(rxsmiles);
};

export const getReactionRdkitSvgByRxsmiles = async (baseUrl, rxsmiles, highlight) => {
  // Encode the rxsmiles string to ensure it's safely passed in the URL
  const encodedRxsmiles = encodeURIComponent(rxsmiles);

  // Construct the URL with query parameters
  const url = `${baseUrl.trim()}/${rxnSmiles2RdkitSvgPath}?rxsmiles=${encodedRxsmiles}&highlight=${highlight}&img_width=1800&img_height=600&base64_encode=true`;


  try {
    // Perform the GET request without a body and without headers
    const response = await fetch(url);

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    // Assuming the response contains an "svg" field
    const data = await response.json();
    return data["svg_base64"];
  } catch (error) {
    console.error("Error fetching SVG:", error);
    return null;
  }
};

// Fetch molecule full RDKIT SVG from inchikey
export const getMoleculeRdkitSvgBySmiles = async (baseUrl, smiles) => {
  // Construct the URL with query parameters
  const encodedSmiles = encodeURIComponent(smiles);
  const url = `${baseUrl.trim()}/${molSmiles2RdkitSvgPath}?mol_smiles=${encodedSmiles}&img_width=300&img_height=300&base64_encode=true`;

  try {
    // Perform the GET request without a body or custom headers
    const response = await fetch(url);

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    // Assuming the response contains an "svg" field
    const data = await response.json();
    return data["svg_base64"];
  } catch (error) {
    console.error("Error fetching SVG:", error);
    return null;
  }
};

export const checkApiStatus = async (baseUrl) => {
  try {
    const url = `${baseUrl.trim()}/${apiStatusPath}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    // Check if the response was successful (status 200-299)
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data; // This will return the data
  } catch (error) {
    console.error(error);
    return { error: true }; // This will return the error object if an error occurred
  }
};



export const getInchikeysFromGraph = (graph = []) => {
  return graph.filter(item => item.data.inchikey !== undefined).map(item => item.data.inchikey);
}


export const sendToCytoscape = async (baseUrl, cytoscapeJson) => {  // Receiving baseUrl as an argument
  if (!cytoscapeJson) {
    console.error("No graph data available.");
    return;
  }

  try {

    const uploadResponse = await fetch(`${baseUrl.trim()}/send_to_cytoscape/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cytoscapeJson),  // Directly use the passed cytoscapeJson
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload network.");
    }

    const uploadData = await uploadResponse.json();
    const networkId = uploadData.network_id;


  } catch (error) {
    console.error("Error sending to Cytoscape:", error.message);
  }
};

export const normalizeRoles = async (baseUrl, rxsmiles) => {
  const url = `${baseUrl.trim()}/normalize_roles`;
  const body = JSON.stringify({ rxsmiles });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body,
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const data = await response.json();
    return data.rxsmiles; // Return normalized RXSMILES
  } catch (error) {
    console.error("Error normalizing RXSMILES:", error);
    return null;
  }
};

export const compute_balance = async (baseUrl, rxsmiles) => {
  // Ensure rxsmiles is provided
  if (!rxsmiles) {
    console.error("Error: rxsmiles parameter is required.");
    return null;
  }

  // Construct the API endpoint URL with the rxsmiles parameter
  const url = `${baseUrl.trim()}/${computeAllBiPath}?rxsmiles=${encodeURIComponent(rxsmiles)}`;

  try {
    // Perform the GET request
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });


    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    // Parse the JSON response
    const data = await response.json();
    return data; // { pbi: ..., rbi: ..., tbi: ... }
  } catch (error) {
    console.error("Error fetching BI values:", error);
    return null;
  }
};

// Helper function to call convert2aicp endpoint
export const convert2aicp = async (ascosData, askcosRoute) => {
  const apiUrl = `${process.env.API_URL || "http://0.0.0.0:5099"}/convert2aicp`;
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ graph_data: ascosData, convert_askcos: askcosRoute }),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const data = await response.json();
    return data; // Return the converted data
  } catch (error) {
    console.error("Error calling convert2aicp:", error);
    return null;
  }
};
