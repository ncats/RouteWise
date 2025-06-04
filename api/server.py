# Author: Ilia Vorontcov, Nathan Miller, Brandon Walker
#
# Organization: National Center for Advancing Translational Sciences (NCATS/NIH)

from enum import Enum
from typing import List, Optional, Union
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Body
from pydantic import ConfigDict, ValidationError, BaseModel
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import requests
import uuid
import logging
from uvicorn.logging import DefaultFormatter
import json
import asyncio
from askcos_models import TreeSearchResponse
from draw_utils import reaction_smiles_to_image
from askcos_conversion_utils import (
    NoPathsFoundInAskcosResponse,
    NoResultFoundInAskcosResponse,
    askcos_tree2synth_paths_with_graph
)
from rdkit import Chem
from rdkit.Chem import Draw
import base64
import role_assigner_utils
from api_models import (
    NormalizeRoleRequest,
    NormalizeRoleResponse,
    ConvertToAicpRequest,
)
from role_assigner_utils import RxsmilesAtomMappingException
import re
from werkzeug.utils import secure_filename
from collections.abc import MutableMapping


CYTOSCAPE_URL = os.getenv("CYTOSCAPE_URL", "http://localhost:1234/v1")
DEFAULT_STYLE_NAME = "New SynGPS API"

# Set up logging
formatter = DefaultFormatter(fmt="%(levelname)s: %(message)s")
handler = logging.StreamHandler()
handler.setFormatter(formatter)

# Create a logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger.setLevel(logging.INFO)
logger.addHandler(handler)

# Create Swagger Docs URL and attach it to the app
docs_base = os.getenv("url_api_docs_base", "/api/v1/docs/aicp")
alias = os.getenv("network_alias_rw_api", "rw_api")
docs_url = (
    docs_base
    + "/"
    + alias.split("-")[0].strip()
)
openapi_url = docs_url + "/openapi.json"

# Create a FastAPI app
app = FastAPI(openapi_url=openapi_url, docs_url=docs_url)

# Hardcoded Cytoscape style
new_style_json = {
    "title": DEFAULT_STYLE_NAME,
    "defaults": [
        {"visualProperty": "NODE_SIZE", "value": 40},
        {"visualProperty": "EDGE_LINE_TYPE", "value": "SOLID"},
        {"visualProperty": "EDGE_WIDTH", "value": 2},
        {"visualProperty": "EDGE_CURVED", "value": False},
        {"visualProperty": "EDGE_TARGET_ARROW_SHAPE", "value": "DELTA"}
    ],
    "mappings": [
        {
            "mappingType": "discrete",
            "mappingColumn": "srole",
            "mappingColumnType": "String",
            "visualProperty": "NODE_FILL_COLOR",
            "map": [
                {"key": "tm", "value": "#4C8DA6"},
                {"key": "im", "value": "#AAAAAA"},
                {"key": "sm", "value": "#D8C571"}
            ]
        },
        {
            "mappingType": "discrete",
            "mappingColumn": "node_type",
            "mappingColumnType": "String",
            "visualProperty": "NODE_SHAPE",
            "map": [
                {"key": "substance", "value": "ROUND_RECTANGLE"},
                {"key": "reaction", "value": "ELLIPSE"}
            ]
        },
        {
            "mappingType": "discrete",
            "mappingColumn": "edge_type",
            "mappingColumnType": "String",
            "visualProperty": "EDGE_STROKE_UNSELECTED_PAINT",
            "map": [
                {"key": "product_of", "value": "#EC7014"},
                {"key": "reactant_of", "value": "#225EA8"},
                {"key": "reagent_of", "value": "#00FFFF"}
            ]
        },
        {
            "mappingType": "discrete",
            "mappingColumn": "edge_type",
            "mappingColumnType": "String",
            "visualProperty": "EDGE_TARGET_ARROW_UNSELECTED_PAINT",
            "map": [
                {"key": "product_of", "value": "#EC7014"},
                {"key": "reactant_of", "value": "#225EA8"},
                {"key": "reagent_of", "value": "#225EA8"}
            ]
        },
        {
            "mappingType": "passthrough",
            "mappingColumn": "node_label",
            "mappingColumnType": "String",
            "visualProperty": "NODE_LABEL"
        }
    ]
}

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,  # Allow cookies to be sent
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


