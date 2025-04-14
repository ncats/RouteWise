# Author: Ilia Vorontcov, Nathan Miller, Brandon Walker
#
# Organization: National Center for Advancing Translational Sciences (NCATS/NIH)

from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, UploadFile
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
)
from role_assigner_utils import RxsmilesAtomMappingException

CYTOSCAPE_URL = "http://localhost:1234/v1"
DEFAULT_STYLE_NAME = "New SynGPS API"

# Set up logging
formatter = DefaultFormatter(fmt="%(levelname)s: %(message)s")
handler = logging.StreamHandler()
handler.setFormatter(formatter)

# Create a logger
logger = logging.getLogger(__name__)
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
    allow_origins=["http://localhost:3000", "http://localhost:4204"],  # Allows CORS requests from localhost:3000
    allow_credentials=True,  # Allow cookies to be sent
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


# Directory to persist data
DATA_DIR = "data"

# Ensure the data directory exists
os.makedirs(DATA_DIR, exist_ok=True)


# Save room data to file
def save_room_data(room_id, data):
    room_file = os.path.join(DATA_DIR, f"{room_id}.json")
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
    route_assembly_type: dict
    rxid: Optional[str] = None
    rxsmiles: Optional[str] = None
    yield_info: Optional[dict] = None
    validation: Optional[dict] = None
    srole: Optional[str] = None
    inchikey: Optional[str] = None
    canonical_smiles: Optional[str] = None

class Edge(BaseModel):
    start_node: str
    end_node: str
    edge_label: str
    edge_type: str
    uuid: str
    route_assembly_type: dict

class SynthGraph(BaseModel):
    nodes: list[Node]
    edges: list[Edge]

class RouteSubgraph(BaseModel):
    aggregate_yield: float
    route_index: int
    route_status: str
    method: str
    route_node_labels: list[str]

class Routes(BaseModel):
    subgraphs: list[RouteSubgraph]
    predicted: bool
    num_subgraphs: int

class Availability(BaseModel):
    inchikey: str
    inventory: dict
    commercial_availability: dict

class InputFile(BaseModel):
    synth_graph: SynthGraph
    routes: Routes
    availability: list[Availability]

@app.post("/upload_json_to_ui/", description="Upload a JSON file. Example file: public/json_example_1.json")
async def upload_json_to_ui(file: UploadFile):
    try:
        # Parse the JSON file
        json_data = json.loads(await file.read())

        # Validate the JSON data using Pydantic
        validated_data = InputFile(**json_data)

        # Generate a new room ID
        room_id = str(uuid.uuid4())


        # Save JSON data to the room directly
        save_room_data(room_id, validated_data.dict())

        # Return only the JSON data to the front end
        return {"data": validated_data.dict()}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=f"Validation error: {str(e)}")


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, room_id: str = Query(default=None)):
    await websocket.accept()

    try:
        while True:
            try:
                # Search the data directory for any .json file and extract room ID and room data
                for file_name in os.listdir(DATA_DIR):
                    if file_name.endswith(".json"):
                        room_id_from_file = file_name.split(".json")[0]
                        with open(os.path.join(DATA_DIR, file_name), "r") as file:
                            room_data = json.load(file)
                            await websocket.send_json({"room_id": room_id_from_file, "route_data": room_data})
                            # Send data and delete the file after successful transmission
                        await websocket.send_json({"room_id": room_id_from_file, "route_data": room_data})
                        os.remove(os.path.join(DATA_DIR, file_name))
                # Keep the WebSocket connection alive
                await asyncio.sleep(1)
            except asyncio.TimeoutError:
                # Handle timeout
                pass
    except WebSocketDisconnect:
        # Handle WebSocket disconnection
        pass

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
async def rxsmiles_to_svg_endpoint(rxsmiles: str = 'CCO.CC(=O)O>>CC(=O)OCC.O', highlight: bool = True, base64_encode: bool = True):
    svg = reaction_smiles_to_image(rxsmiles, align=False, transparent=False, highlight=highlight, retro=False)
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
        raise HTTPException(status_code=400, detail="Empty SMILES string provided")

    mol = Chem.MolFromSmiles(mol_smiles)
    if mol is None:
        logger.error(f"Invalid SMILES string: {mol_smiles}")
        raise HTTPException(status_code=400, detail=f"Invalid SMILES string: {mol_smiles}")

    d2d = Draw.MolDraw2DSVG(img_width, img_height)
    try:
        d2d.DrawMolecule(mol)
    except Exception as e:
        logger.error(f"Failed to draw molecule: {mol_smiles}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to draw molecule: {mol_smiles}")
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
            style_names = [style['title'] for style in existing_styles if isinstance(style, dict)]
            
            if style_name in style_names:
                print(f"Style '{style_name}' already exists. Applying existing style.")
                return True  # Style already exists
            else:
                print(f"Creating new style '{style_name}'.")

                # Create the new style in Cytoscape
                create_style_response = requests.post(f"{CYTOSCAPE_URL}/styles", json=style_json)
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
        apply_style_response = requests.get(f"{CYTOSCAPE_URL}/apply/styles/{style_name}/{network_suid}")
        if apply_style_response.ok:
            print(f"Style '{style_name}' applied to the network {network_suid}.")
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
        apply_layout_response = requests.get(f"{CYTOSCAPE_URL}/apply/layouts/{layout_type}/{network_suid}")
        if apply_layout_response.ok:
            print(f"Layout '{layout_type}' applied to the network {network_suid}.")
            return {"success": f"Layout '{layout_type}' applied to the network {network_suid}."}
        else:
            print(f"Failed to apply layout '{layout_type}'.")
    except requests.exceptions.RequestException as e:
        print(f"Error applying layout: {e}")

    return {"error": f"Failed to apply layout '{layout_type}'."}

