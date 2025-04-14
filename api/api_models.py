from enum import Enum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

##########################
# Reaction Models
##########################


class RxsmilesRequest(BaseModel):
    rxsmiles: str = Field(
        default="",
        title="RXSMILES",
        description="The RXSMILES string to be parsed",
        examples=[
            "[O:1]=[C:2]1[C:6]2([CH2:11][CH2:10][NH:9][CH2:8][CH2:7]2)[N:5]([C:12]2[CH:17]=[CH:16][CH:15]=[CH:14][CH:13]=2)[CH2:4][N:3]1[CH2:18][C:19]1[CH:31]=[CH:30][CH:29]=[CH:28][C:20]=1[C:21]([O:23][C:24]([CH3:27])([CH3:26])[CH3:25])=[O:22].[I-].[Na+].C(=O)([O-])[O-].[K+].[K+].Cl[CH2:41][CH2:42][CH2:43][N:44]1[C:52]2[C:47](=[CH:48][CH:49]=[CH:50][CH:51]=2)[C:46]([CH3:54])([CH3:53])[C:45]1=[O:55]>CC(=O)CC>[CH3:54][C:46]1([CH3:53])[C:47]2[C:52](=[CH:51][CH:50]=[CH:49][CH:48]=2)[N:44]([CH2:43][CH2:42][CH2:41][N:9]2[CH2:8][CH2:7][C:6]3([N:5]([C:12]4[CH:13]=[CH:14][CH:15]=[CH:16][CH:17]=4)[CH2:4][N:3]([CH2:18][C:19]4[CH:31]=[CH:30][CH:29]=[CH:28][C:20]=4[C:21]([O:23][C:24]([CH3:27])([CH3:25])[CH3:26])=[O:22])[C:2]3=[O:1])[CH2:11][CH2:10]2)[C:45]1=[O:55] |f:1.2,3.4.5|"
        ],
    )


class NormalizeRoleRequest(RxsmilesRequest):
    pass

class NormalizeRoleResponse(RxsmilesRequest):
    original_rxsmiles: str = Field(
        default="",
        title="Original RXSMILES",
        description="The RXSMILES string to be parsed",
        examples=["CCO.CC(=O)O>>CC(=O)OCC.O"],
    )
    rxsmiles: str = Field(
        default="",
        title="RXSMILES",
        description="The normalized RXSMILES string",
        examples=[
            "[O:1]=[C:2]1[C:6]2([CH2:11][CH2:10][NH:9][CH2:8][CH2:7]2)[N:5]([C:12]2[CH:17]=[CH:16][CH:15]=[CH:14][CH:13]=2)[CH2:4][N:3]1[CH2:18][C:19]1[CH:31]=[CH:30][CH:29]=[CH:28][C:20]=1[C:21]([O:23][C:24]([CH3:27])([CH3:26])[CH3:25])=[O:22].Cl[CH2:41][CH2:42][CH2:43][N:44]1[C:52]2[C:47](=[CH:48][CH:49]=[CH:50][CH:51]=2)[C:46]([CH3:54])([CH3:53])[C:45]1=[O:55]>[K+].[K+].C(=O)([O-])[O-].CC(=O)CC.[Na+].[I-]>[CH3:54][C:46]1([CH3:53])[C:47]2[C:52](=[CH:51][CH:50]=[CH:49][CH:48]=2)[N:44]([CH2:43][CH2:42][CH2:41][N:9]2[CH2:8][CH2:7][C:6]3([N:5]([C:12]4[CH:13]=[CH:14][CH:15]=[CH:16][CH:17]=4)[CH2:4][N:3]([CH2:18][C:19]4[CH:31]=[CH:30][CH:29]=[CH:28][C:20]=4[C:21]([O:23][C:24]([CH3:27])([CH3:25])[CH3:26])=[O:22])[C:2]3=[O:1])[CH2:11][CH2:10]2)[C:45]1=[O:55] |f:2.3.4,6.7|"
        ],
    )