# Directory to persist data
DATA_DIR = "data"

# Ensure the data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Check if filename is valid


def is_valid_filename(filename):
    # Only allow alphanumerics, dashes, underscores, and a single dot for .json
    # Filename should not contain directory separators or more than one dot
    return (
        re.match(r'^[\w\-]+$', filename) is not None
    )

# Save room data


def save_room_data(room_id, data):
    # Step 1: Clean filename using werkzeug
    filename = secure_filename(room_id)

    # Step 2: Custom validation
    if not is_valid_filename(filename):
        raise ValueError(f"Invalid room ID: {room_id}")

    # Step 3: Save as .json
    room_file = os.path.join(DATA_DIR, f"{filename}.json")
    with open(room_file, "w") as file:
        json.dump(data, file)

# Load example payload


def load_example_payload():
    # Determine the base path for the data directory
    DATA_DIR = os.getenv("DATA_DIR", os.path.join("..", "data"))

    with open(os.path.join(DATA_DIR, "json_example_1.json"), "r") as file:
        return json.load(file)

# Redirect root endpoint to Swagger docs


@app.get("/")
async def root():
    return {"message": "Welcome to the FastAPI server. Visit /api/v1/docs/aicp/rw_api for API documentation."}


async def get_room_data(room_id: str):
    room_file = os.path.join(DATA_DIR, f"{room_id}.json")
    if not os.path.exists(room_file):
        raise HTTPException(status_code=404, detail="Room not found")
    with open(room_file, "r") as file:
        room_data = json.load(file)
    return room_data

# Add simple status endpoint to return 200


@app.get("/status")
async def status():
    return {"status": "OK"}


class Node(BaseModel):
    node_label: str
    node_type: str
    uuid: str
    route_assembly_type: Optional[dict] = None
    provenance: Optional[dict] = None


class ReactionNode(Node):
    validation: Optional[dict] = None
    yield_info: Optional[dict] = None
    rxsmiles: Optional[str] = None
    rxid: Optional[str] = None
    rxclass: Optional[str] = None
    rxname: Optional[str] = None
    original_rxsmiles: Optional[str] = None
    evidence_protocol: Optional[dict] = None
    evidence_conditions_info: Optional[dict] = None
    predicted_conditions_info: Optional[dict] = None


class SubstanceNode(Node):
    srole: Optional[str] = None
    inchikey: Optional[str] = None
    canonical_smiles: Optional[str] = None


class Edge(BaseModel):
    start_node: Optional[str] = None
    end_node: Optional[str] = None
    edge_label: Optional[str] = None
    edge_type: Optional[str] = None
    uuid: Optional[str] = None
    route_assembly_type: Optional[dict] = None
    provenance: Optional[dict] = None


class SynthGraph(BaseModel):
    # Define model configuration
    model_config = ConfigDict(extra="ignore", arbitrary_types_allowed=True)

    nodes: list[Union[ReactionNode, SubstanceNode]]
    edges: list[Edge]


class Route(BaseModel):
    aggregated_yield: Optional[float] = None
    route_index: Optional[int] = None
    route_status: Optional[str] = None
    method: Optional[str] = None
    predicted: Optional[bool] = None
    route_node_labels: list[str]


class Availability(BaseModel):
    inchikey: Optional[str] = None
    inventory: Optional[dict] = None
    commercial_availability: Optional[dict] = None


class InputFile(BaseModel):
    synth_graph: Optional[SynthGraph] = None
    predictive_synth_graph: Optional[SynthGraph] = None
    routes: Optional[List[Route]] = None
    availability: Optional[list[Availability]] = None


class ConvertFromOptions(str, Enum):
    askcos = "askcos"
    # Add more options here in the future, e.g.


