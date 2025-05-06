# Author: Ilia Vorontcov, Nathan Miller, Brandon Walker
#
# Organization: National Center for Advancing Translational Sciences (NCATS/NIH)

from typing import Optional, Union
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile
from pydantic import ValidationError
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from pydantic import BaseModel
import requests
import uuid
import logging
from uvicorn.logging import DefaultFormatter
import json
import asyncio
from draw_utils import reaction_smiles_to_image
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

CYTOSCAPE_URL = os.getenv("CYTOSCAPE_URL", "http://localhost:1234/v1")
DEFAULT_STYLE_NAME = "New SynGPS API"

# Set up logging
formatter = DefaultFormatter(fmt="%(levelname)s: %(message)s")
handler = logging.StreamHandler()
handler.setFormatter(formatter)

# Create a logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger.setLevel(logging.INFO)
logger.addHandler(handler)

# Create Swagger Docs URL and attach it to the app
docs_base = os.getenv("url_api_docs_base", "/api/v1/docs/aicp")
alias = os.getenv("network_alias_nv_api", "nv_api")
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
            "mappingColumn": "node_id",
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

# Redirect root endpoint to Swagger docs


@app.get("/")
async def root():
    return {"message": "Welcome to the FastAPI server. Visit /docs for API documentation."}


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

class ReactionNode(Node):
    validation: Optional[dict] = None
    yield_info: Optional[dict] = None
    rxsmiles: Optional[str] = None
    rxid: Optional[str] = None
    route_assembly_type: dict

class SubstanceNode(Node):
    srole: Optional[str] = None
    inchikey: Optional[str] = None
    canonical_smiles: Optional[str] = None
    route_assembly_type: dict


class Edge(BaseModel):
    start_node: str
    end_node: str
    edge_label: str
    edge_type: str
    uuid: str
    route_assembly_type: dict


class SynthGraph(BaseModel):
    nodes: list[Union[ReactionNode, SubstanceNode]]
    edges: list[Edge]


class RouteSubgraph(BaseModel):
    aggregated_yield: float
    route_index: int
    route_status: str
    method: str
    route_node_labels: list[str]


class Routes(BaseModel):
    subgraphs: list[RouteSubgraph]
    num_subgraphs: int


class Availability(BaseModel):
    inchikey: str
    inventory: dict
    commercial_availability: dict


class InputFile(BaseModel):
    synth_graph: SynthGraph
    routes: Routes
    availability: Optional[list[Availability]] = None


@app.post("/upload_json_to_ui/", description="Upload a JSON file or provide JSON text in the request body. Example file: public/json_example_1.json")
async def upload_json_to_ui(room_id: str, convert_askcos: bool = False, file: Optional[Union[UploadFile, str]] = None, json_data: Optional[Union[dict,str]] = None):
    if file and file.filename.strip() != "":
        json_data = json.loads(await file.read())
    elif isinstance(json_data, dict):
        json_data = json_data
    elif isinstance(json_data, str):
        json_data = json.loads(json_data)
    else:
        raise HTTPException(status_code=400, detail="Either a valid file or JSON text must be provided.")
    logger.info(
        f"Received upload request for room_id: {room_id}, convert_askcos: {convert_askcos}")
    try:
        # Parse the JSON file or text
        if file:
            json_data = json.loads(await file.read())
        elif json_data:
            json_data = json_data
        else:
            raise HTTPException(status_code=400, detail="Either a file or JSON text must be provided.")

        # If convert_askcos is True, process ASKCOS data
        if convert_askcos:
            try:
                json_data = await convert_to_aicp(ConvertToAicpRequest(graph_data=json_data, convert_askcos=convert_askcos))
            except Exception as e:
                logger.error(f"Error converting ASKCOS data: {str(e)}")
                raise HTTPException(
                    status_code=500, detail=f"Error converting ASKCOS data: {str(e)}")

        # Validate the JSON data using Pydantic
        validated_data = InputFile(**json_data)

        # Check if the room ID exists
        if room_id not in room_connections:
            logger.warning(f"Room ID {room_id} not found in room_connections")
            raise HTTPException(status_code=404, detail="Room ID not found")

        # Save JSON data to the room directly
        save_room_data(room_id, validated_data.dict())
        logger.info(f"Saved JSON data to room {room_id}")

        # Send the data to the WebSocket client associated with the room ID
        if room_id in room_connections:
            try:
                await room_connections[room_id].send_json({"type": "new-graph", "room_id": room_id, "data": validated_data.dict()})
                logger.info(f"Sent JSON data to WebSocket for room {room_id}")
            except RuntimeError as e:
                logger.warning(
                    f"Failed to send data to WebSocket for room {room_id}: {e}")
            except Exception as e:
                logger.error(
                    f"Unexpected error while sending data to WebSocket for room {room_id}: {e}")
        else:
            logger.warning(
                f"Room ID {room_id} not found in active WebSocket connections: {list(room_connections.keys())}")

        # Return only the JSON data to the front end
        return {"data": validated_data.dict()}
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON file: {str(e)}")
        raise HTTPException(
            status_code=400, detail=f"Invalid JSON file: {str(e)}")
    except ValidationError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=422, detail=f"Validation error: {str(e)}")


