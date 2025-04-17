# aspire-network-visualizer

1.  [Prerequisite](#prerequisite)
2.  [Installation](#installation)
3.  [Visualize data using JSON examples](#visualize-data-using-json-examples)
4.  [JSON data structure explained](#json-data-structure-explained)
5.  [App settings](#app-settings)
6.  [Running containers on custom ports](#running-containers-on-custom-ports)
7.  [Features](#features)

## Features

### Node Styles
- **Reaction Nodes**: Always displayed as red rectangles unless `is_valid` is `false`, in which case they are displayed as red circles.

- **is_valid**: This feature validates reaction nodes to determine their correctness. The `is_valid` field is displayed in the entity information panel for reaction nodes, providing users with immediate feedback on the validity of reactions.
- **normalize_roles**: This function reassigns the roles of substances (reactants, reagents, and products) in a reaction SMILES (RXSMILES) string based on atom mapping. It ensures consistency by:
  1. Checking for atom mapping in the RXSMILES.
  2. Parsing the RXSMILES into reactants, reagents, and products.
  3. Reassigning roles:
     - Reactants with no atom mapping overlap with products are reassigned as reagents.
     - Reagents with atom mapping overlap with products are reassigned as reactants.
  4. Reconstructing the RXSMILES with updated roles:
     - Reactants are placed on the left side of the RXSMILES (before the first `>` delimiter).
     - Reagents are placed in the middle section (between the first and second `>` delimiters).
     - Products are placed on the right side (after the second `>` delimiter).
     - During the role normalization process, the fragment indices in the fragment-section of the RXSMILES extension (|f:u.v,w.x|) are automatically updated as necessary to reflect the position of the fragments of substances at the end of the process.

- **Send To Cytoscape Button**: Allows users to send the current graph to Cytoscape. Ensure Cytoscape is running in the background for this feature to work.
- **Route Selection Dropdown**: Includes the "SynthGraph" option to view the synthesis graph itself. Evidence routes are labeled as "Evidence 0", "Evidence 1", etc., and predicted routes are labeled as "Predicted 0", "Predicted 1", etc. For massive graphs with cycles (e.g., ASKCOS examples), use the force-directed layout for rendering.
- **AICP/Cytoscape JSON Toggle**: Enables users to view JSON data in different formats, including AICP and Cytoscape formats.
- **Upload JSON Functionality**: Provides options to upload JSON files, Cytoscape JSON files, and select example graphs from a dropdown menu. Users can also refer to the Jupyter notebook example for uploading JSON or use the Swagger documentation available at [http://0.0.0.0:5099/api/v1/docs/aicp/nv_api](http://0.0.0.0:5099/api/v1/docs/aicp/nv_api).
- **Example Graphs**: Includes two evidence-based route examples and an ASKCOS Route Sample. The ASKCOS Route Sample is parsed and converted internally into the graph format before rendering.
- **Aggregate Yield Display**: Displays aggregate yield as "Agg Yield" on top of the graph for better visualization.
- **User Settings**: Offers various settings that users can toggle to customize their experience, including graph rendering options and visualization preferences.




1.  [Prerequisite](#prerequisite)
2.  [Installation](#installation)
3.  [Visualize data using JSON examples](#visualize-data-using-json-examples)
4.  [JSON data structure explained](#json-data-structure-explained)
    * [Nodes structure](#nodes-structure)
    * [Edges structure](#edges-structure)
5.  [App settings](#app-settings)
6.  [Running containers on custom ports](#running-containers-on-custom-ports)

## Prerequisite

Required software you need to be installed before you move to visualizer installation step:
* Any web-browser

Optional (not required, but nice to have):
* [Git](https://git-scm.com/)

## Environment Variables

---

### Using Docker (Recommended)

#### For Mac Users:
1. Set the default Docker platform:
   ```bash
   export DOCKER_DEFAULT_PLATFORM=linux/amd64
   ```

2. Build the Docker containers:
   ```bash
   docker-compose build
   ```

3. Start the containers:
   ```bash
   docker-compose up -d
   ```

4. Open the Swagger documentation in your browser:
   [http://0.0.0.0:5099/api/v1/docs/aicp/nv_api](http://0.0.0.0:5099/api/v1/docs/aicp/nv_api)

5. Open the front-end application in your browser:
   [http://localhost:4204/](http://localhost:4204/)



### Visualize data using JSON examples

You can use attached JSON examples (check `json-examples` folder) to render some prepared graphs:

![Alt](/images/Example.png "How to visualize graph using JSON files")

When you open the front-end application, a room ID will be assigned to you. You can find this room ID in the URL after `/room/`. If you want to use the `upload_json_to_ui` endpoint, you need to paste this room ID into the request payload as shown in the Jupyter notebook example.

In the following section we'll describe basic graph structure, so you can create and render your own datasets.

## JSON data structure explained

If you open any of the attached to this repo examples in JSON format - you may notice, that graph structure is as simple as the following pattern:

```
{
  "synth_graph": {
    "nodes": [],
    "edges": []
  },
  "routes": {
    "subgraphs": [
      {
        "aggregate_yield": 58.,
        "route_index": 1,
        "route_status": "Viable Route Candidate",
        "method": "AICP",
        "route_node_labels": [...
        ]
      }
    ],
    "predicted": false,
    "num_subgraphs": 1
  }
}
```

Where `nodes` is an array of graph nodes, and `edges` - array of graph edges (connectors between the nodes).

<hr>

### Nodes structure

Mandatory fields/attributes are marked with `*`.

| Attribute | Description |
| --- | --- |
| `node_type`* | Type of the node, can be: `reaction` (represented by red circle) or `substance` (square box, shading depending on the `srole`, see below) |
| `node_label`* | Label for the node displayed on hover |
| `srole`* | _Works with substance nodes only:_ can be `sm` (**starting material**), `tm` (**target molecule**) or `im` (**intermediate material**) that are shaded by yellow, blue, and gray, respectively. |
| `canonical_smiles` | _Works with substance nodes only:_ Canonical SMILES representation of the substance. |
| `base64svg` | If you want to include an image for the node, you can do that using this parameter. Check [this section](#showing-graphical-content-inside-the-nodes) for details |
| `uuid` | Unique identifier for the node |
| `rxid` | _Works with reaction nodes only:_ The reaction identifier |
| `rxsmiles` | _Works with reaction nodes only:_ SMILES representation of the reaction |
| `yield_info` | _Works with reaction nodes only:_ Contains information on predicted yield and yield score. Options: <br> - `yield_predicted`: Predicted yield value <br> - `yield_score`: Yield score (e.g., a numerical score) |
| `provenance` | _Works with reaction nodes only:_ Indicates if the reaction is in the USPTO and SAVI. Options: <br> - `is_in_uspto`: Boolean indicating if the reaction is in USPTO <br> - `is_in_savi`: Boolean indicating if the reaction is in SAVI <br> - `Patents`: Optional list of patent names associated with the reaction |
| `rxname` | _Works with reaction nodes only:_ Name of the reaction. |
| `is_rxname_recognized` | _Works with reaction nodes only:_ Indicates whether the reaction name is recognized. |
| `rxclass` | _Works with reaction nodes only:_ Class of the reaction. |
| `conditions_info` | _Works with reaction nodes only:_ Optional field containing `conditions_text`, which is a paragraph describing the reaction conditions. |
| `route_assembly_type` | _Works with both node types:_ Indicates whether the route is predicted or based on evidence. Options: <br> - `is_predicted`: Boolean indicating if the route is predicted <br> - `is_evidence`: Boolean indicating if the route is based on evidence |


<hr>

### Edges structure

In the following table below you'll find all supported parameters for the **edges**:

| Attribute | Description |
| --- | --- |
| `edge_type` | Type of the edge, its color depends on the type: `product_of` (orange line), `reactant_of` (blue line) or `reagent_of` (gray line) |
| `start_node` | Node label for the node at the beginning of the edge |
| `end_node` | Node label for the node at the end of the edge |

---

### Manual Setup (Without Docker)


#### UI Setup
1. Navigate to the `ui` directory:
   ```bash
   cd ui/
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   export API_URL=http://0.0.0.0:5099
   export REACT_APP_API_URL=http://localhost:4204/
   npm run start
   ```
4. Open the application in your browser:
   [http://localhost:4204/](http://localhost:4204/)

#### API Setup

##### If you need to install packages:
1. Navigate to the `api` directory:
   ```bash
   cd ./api
   ```
2. Run the development setup script:
   ```bash
   export API_URL=http://0.0.0.0:5099
   export REACT_APP_API_URL=http://localhost:4204/
   bash ./run.sh --dev
   ```

##### If packages are already installed:
1. Run the development setup script with the `--skip-env-setup` flag:
   ```bash
   export API_URL=http://0.0.0.0:5099
   export REACT_APP_API_URL=http://localhost:4204/
   bash ./run.sh --dev --skip-env-setup

2. Open the Swagger documentation in your browser:
   [http://0.0.0.0:5099/api/v1/docs/aicp/nv_api](http://0.0.0.0:5099/api/v1/docs/aicp/nv_api)

---

## Pulling Updates

To ensure you have the latest updates for this repository, you can use the following command:

```bash
git pull
```

This will fetch and merge changes from the remote repository into your local copy.