def load_example_payload():
    with open("send_cytoscape_example.json", "r") as file:
        return json.load(file)

@app.post("/send_to_cytoscape/", response_model=dict)
def send_to_cytoscape(network_json: dict = load_example_payload(), layout_type: str = "hierarchical"):
    """ Uploads a Cytoscape JSON network and applies the default style """
    try:
        # Send the network to Cytoscape without custom headers
        response = requests.post(f"{CYTOSCAPE_URL}/networks?format=cyjs", json=network_json)
        
        if response.ok:
            # Log the full response to debug
            logger.info(f"Response from Cytoscape: {response.json()}")
            
            # Get the network SUID from the response
            network_suid = response.json().get('networkSUID')
            if not network_suid:
                raise ValueError("Network SUID not found in response.")
            
            logger.info(f"Network created with SUID: {network_suid}")
            
            # Create a view for the network
            view_response = requests.get(f"{CYTOSCAPE_URL}/networks/{network_suid}/views/first")
            if view_response.ok:
                logger.info("Network view created.")
                
                # Get the SUID of the view from the response
                view_suid = int(view_response.json()['data']['SUID'])
                logger.info(f"View SUID: {view_suid}")

                # Apply the default style
                if apply_style(network_suid, DEFAULT_STYLE_NAME):
                    logger.info(f"Style '{DEFAULT_STYLE_NAME}' applied to network {network_suid}.")
                else:
                    logger.error(f"Failed to apply style '{DEFAULT_STYLE_NAME}' to network {network_suid}.")

                # Apply layout if provided
                if apply_layout(network_suid, layout_type):
                    logger.info(f"Layout '{layout_type}' applied to network {network_suid}.")
                else:
                    logger.error(f"Failed to apply layout '{layout_type}' to network {network_suid}.")

                # Return network and view SUIDs
                return {"network_suid": network_suid, "view_suid": view_suid}
            else:
                logger.error(f"Failed to create network view. Response: {view_response.text}")
                return {"error": "Failed to create network view."}
        
        else:
            logger.error(f"Failed to upload network. Response: {response.text}")
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
        return {"error": str(e)}



@app.post("/normalize_roles", summary="Normalize reaction roles from a RXN Smiles")
async def normalize_rxsmiles_roles(request: NormalizeRoleRequest) -> NormalizeRoleResponse:
    """
    Normalizes the roles of a reaction from a RXN Smiles string. Input string must be a valid RXN Smiles
    with atom mapping.
    """
    rxsmiles = request.rxsmiles

    # Check if the RXSMILES has atom mapping
    if not role_assigner_utils.rxsmiles_has_atommapping(rxsmiles):
        raise HTTPException(status_code=400, detail="Input RXSMILES must contain atom mapping.")

    try:
        normalized_rxn = role_assigner_utils.normalize_roles(rxsmiles)
        return NormalizeRoleResponse(original_rxsmiles=request.rxsmiles, rxsmiles=normalized_rxn)
    except RxsmilesAtomMappingException:
        raise HTTPException(status_code=400, detail="Error parsing RXN Smiles: Atom mapping required")
    except Exception as e:
        logger.error(f"Error normalizing roles: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal error normalizing roles")

@app.get("/compute_all_bi")
async def compute_all_bi(rxsmiles: Optional[str] = "ClC(Cl)(O[C:5](=[O:11])OC(Cl)(Cl)Cl)Cl.[Cl:13][C:14]1[CH:19]=[CH:18][C:17]([C:20]2[N:21]=[C:22]([CH:31]3[CH2:36][CH2:35][NH:34][CH2:33][CH2:32]3)[S:23][C:24]=2[C:25]2[CH:30]=[CH:29][CH:28]=[CH:27][CH:26]=2)=[CH:16][CH:15]=1.C(N(CC)CC)C.Cl.[CH3:45][NH:46][OH:47].[Cl-].[NH4+]>ClCCl.O>[Cl:13][C:14]1[CH:19]=[CH:18][C:17]([C:20]2[N:21]=[C:22]([CH:31]3[CH2:36][CH2:35][N:34]([C:5](=[O:11])[N:46]([OH:47])[CH3:45])[CH2:33][CH2:32]3)[S:23][C:24]=2[C:25]2[CH:30]=[CH:29][CH:28]=[CH:27][CH:26]=2)=[CH:16][CH:15]=1"):
    try:
        # Ensure rxsmiles is provided
        if rxsmiles is None:
            raise HTTPException(status_code=400, detail="rxsmiles parameter is required.")
        
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