# WebSocket endpoint
# Maintain a mapping of room IDs to WebSocket connections
room_connections: dict[str, WebSocket] = {}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
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
                                    logger.warning(f"Failed to send data to WebSocket for room {room_id_from_file}: {e}")
                            # Send data and delete the file after successful transmission
                        os.remove(os.path.join(DATA_DIR, file_name))
                # Keep the WebSocket connection alive
                await asyncio.sleep(1)
            except asyncio.TimeoutError:
                # Handle timeout
                pass
    except WebSocketDisconnect:
        # Log the disconnection and remove the WebSocket connection from the mapping
        logger.warning(f"WebSocket disconnected for room {room_id}. Removing connection.")
        if room_id in room_connections:
            logger.info(f"Removing room_id {room_id} from room_connections due to WebSocket closure")
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
    svg = reaction_smiles_to_image(rxsmiles, align=False, transparent=False, highlight=highlight, retro=False, show_atom_indices=show_atom_indices)
    svg = svg.replace('"', "'")
    if base64_encode:
        svg = base64.b64encode(svg.encode('utf-8')).decode('utf-8')
        return JSONResponse(content={"rxsmiles": rxsmiles, "svg_base64": svg})
    else:
        return JSONResponse(content={"rxsmiles": rxsmiles, "svg": svg})

# Endpoint to convert molecule SMILES to SVG


@app.get("/molsmiles2svg")
async def smiles_to_svg_endpoint(mol_smiles: str = 'Cc1cc(Br)cc(C)c1C1C(=O)CCC1=O', img_width: int = 300, img_height: int = 300, base64_encode: bool = True):
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
        if existing_styles_response.ok:
            existing_styles = existing_styles_response.json()
            print("Existing styles:", existing_styles)  # Debug print

            # Extract the style names
            style_names = [style['title']
                           for style in existing_styles if isinstance(style, dict)]

            if style_name in style_names:
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


def load_example_payload():
    with open("json_example_1.json", "r") as file:
        return json.load(file)
    

