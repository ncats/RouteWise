# aspire-network-visualizer

To work on the prototype development branch, use the following command:

```
git checkout prototype_dev
```
New light-weight version of the Network Visualizer for graph rendering and network investigation.

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

## Installation and Deployment

### Clone the Repository

#### If you have Git installed:
* via HTTPS: 
    ```bash
    git clone https://github.com/ncats/aspire-network-visualizer.git
    ```
* via SSH: 
    ```bash
    git clone git@github.com:ncats/aspire-network-visualizer.git
    ```

#### If you DON'T have Git installed:
* Find the green button named "Code" and click on it.
* Click "Download ZIP" link at the bottom of the list.
* Once downloaded, unzip the code and open the terminal at the root of the unzipped folder.

![Alt](/images/git-zip.png "Download ZIP archive")

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

4. Access the application:
   - UI: [http://localhost:4204/](http://localhost:4204/)
   - API: [http://0.0.0.0:5099](http://0.0.0.0:5099)

---

### Visualize data using JSON examples

You can use attached JSON examples (check `json-examples` folder) to render some prepared graphs:

![Alt](/images/json.gif "How to visualize graph using JSON files")

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

| Attribute | Description |
| --- | --- |
| `node_type` | Type of the node, can be: `reaction` (represented by red circle) or `substance` (gray square box) |
| `node_label` | Label for the node displayed on hover |
| `srole` | _Works with substance nodes only:_ can be `sm` (**starting material**), `tm` (**target molecule**) or `im` (**intermediate material**). We use different colors depending on the node role, so you can easily find e.g. target molecule in a big graph |
| `base64svg` | If you want to include an image for the node, you can do that using this parameter. Check [this section](#showing-graphical-content-inside-the-nodes) for details |
| `uuid` | Unique identifier for the node |
| `rxid` | _Works with reaction nodes only:_ The reaction identifier |
| `rxsmiles` | _Works with reaction nodes only:_ SMILES representation of the reaction |
| `yield_info` | _Works with reaction nodes only:_ Contains information on predicted yield and yield score. Options: <br> - `yield_predicted`: Predicted yield value <br> - `yield_score`: Yield score (e.g., a numerical score) |
| `provenance` | _Works with reaction nodes only:_ Indicates if the reaction is in the USPTO and SAVI. Options: <br> - `is_in_uspto`: Boolean indicating if the reaction is in USPTO <br> - `is_in_savi`: Boolean indicating if the reaction is in SAVI |
| `validation` | _Works with reaction nodes only:_ Indicates whether the reaction is balanced or not. Options: <br> - `is_balanced`: Boolean indicating if the reaction is balanced |
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
   bash ./run.sh --dev
   ```

##### If packages are already installed:
1. Run the development setup script with the `--skip-env-setup` flag:
   ```bash
   bash ./run.sh --dev --skip-env-setup
   ```
2. Open the API in your browser:
   [http://0.0.0.0:5099](http://0.0.0.0:5099)