@app.post("/upload_json_body/")
async def upload_json_body(
    room_id: str = Query(...),
    convert_to_aicp: bool = Query(False),
    convert_from: Optional[ConvertFromOptions] = Query(None),
    json_data: dict = Body(..., example=load_example_payload())
):
    """
    Upload JSON data to a specific room. The 'room_id' parameter specifies the room to which the data should be uploaded.
    A Room ID can be found in the URL after '?room_id=<room_id>'.

    **Query Parameters**:
    - `room_id` (str, required): The unique room identifier. This should match the room ID in the frontend URL, e.g., `/room/<room_id>`.
    - `convert_to_aicp` (bool, optional): If set to `true`, must be paired with 'convert_from' to convert the uploaded data to AICP format.
    - `convert_from` (str, optional): If set to 'askcos', the uploaded data will be converted from ASKCOS format before being processed.

    **Request Body**:
    - `json_data` (dict): The JSON payload representing a reaction or synthesis graph. The structure must match the expected schema. See example in Swagger UI or refer to `public/json_example_1.json`.

    If `convert_to_aicp` is enabled, the `json_data` will be transformed to AICP format before validation and storage.

    **Returns**:
    Returns the validated data as confirmation.
    """
    logger.info(
        f"[JSON Body] Room ID: {room_id}, convert_to_aicp: {convert_to_aicp}, convert_from: {convert_from}")

    if room_id not in room_connections:
        raise HTTPException(
            status_code=400, detail=f"Invalid room ID: {room_id}")

    try:
        if convert_to_aicp and convert_from == ConvertFromOptions.askcos:
            json_data = await _convert_to_aicp(ConvertToAicpRequest(source_data=json_data, convert_from="askcos"))
        elif convert_to_aicp:
            raise HTTPException(
                status_code=400, detail=f"Invalid conversion source: {convert_from}")

        validated_data = InputFile(**json_data)
        save_room_data(room_id, validated_data.dict())

        try:
            await room_connections[room_id].send_json({
                "type": "new-graph",
                "room_id": room_id,
                "data": validated_data.dict()
            })
        except Exception as e:
            logger.warning(f"WebSocket send error: {e}")

        return {"data": validated_data.dict()}

    except (json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")


@app.post("/upload_json_file/")
async def upload_json_file(
    room_id: str = Form(...,
                        description="Room ID to associate the uploaded file with", example=""),
    convert_to_aicp: bool = Query(False),
    convert_from: Optional[ConvertFromOptions] = Query(None),
    file: UploadFile = File(...)
):
    """
    Upload a JSON file containing reaction or synthesis data to a specific room. The 'room_id' parameter specifies the room to which the data should be uploaded.
    A Room ID can be found in the URL after '?room_id=<room_id>'.

    **Form Fields (multipart/form-data)**:
    - `room_id` (str, required): The room ID to associate with the uploaded data. This should match the ID found in the frontend URL (`/room/<room_id>`).
    - `convert_to_aicp` (bool, optional): If set to `true`, must be paired with 'convert_from' to convert the uploaded data to AICP format.
    - `convert_from` (str, optional): If set to 'askcos', the uploaded data will be converted from ASKCOS format before being processed.

    **File Upload**:
    - `file` (UploadFile, required): A `.json` file containing a reaction or synthesis graph. The structure must conform to the expected schema. Example files can be found in: `ui/public/`

    Additionally, if you have the UI running you can download JSON examples from the following:
    - [JSON Example 1](http://localhost:4204/public/json_example_1.json)
    - [JSON Example 2](http://localhost:4204/public/json_example_2.json)
    - [Hybrid Routes Example](http://localhost:4204/public/hybrid_routes_example.json)
    - [Predicted Routes Example](http://localhost:4204/public/askcos_route_sample.json) **Note: 'convert_to_aicp' must be set to 'true' to upload this file.**

    This endpoint expects a `multipart/form-data` request. Upon successful upload and optional format conversion, the data is validated and broadcast to all WebSocket connections associated with the specified room.

    **Returns**:
    A JSON object containing the validated and processed data.
    """
    logger.info(
        f"[File Upload] Room ID: {room_id}, convert_to_aicp: {convert_to_aicp}, convert_from: {convert_from}")

    if room_id not in room_connections:
        raise HTTPException(
            status_code=400, detail=f"Invalid room ID: {room_id}")

    try:
        file_content = await file.read()
        json_data = json.loads(file_content)

        if convert_to_aicp and convert_from == ConvertFromOptions.askcos:
            json_data = await _convert_to_aicp(ConvertToAicpRequest(source_data=json_data, convert_from="askcos"))
        elif convert_to_aicp:
            raise HTTPException(
                status_code=400, detail=f"Invalid conversion source: {convert_from}")

        validated_data = InputFile(**json_data)
        save_room_data(room_id, validated_data.dict())

        try:
            await room_connections[room_id].send_json({
                "type": "new-graph",
                "room_id": room_id,
                "data": validated_data.dict()
            })
        except Exception as e:
            logger.warning(f"WebSocket send error: {e}")

        return {"data": validated_data.dict()}

    except (json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")

# WebSocket endpoint
# Maintain a mapping of room IDs to WebSocket connections
room_connections: dict[str, WebSocket] = {}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for handling WebSocket connections.
    """
    # Generate a unique room ID
    while True:
        room_id = str(uuid.uuid4())
        if room_id not in room_connections:
            break
    room_connections[room_id] = websocket

    await websocket.accept()
    logger.info(f"New WebSocket connection established for room_id: {room_id}")
    await websocket.send_json({"type": "new-room", "room_id": room_id})

    try:
        while True:
            try:
                # Search the data directory for any .json file and extract room ID and room data
                for file_name in os.listdir(DATA_DIR):
                    if file_name.endswith(".json"):
                        room_id_from_file = file_name.split(".json")[0]
                        with open(os.path.join(DATA_DIR, file_name), "r") as file:
                            room_data = json.load(file)
                            if room_id_from_file in room_connections:
                                try:
                                    await room_connections[room_id_from_file].send_json({"type": "new-graph", "room_id": room_id, "data": room_data})
                                except RuntimeError as e:
                                    logger.warning(
                                        f"Failed to send data to WebSocket for room {room_id_from_file}: {e}")
                            # Send data and delete the file after successful transmission
                        # Define a whitelist of filenames to exclude from deletion
                        whitelist = ["json_example_1.json", "json_example_2.json", "askcos_route_sample.json", "hybrid_routes_example.json"]
                        if file_name not in whitelist:
                            os.remove(os.path.join(DATA_DIR, file_name))
                # Keep the WebSocket connection alive
                await asyncio.sleep(1)
            except asyncio.TimeoutError:
                # Handle timeout
                pass
    except WebSocketDisconnect:
        # Log the disconnection and remove the WebSocket connection from the mapping
        logger.warning(
            f"WebSocket disconnected for room {room_id}. Removing connection.")
        if room_id in room_connections:
            logger.info(
                f"Removing room_id {room_id} from room_connections due to WebSocket closure")
            room_connections.pop(room_id, None)


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down... closing all WebSocket connections.")
    for room_id, websocket in room_connections.items():
        try:
            await websocket.close()
        except Exception as e:
            logger.warning(f"Error closing websocket for room {room_id}: {e}")
    room_connections.clear()


################
# HTML Content
################

# Read HTML content from file


def get_html_content(file_path: str) -> str:
    with open(file_path, 'r') as file:
        return file.read()

# Serve HTML content, hide from swagger


@app.get("/ws-test", include_in_schema=False)
async def getWsTestHtml():
    html_content = get_html_content("websocket_validation.html")
    return HTMLResponse(html_content)


###################
# Helper Endpoints
###################

# Endpoint to convert reaction smiles to SVG
@app.get("/rxsmiles2svg")
async def rxsmiles_to_svg_endpoint(rxsmiles: str = 'CCO.CC(=O)O>>CC(=O)OCC.O', highlight: bool = True, base64_encode: bool = True, show_atom_indices: bool = False):
    """
    Generates an SVG for a given reaction SMILES string.

    Args:
    - rxsmiles (str): The reaction SMILES string.
    - highlight (bool): Whether to highlight the reactants and products.
    - base64_encode (bool): Whether to encode the SVG as base64.
    - show_atom_indices (bool): Whether to show atom indices in the SVG.

    Returns:
    - If base64_encode is True, returns a JSON response with the original reaction SMILES and the base64-encoded SVG.
    - If base64_encode is False, returns a JSON response with the original reaction SMILES and the SVG.
    """
    try:
        svg = reaction_smiles_to_image(rxsmiles, align=False, transparent=False,
                                       highlight=highlight, retro=False, show_atom_indices=show_atom_indices)
        svg = svg.replace('"', "'")
    except Exception as e:
        svg = """
        <svg width="450" height="75" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="white" />
          <text x="10" y="50" font-size="32" fill="black">Unable to generate reaction SVG</text>
        </svg>
        """.strip()

    if base64_encode:
        svg = base64.b64encode(svg.encode('utf-8')).decode('utf-8')
        return JSONResponse(content={"rxsmiles": rxsmiles, "svg_base64": svg})
    else:
        return JSONResponse(content={"rxsmiles": rxsmiles, "svg": svg})

# Endpoint to convert molecule SMILES to SVG


@app.get("/molsmiles2svg")
async def smiles_to_svg_endpoint(mol_smiles: str = 'Cc1cc(Br)cc(C)c1C1C(=O)CCC1=O', img_width: int = 300, img_height: int = 300, base64_encode: bool = True):
    """
    Generates an SVG for a given molecule SMILES string.

    Args:
    - mol_smiles (str, optional): The SMILES string of the molecule to be drawn. Defaults to 'Cc1cc(Br)cc(C)c1C1C(=O)CCC1=O'.
    - img_width (int, optional): The width of the SVG image. Defaults to 300.
    - img_height (int, optional): The height of the SVG image. Defaults to 300.
    - base64_encode (bool, optional): Whether to encode the SVG as a base64 string. Defaults to True.

    Returns:
    - JSONResponse: A JSON response containing the SMILES string and either the SVG string or the base64-encoded SVG string.
    """
    if not mol_smiles:
        logger.error("Empty SMILES string provided")
        raise HTTPException(
            status_code=400, detail="Empty SMILES string provided")

    mol = Chem.MolFromSmiles(mol_smiles)
    if mol is None:
        logger.error(f"Invalid SMILES string: {mol_smiles}")
        raise HTTPException(
            status_code=400, detail=f"Invalid SMILES string: {mol_smiles}")

    d2d = Draw.MolDraw2DSVG(img_width, img_height)
    try:
        d2d.DrawMolecule(mol)
    except Exception as e:
        logger.error(f"Failed to draw molecule: {mol_smiles}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to draw molecule: {mol_smiles}")
    d2d.FinishDrawing()

    svg = d2d.GetDrawingText()
    if base64_encode:
        svg = base64.b64encode(svg.encode('utf-8')).decode('utf-8')
        return JSONResponse(content={"smiles": mol_smiles, "svg_base64": svg})
    else:
        return JSONResponse(content={"smiles": mol_smiles, "svg": svg})


# Create style function
def create_style(style_name, style_json):
    """Creates a new style if it does not exist."""
    try:
        # Check if the style already exists
        existing_styles_response = requests.get(f"{CYTOSCAPE_URL}/styles")

        # Check if the request was successful
        if existing_styles_response.ok:
            existing_styles = existing_styles_response.json()
            print("Existing styles:", existing_styles)  # Debug print

            # Check if the style already exists
            if style_name in existing_styles:
                print(
                    f"Style '{style_name}' already exists. Applying existing style.")
                return True  # Style already exists
            else:
                print(f"Creating new style '{style_name}'.")

                # Create the new style in Cytoscape
                create_style_response = requests.post(
                    f"{CYTOSCAPE_URL}/styles", json=style_json)
                if create_style_response.ok:
                    print(f"New style '{style_name}' created.")
                    return True
                else:
                    print("Failed to create new style.")
        else:
            print("Failed to retrieve existing styles.")
    except requests.exceptions.RequestException as e:
        print(f"Error creating style: {e}")

    return False

# Apply style function


def apply_style(network_suid, style_name):
    """Applies the style to the network."""
    style_json = new_style_json
    if not create_style(style_name, style_json):
        print(f"Failed to create or apply style '{style_name}'.")
        return {"error": "Failed to create or apply style."}

    try:
        # Apply the style to the network
        apply_style_response = requests.get(
            f"{CYTOSCAPE_URL}/apply/styles/{style_name}/{network_suid}")
        if apply_style_response.ok:
            print(
                f"Style '{style_name}' applied to the network {network_suid}.")
            return {"success": f"Style '{style_name}' applied to the network {network_suid}."}
        else:
            print(f"Failed to apply style '{style_name}'.")
    except requests.exceptions.RequestException as e:
        print(f"Error applying style: {e}")

    return {"error": f"Failed to apply style '{style_name}'."}

# Apply layout function


def apply_layout(network_suid, layout_type):
    """Applies the layout to the network."""
    try:
        # Apply the layout
        apply_layout_response = requests.get(
            f"{CYTOSCAPE_URL}/apply/layouts/{layout_type}/{network_suid}")
        if apply_layout_response.ok:
            print(
                f"Layout '{layout_type}' applied to the network {network_suid}.")
            return {"success": f"Layout '{layout_type}' applied to the network {network_suid}."}
        else:
            print(f"Failed to apply layout '{layout_type}'.")
    except requests.exceptions.RequestException as e:
        print(f"Error applying layout: {e}")

    return {"error": f"Failed to apply layout '{layout_type}'."}


def flatten_dict(d, parent_key='', sep='_'):
    """
    Flattens a nested dictionary. For example:
    {"a": {"b": 1}} → {"a_b": 1}
    """
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, MutableMapping):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def convert_to_cytoscape_json(aicp_graph, synth_graph_key="synth_graph", predicted_route=False):
    synth_graph = aicp_graph[synth_graph_key]
    routes = aicp_graph.get("routes", [])

    if not routes:
        raise ValueError("No routes found in the 'routes' object.")

    route = routes[0]
    route_node_labels = set(route["route_node_labels"])

    # Flatten node properties and include "id"
    filtered_nodes = [
        {"data": {**flatten_dict(node), "id": node["node_label"]}}
        for node in synth_graph["nodes"]
        if node["node_label"] in route_node_labels
    ]

    if predicted_route:
        for node in filtered_nodes:
            if node["data"]["node_type"].lower() == "substance":
                node["data"]["node_label"] = node["data"]["inchikey"]

    # Flatten edge properties and include "source"/"target"
    filtered_edges = [
        {"data": {
            **flatten_dict(edge), "source": edge["start_node"], "target": edge["end_node"]
        }}
        for edge in synth_graph["edges"]
        if edge["start_node"] in route_node_labels and edge["end_node"] in route_node_labels
    ]

    # Determine cytoscape_name
    try:
        search_params = aicp_graph["search_params"]
        cytoscape_name = f"{search_params['target_molecule_inchikey']}_SD_{search_params['reaction_steps']}-{'Predicted' if predicted_route else 'Evidence'}"
    except KeyError:
        for node in filtered_nodes:
            if node["data"]["node_type"].lower() == "substance" and node["data"]["srole"] == "tm":
                cytoscape_name = f"{node['data']['inchikey']}_SD_NA-{'Predicted' if predicted_route else 'Evidence'}"
                break

    return {
        "data": {
            "name": cytoscape_name,
            "aggregated_yield": route["aggregated_yield"] if "aggregated_yield" in route else "N/A"
        },
        "directed": True,
        "multigraph": False,
        "elements": {"nodes": filtered_nodes, "edges": filtered_edges},
        "routes": aicp_graph.get("routes"),
        "inventory": aicp_graph.get("inventory"),
    }


def assign_srole(parsed_data):
    # Assign substance roles
    in_degrees = {}
    out_degrees = {}

    # Initialize degrees
    for node in parsed_data["synth_graph"]["nodes"]:
        if node["node_type"].lower() == "substance":
            in_degrees[node["node_label"]] = 0
            out_degrees[node["node_label"]] = 0

    # Count in-degrees and out-degrees
    for edge in parsed_data["synth_graph"]["edges"]:
        from_node = edge["start_node"]
        to_node = edge["end_node"]

        if from_node in out_degrees:
            out_degrees[from_node] += 1
        if to_node in in_degrees:
            in_degrees[to_node] += 1

    # Assign roles
    for node in parsed_data["synth_graph"]["nodes"]:
        if node["node_type"].lower() == "substance":
            in_deg = in_degrees[node["node_label"]]
            out_deg = out_degrees[node["node_label"]]

            if out_deg == 0:
                node["srole"] = "tm"  # terminal material
            elif in_deg == 0:
                node["srole"] = "sm"  # starting material
            else:
                node["srole"] = "im"  # intermediate
    return parsed_data


@app.post("/send_to_cytoscape/", response_model=dict)
def send_to_cytoscape(network_json: dict = load_example_payload(), layout_type: str = "hierarchical", synth_graph_key: str = "synth_graph", predicted_route: bool = False):
    """
    Upload a network JSON to Cytoscape and apply AICP-specific styling and layout.

    This endpoint sends a preprocessed Cytoscape JSON network to the Cytoscape REST API, creates a view for it,
    applies a default AICP visual style, and optionally applies a layout (e.g., "hierarchical").

    **Query Parameters**:
    - `layout_type` (str, optional): The name of the layout algorithm to apply. Defaults to `"hierarchical"`.
    - `synth_graph_key` (str, optional): The key in the input JSON to extract the synthesis graph. Defaults to `"synth_graph"`.
    - `predicted_route` (bool, optional): Flag to indicate if the network is a predicted route. Defaults to `False`.

    **Request Body**:
    - `network_json` (dict): The AICP-formatted graph data structure to be converted and sent to Cytoscape.
      If no input is provided, an example payload will be used by default.

    **Returns**:
    - A dictionary with the following keys on success:
      - `network_suid` (int): The unique Cytoscape network session ID.
      - `view_suid` (int): The associated view ID used for styling and layout.
    - On failure, returns a dictionary with an `"error"` key and explanation.

    **Notes**:
    - This endpoint assumes a running Cytoscape instance accessible via the configured `CYTOSCAPE_URL`.
    - Errors in network creation, view generation, styling, or layout will be logged and returned as structured error messages.
    """
    try:
        network_json = convert_to_cytoscape_json(
            network_json, synth_graph_key, predicted_route)
        # Send the network to Cytoscape without custom headers
        response = requests.post(
            f"{CYTOSCAPE_URL}/networks?format=cyjs", json=network_json)

        if response.ok:
            # Log the full response to debug
            logger.info(f"Response from Cytoscape: {response.json()}")

            # Get the network SUID from the response
            network_suid = response.json().get('networkSUID')
            if not network_suid:
                raise ValueError("Network SUID not found in response.")

            logger.info(f"Network created with SUID: {network_suid}")

            # Create a view for the network
            view_response = requests.get(
                f"{CYTOSCAPE_URL}/networks/{network_suid}/views/first")
            if view_response.ok:
                logger.info("Network view created.")

                # Get the SUID of the view from the response
                view_suid = int(view_response.json()['data']['SUID'])
                logger.info(f"View SUID: {view_suid}")

                # Apply the default style
                if apply_style(network_suid, DEFAULT_STYLE_NAME):
                    logger.info(
                        f"Style '{DEFAULT_STYLE_NAME}' applied to network {network_suid}.")
                else:
                    logger.error(
                        f"Failed to apply style '{DEFAULT_STYLE_NAME}' to network {network_suid}.")

                # Apply layout if provided
                if apply_layout(network_suid, layout_type):
                    logger.info(
                        f"Layout '{layout_type}' applied to network {network_suid}.")
                else:
                    logger.error(
                        f"Failed to apply layout '{layout_type}' to network {network_suid}.")

                # Return network and view SUIDs
                return {"network_suid": network_suid, "view_suid": view_suid}
            else:
                logger.error(
                    f"Failed to create network view. Response: {view_response.text}")
                return {"error": "Failed to create network view."}

        else:
            logger.error(
                f"Failed to upload network. Response: {response.text}")
            return {"error": "Failed to upload network."}

    except requests.exceptions.RequestException as e:
        # Log the request failure and return a failure response
        logger.error(f"Request failed: {e}")

        if hasattr(e, 'response') and e.response:
            logger.error(f"Response content: {e.response.text}")

        return {"error": "Failed to upload network."}

    except ValueError as e:
        # Log the value error
        logger.error(f"Error: {e}")
        return {"error": "Failed to upload network to cytoscape."}


@app.post("/normalize_roles", summary="Normalize reaction roles from a RXN Smiles")
async def normalize_rxsmiles_roles(request: NormalizeRoleRequest) -> NormalizeRoleResponse:
    """
    Normalizes the roles of a reaction from a RXN Smiles string. Input string must be a valid RXN Smiles
    with atom mapping.

    Args:
    - rxsmiles (str): A reaction SMILES string in the format 'reactants > reagents > products'.

    Returns:
    - dict: A dictionary containing the original RXN Smiles string and the normalized RXN Smiles string.
    """
    rxsmiles = request.rxsmiles

    # Check if the RXSMILES has atom mapping
    if not role_assigner_utils.rxsmiles_has_atommapping(rxsmiles):
        raise HTTPException(
            status_code=400, detail="Input RXSMILES must contain atom mapping.")

    try:
        normalized_rxn = role_assigner_utils.normalize_roles(rxsmiles)
        return NormalizeRoleResponse(original_rxsmiles=request.rxsmiles, rxsmiles=normalized_rxn)
    except RxsmilesAtomMappingException:
        raise HTTPException(
            status_code=400, detail="Error parsing RXN Smiles: Atom mapping required")
    except Exception as e:
        logger.error(f"Error normalizing roles: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Internal error normalizing roles")


@app.get("/compute_all_bi")
async def compute_all_bi(rxsmiles: Optional[str] = "ClC(Cl)(O[C:5](=[O:11])OC(Cl)(Cl)Cl)Cl.[Cl:13][C:14]1[CH:19]=[CH:18][C:17]([C:20]2[N:21]=[C:22]([CH:31]3[CH2:36][CH2:35][NH:34][CH2:33][CH2:32]3)[S:23][C:24]=2[C:25]2[CH:30]=[CH:29][CH:28]=[CH:27][CH:26]=2)=[CH:16][CH:15]=1.C(N(CC)CC)C.Cl.[CH3:45][NH:46][OH:47].[Cl-].[NH4+]>ClCCl.O>[Cl:13][C:14]1[CH:19]=[CH:18][C:17]([C:20]2[N:21]=[C:22]([CH:31]3[CH2:36][CH2:35][N:34]([C:5](=[O:11])[N:46]([OH:47])[CH3:45])[CH2:33][CH2:32]3)[S:23][C:24]=2[C:25]2[CH:30]=[CH:29][CH:28]=[CH:27][CH:26]=2)=[CH:16][CH:15]=1"):
    """
    Calculates all balance indices for the given reaction smiles.

    Args:
    - rxsmiles (str): The reaction smiles string.

    Returns:
    - dict: A dictionary containing the calculated balance indices.
    """
    try:
        # Ensure rxsmiles is provided
        if rxsmiles is None:
            raise HTTPException(
                status_code=400, detail="rxsmiles parameter is required.")

        # Process the rxsmiles input
        pbi = role_assigner_utils.compute_pbi(rxsmiles)
        rbi = role_assigner_utils.compute_rbi(rxsmiles)
        tbi = role_assigner_utils.compute_tbi(rxsmiles)

        # Round values to two decimal places
        pbi = round(pbi, 2)
        rbi = round(rbi, 2)
        tbi = round(tbi, 2)

        return {"pbi": pbi, "rbi": rbi, "tbi": tbi}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/convert2aicp", summary="Convert to AICP format")
async def _convert_to_aicp(request: ConvertToAicpRequest) -> dict:
    """
    Converts a graph format to AICP. Currently only converts from askcos but could be expanded in the future.

    Args:
    - request (ConvertToAicpRequest): The request object containing the graph data and conversion source

    Returns:
    -  dict: The converted graph data
    """

    source_data = request.source_data
    conversion_source = request.convert_from

    if conversion_source not in ["askcos"]:
        raise HTTPException(
            status_code=400, detail=f"Invalid conversion source: {conversion_source}")

    if conversion_source == "askcos":
        synth_graph, paths = askcos_tree2synth_paths_with_graph(
            TreeSearchResponse(**source_data), USE_RETRO_RXN_RENDERING=False)

        # Flatten node and edge data into list of objects
        nodes = [
            {**{k: v for k, v in attrs.items() if k != "node_id"}, "node_id": n}
            for n, attrs in synth_graph.nodes(data=True)
        ]

        edges = [
            dict(source=u, target=v, **attrs)
            for u, v, attrs in synth_graph.edges(data=True)
        ]

        # Loop through routes
        final_routes = []
        for route in paths:
            final_routes.append(
                {
                    "aggregated_yield": 0.0,
                    "predicted": True,
                    "route_index": route["path_index"],
                    "route_status": "Predicted Synthesis Route",
                    "method": "ASKCOS v2",
                    "route_node_labels": route["nodes"]
                }
            )

        # Return converted graph
        return {
            "predictive_synth_graph": {
                "nodes": nodes,
                "edges": edges
            },
            "routes": final_routes
        }
    else:
        raise HTTPException(
            status_code=400, detail="Unsupported conversion format")