def convert_to_cytoscape_json(aicp_graph):

    synth_graph = aicp_graph["synth_graph"]
    subgraphs = aicp_graph.get("routes", {}).get("subgraphs", [])

    if not subgraphs:
        raise ValueError("No subgraphs found in the 'routes.subgraphs' section.")

    subgraph = subgraphs[0]
    route_node_labels = set(subgraph["route_node_labels"])

    # Filter nodes
    filtered_nodes = [
        {"data": {**node, "id": node["node_label"]}}
        for node in synth_graph["nodes"]
        if node["node_label"] in route_node_labels
    ]

    # Filter edges
    filtered_edges = [
        {"data": {**edge, "source": edge["start_node"], "target": edge["end_node"]}}
        for edge in synth_graph["edges"]
        if edge["start_node"] in route_node_labels and edge["end_node"] in route_node_labels
    ]

    # Retain "routes" and "inventory" sections
    return {
        "data": {"name": "test"},
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
        if node["node_type"] == "substance":
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
        if node["node_type"] == "substance":
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
def send_to_cytoscape(network_json: dict = load_example_payload(), layout_type: str = "hierarchical"):
    """ Uploads a Cytoscape JSON network and applies the default style """
    try:
        network_json = convert_to_cytoscape_json(network_json)
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
async def convert_to_aicp(request: ConvertToAicpRequest) -> dict:
    graph_data = request.graph_data
    convert_askcos = request.convert_askcos
    """
    Converts to AICP format.
    """
    if convert_askcos:
        try:
            # Initialize the result structure
            parsed_data = {
                "synth_graph": {
                    "nodes": [],
                    "edges": []
                },
                "routes": {
                    "method": "ASKCOS",
                    "predicted": True,
                    "subgraphs": [],
                    "num_subgraphs": 0
                }
            }

            # Access the actual data from the 'result' field
            result = graph_data.get("result", {})

            # Parsing graph nodes
            availability = []
            for node in result.get("graph", {}).get("nodes", []):
                is_reaction = node.get("type") == "reaction"
                is_substance = node.get("type") == "chemical"

                node_data = {
                    "node_label": node.get("id"),
                    "node_type": "reaction" if is_reaction else "substance",
                    "uuid": node.get("id", ""),
                    "route_assembly_type": {
                        "is_predicted": True,
                        "is_evidence": False,
                    },
                }

                if is_reaction:
                    node_data.update({
                        "rxid": str(node.get("template", {}).get("index", "")),
                        "rxsmiles": node.get("id", ""),
                        "yield_info": {
                            "yield_predicted": node.get("scscore"),
                            "yield_score": node.get("scscore")
                        },
                        "validation": {
                            "is_balanced": False
                        },
                    })
                elif is_substance:
                    node_data.update({
                        "inchikey": node.get("id", ""),
                        "canonical_smiles": node.get("id", ""),
                        "srole": "",
                    })
                    if is_substance and node.get("properties"):
                        availability_item = {
                            "inchikey": node.get("id", ""),
                            "inventory": {
                                "available": False,
                                "locations": [
                                    {
                                        "smiles": node.get("smiles", ""),
                                        "room": "",
                                        "position": "",
                                        "quantity_weight": "",
                                        "unit": ""
                                    }
                                ]
                            },
                            "commercial_availability": {
                                "available": False,
                                "vendors": [
                                    {
                                        "smiles": node.get("smiles", ""),
                                        "source": "",
                                        "ppg": "",
                                        "lead_time": "",
                                        "url": ""
                                    }
                                ]
                            }
                        }
                        availability.append(availability_item)

                parsed_data["synth_graph"]["nodes"].append(node_data)

            node_type_map = {node["node_label"]: node["node_type"]
                             for node in parsed_data["synth_graph"]["nodes"]}

            # Parsing graph edges (links)
            for link in result.get("graph", {}).get("links", []):
                target = link.get("target", "")
                source = link.get("source", "")

                target_node_type = node_type_map.get(source)
                edge_type = "reactant_of" if target_node_type == "reaction" else "product_of"

                edge_data = {
                    "start_node": target,
                    "end_node": source,
                    "edge_label": f"{target}|{source}",
                    "edge_type": edge_type,
                    "provenance": {
                        "is_in_aicp": False
                    },
                    "uuid": f"{target}|{source}",
                    "inchikey": target if edge_type == "product_of" else source,
                    "rxid": source if edge_type == "product_of" else "",
                    "route_assembly_type": {
                        "is_predicted": True,
                        "is_evidence": False
                    }
                }

                parsed_data["synth_graph"]["edges"].append(edge_data)

            # Parse routes
            parsed_data["routes"]["subgraphs"] = []
            parsed_data["routes"]["num_subgraphs"] = len(
                result.get("paths", []))

            route_node_labels = set()
            for path in result.get("paths", []):
                subgraph_data = {
                    "aggregate_yield": 0.0,
                    "route_index": len(parsed_data["routes"]["subgraphs"]),
                    "route_status": "Viable Route",
                    "method": "ASKCOS",
                    "route_node_labels": [node.get("smiles", "") for node in path.get("nodes", [])],
                }
                parsed_data["routes"]["subgraphs"].append(subgraph_data)
                route_node_labels.update(subgraph_data["route_node_labels"])

            # Filter availability to include only substances in route subgraphs
            parsed_data["availability"] = [
                item for item in availability if item["inchikey"] in route_node_labels]

            parsed_data = assign_srole(parsed_data)

            return parsed_data
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error converting ASKCOS data: {str(e)}")
    else:
        raise HTTPException(
            status_code=400, detail="Error converting data: Invalid request")
