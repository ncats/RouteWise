from enum import Enum
from rdkit.Chem import AllChem


class RxnSvgDepictionMode(Enum):
    SIMPLE = "simple"
    ATOM_MAP = "atom_map"
    HIGHLIGHT_WO_INDICES = "highlight_wo_indices"
    HIGHLIGHT_WITH_INDICES = "highlight_with_indices"


def parse_rxn_extended_smiles(extended_rxn_smiles: str) -> AllChem.ChemicalReaction:
    """
    Parse reaction SMILES string.

    Args:
        rxn_smiles (str): Reaction SMILES string.

    Returns:
        rdChemReactions.ChemicalReaction: RDKit ChemicalReaction object.

    Raises:
        ValueError: If conversion fails.
    """
    try:
        rxn = AllChem.ReactionFromSmarts(extended_rxn_smiles)
        rxn.Initialize()
    except Exception:
        raise ValueError(f"Failed to parse reaction: {extended_rxn_smiles}")
    return rxn


def is_reaction_valid(extended_rxn_smiles: str) -> bool:
    """
    Check if reaction SMILES is valid.

    Args:
        rxn_smiles (str): Reaction SMILES string.

    Returns:
        bool: True if valid, False otherwise.

    Raises:
        ValueError: If conversion fails.
    """
    rxn = parse_rxn_extended_smiles(extended_rxn_smiles)
    (warning_count, error_count) = rxn.Validate()

    if warning_count > 0:
        pass
    if error_count > 0:
        return False
    return True


